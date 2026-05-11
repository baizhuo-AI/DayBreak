import Database from "@tauri-apps/plugin-sql";
import type { Todo, Priority, TodoStatus } from "./store";

/**
 * SQLite 单例
 *
 * 数据库位置:Tauri 默认 AppData 目录下的 daybreak.db
 *  - macOS: ~/Library/Application Support/com.apple.todo-floating-panel/daybreak.db
 *
 * Schema 迁移策略:
 *  - V1: CREATE TABLE IF NOT EXISTS(初始表)
 *  - V2+: ALTER TABLE ADD COLUMN,用 try/catch 兜底("duplicate column name" 忽略)
 *
 * 加新列时:把语句追加到 migrate() 末尾,旧库会执行 ALTER,新库 IF NOT EXISTS 路径自带新列。
 */

let _db: Database | null = null;

const SCHEMA_V1 = `
CREATE TABLE IF NOT EXISTS todos (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  reason TEXT,
  deadline TEXT,
  priority TEXT NOT NULL DEFAULT 'none',
  tags TEXT NOT NULL DEFAULT '[]',
  est_time TEXT,
  status TEXT NOT NULL DEFAULT 'todo',
  scheduled_time TEXT,
  scheduled_date TEXT,
  is_pushback INTEGER NOT NULL DEFAULT 0,
  is_procrastinated INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_todos_status ON todos(status);
CREATE INDEX IF NOT EXISTS idx_todos_scheduled_date ON todos(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_todos_created_at ON todos(created_at);

CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  period TEXT NOT NULL,
  target_date TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_goals_period ON goals(period);
CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conv_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  reasoning_content TEXT,
  usage_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (conv_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conv_id, created_at);

CREATE TABLE IF NOT EXISTS reflections (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  period TEXT NOT NULL,
  content TEXT NOT NULL,
  mood_tags TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reflections_date ON reflections(date, period);

CREATE TABLE IF NOT EXISTS llm_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  feature TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_llm_usage_created_at ON llm_usage(created_at);
`;

/**
 * 查表的列名集合(用 SQLite 的 pragma_table_info 虚表)
 * 比 try/catch + ALTER 更可靠,因为 plugin-sql 对 ALTER 失败的报错信息不一定包含 "duplicate column name"
 */
async function getColumns(db: Database, table: string): Promise<Set<string>> {
  const rows = await db.select<Array<{ name: string }>>(
    "SELECT name FROM pragma_table_info($1)",
    [table]
  );
  return new Set(rows.map((r) => r.name));
}

async function migrate(db: Database): Promise<void> {
  // V1: 创建表(IF NOT EXISTS)
  for (const stmt of SCHEMA_V1.split(";").map((s) => s.trim()).filter(Boolean)) {
    await db.execute(stmt);
  }
  // V2: scheduled_date 列(旧库 P1 初版没有这列,新库 V1 已带)
  const todoCols = await getColumns(db, "todos");
  if (!todoCols.has("scheduled_date")) {
    await db.execute("ALTER TABLE todos ADD COLUMN scheduled_date TEXT");
    console.info("[db] migrated: added scheduled_date column");
  }
  // V3: messages 加 reasoning_content(推理模型的思考过程持久化)
  const msgCols = await getColumns(db, "messages");
  if (msgCols.size > 0 && !msgCols.has("reasoning_content")) {
    await db.execute("ALTER TABLE messages ADD COLUMN reasoning_content TEXT");
    console.info("[db] migrated: added reasoning_content column");
  }
}

export async function getDb(): Promise<Database> {
  if (_db) return _db;
  _db = await Database.load("sqlite:daybreak.db");
  await migrate(_db);
  return _db;
}

/* ---------- Row 类型 + 转换 ---------- */

interface TodoRow {
  id: string;
  title: string;
  reason: string | null;
  deadline: string | null;
  priority: string;
  tags: string;
  est_time: string | null;
  status: string;
  scheduled_time: string | null;
  scheduled_date: string | null;
  is_pushback: number;
  is_procrastinated: number;
  created_at: string;
  updated_at: string;
}

function rowToTodo(row: TodoRow): Todo {
  return {
    id: row.id,
    title: row.title,
    reason: row.reason ?? undefined,
    deadline: row.deadline ?? undefined,
    priority: row.priority as Priority,
    tags: safeJsonParseArray(row.tags),
    estTime: row.est_time ?? undefined,
    status: row.status as TodoStatus,
    scheduledTime: row.scheduled_time ?? undefined,
    scheduledDate: row.scheduled_date ?? undefined,
    isPushBackSuggestion: row.is_pushback === 1,
    isProcrastinated: row.is_procrastinated === 1,
    createdAt: row.created_at
  };
}

function safeJsonParseArray(s: string): string[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/* ---------- CRUD ---------- */

export async function dbListTodos(): Promise<Todo[]> {
  const db = await getDb();
  const rows = await db.select<TodoRow[]>(
    "SELECT * FROM todos ORDER BY created_at DESC"
  );
  return rows.map(rowToTodo);
}

export async function dbInsertTodo(todo: Todo): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.execute(
    `INSERT INTO todos
      (id, title, reason, deadline, priority, tags, est_time, status,
       scheduled_time, scheduled_date, is_pushback, is_procrastinated,
       created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [
      todo.id,
      todo.title,
      todo.reason ?? null,
      todo.deadline ?? null,
      todo.priority,
      JSON.stringify(todo.tags ?? []),
      todo.estTime ?? null,
      todo.status,
      todo.scheduledTime ?? null,
      todo.scheduledDate ?? null,
      todo.isPushBackSuggestion ? 1 : 0,
      todo.isProcrastinated ? 1 : 0,
      todo.createdAt ?? now,
      now
    ]
  );
}

export async function dbUpdateTodoStatus(
  id: string,
  status: TodoStatus
): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE todos SET status = $1, updated_at = $2 WHERE id = $3",
    [status, new Date().toISOString(), id]
  );
}

export async function dbUpdateTodoSchedule(
  id: string,
  scheduledDate: string | null,
  scheduledTime: string | null
): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE todos SET scheduled_date = $1, scheduled_time = $2, updated_at = $3 WHERE id = $4",
    [scheduledDate, scheduledTime, new Date().toISOString(), id]
  );
}

export async function dbDeleteTodo(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM todos WHERE id = $1", [id]);
}

/**
 * 一次性把 P1 mock 数据塞进去(只在表为空时调用,做个种子数据)
 */
export async function dbSeedIfEmpty(seeds: Todo[]): Promise<void> {
  const db = await getDb();
  const rows = await db.select<{ c: number }[]>(
    "SELECT COUNT(*) as c FROM todos"
  );
  const count = rows[0]?.c ?? 0;
  if (count > 0) return;
  for (const t of seeds) {
    await dbInsertTodo(t);
  }
}

/* ---------- Goals ---------- */

export type GoalPeriod = "year" | "quarter" | "month";
export type GoalStatus = "active" | "achieved" | "abandoned";

export interface Goal {
  id: string;
  title: string;
  description?: string;
  period: GoalPeriod;
  targetDate?: string;
  status: GoalStatus;
  createdAt: string;
}

interface GoalRow {
  id: string;
  title: string;
  description: string | null;
  period: string;
  target_date: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

function rowToGoal(row: GoalRow): Goal {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    period: row.period as GoalPeriod,
    targetDate: row.target_date ?? undefined,
    status: row.status as GoalStatus,
    createdAt: row.created_at
  };
}

export async function dbListGoals(): Promise<Goal[]> {
  const db = await getDb();
  const rows = await db.select<GoalRow[]>(
    "SELECT * FROM goals ORDER BY created_at DESC"
  );
  return rows.map(rowToGoal);
}

export async function dbInsertGoal(goal: Goal): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.execute(
    `INSERT INTO goals
      (id, title, description, period, target_date, status, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      goal.id,
      goal.title,
      goal.description ?? null,
      goal.period,
      goal.targetDate ?? null,
      goal.status,
      goal.createdAt ?? now,
      now
    ]
  );
}

export async function dbUpdateGoalStatus(
  id: string,
  status: GoalStatus
): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE goals SET status = $1, updated_at = $2 WHERE id = $3",
    [status, new Date().toISOString(), id]
  );
}

export async function dbDeleteGoal(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM goals WHERE id = $1", [id]);
}

/* ---------- Chat: conversations + messages ---------- */

export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessageRow {
  id: string;
  convId: string;
  role: ChatRole;
  content: string;
  /** 推理模型的思考过程(deepseek-reasoner 等) */
  reasoningContent?: string;
  /** 仅 assistant 消息有,记录这条消息消耗的 tokens(JSON 字符串) */
  usageJson?: string;
  createdAt: string;
}

export interface ConversationRow {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface ConvRow {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface MsgRow {
  id: string;
  conv_id: string;
  role: string;
  content: string;
  reasoning_content: string | null;
  usage_json: string | null;
  created_at: string;
}

export async function dbListConversations(): Promise<ConversationRow[]> {
  const db = await getDb();
  const rows = await db.select<ConvRow[]>(
    "SELECT * FROM conversations ORDER BY updated_at DESC"
  );
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }));
}

export async function dbInsertConversation(conv: ConversationRow): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO conversations (id, title, created_at, updated_at) VALUES ($1,$2,$3,$4)`,
    [conv.id, conv.title, conv.createdAt, conv.updatedAt]
  );
}

export async function dbUpdateConversationTitle(
  id: string,
  title: string
): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE conversations SET title = $1, updated_at = $2 WHERE id = $3`,
    [title, new Date().toISOString(), id]
  );
}

export async function dbTouchConversation(id: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE conversations SET updated_at = $1 WHERE id = $2`,
    [new Date().toISOString(), id]
  );
}

export async function dbDeleteConversation(id: string): Promise<void> {
  const db = await getDb();
  // messages 表有 FK CASCADE,但 SQLite 默认不启用 FK,显式删一下保险
  await db.execute("DELETE FROM messages WHERE conv_id = $1", [id]);
  await db.execute("DELETE FROM conversations WHERE id = $1", [id]);
}

export async function dbListMessages(convId: string): Promise<ChatMessageRow[]> {
  const db = await getDb();
  const rows = await db.select<MsgRow[]>(
    "SELECT * FROM messages WHERE conv_id = $1 ORDER BY created_at ASC",
    [convId]
  );
  return rows.map((r) => ({
    id: r.id,
    convId: r.conv_id,
    role: r.role as ChatRole,
    content: r.content,
    reasoningContent: r.reasoning_content ?? undefined,
    usageJson: r.usage_json ?? undefined,
    createdAt: r.created_at
  }));
}

export async function dbInsertMessage(msg: ChatMessageRow): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO messages (id, conv_id, role, content, reasoning_content, usage_json, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
      msg.id,
      msg.convId,
      msg.role,
      msg.content,
      msg.reasoningContent ?? null,
      msg.usageJson ?? null,
      msg.createdAt
    ]
  );
}

export async function dbUpdateMessageContent(
  id: string,
  content: string,
  reasoningContent?: string,
  usageJson?: string
): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE messages SET content = $1, reasoning_content = $2, usage_json = $3 WHERE id = $4`,
    [content, reasoningContent ?? null, usageJson ?? null, id]
  );
}

/* ---------- Reflections ---------- */

export type ReflectPeriod = "day" | "week";

export interface ReflectionRow {
  id: string;
  /** date 形如 "2026-05-11" 或 周 "2026-W19" */
  date: string;
  period: ReflectPeriod;
  content: string;
  moodTags: string[];
  createdAt: string;
}

interface ReflectRow {
  id: string;
  date: string;
  period: string;
  content: string;
  mood_tags: string;
  created_at: string;
}

function rowToReflection(r: ReflectRow): ReflectionRow {
  return {
    id: r.id,
    date: r.date,
    period: r.period as ReflectPeriod,
    content: r.content,
    moodTags: safeJsonParseArray(r.mood_tags),
    createdAt: r.created_at
  };
}

export async function dbListReflections(
  period: ReflectPeriod,
  limit = 20
): Promise<ReflectionRow[]> {
  const db = await getDb();
  const rows = await db.select<ReflectRow[]>(
    "SELECT * FROM reflections WHERE period = $1 ORDER BY date DESC LIMIT $2",
    [period, limit]
  );
  return rows.map(rowToReflection);
}

export async function dbUpsertReflection(rec: ReflectionRow): Promise<void> {
  const db = await getDb();
  // 同一 date+period 只保留最新一条:先删后插
  await db.execute(
    "DELETE FROM reflections WHERE date = $1 AND period = $2",
    [rec.date, rec.period]
  );
  await db.execute(
    `INSERT INTO reflections (id, date, period, content, mood_tags, created_at)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [
      rec.id,
      rec.date,
      rec.period,
      rec.content,
      JSON.stringify(rec.moodTags ?? []),
      rec.createdAt
    ]
  );
}

export async function dbDeleteReflection(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM reflections WHERE id = $1", [id]);
}

/* ---------- llm_usage ---------- */

export interface LlmUsageRecord {
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  /** feature 标签:parseTask / generateTodayPlan / chat / reflect 等 */
  feature?: string;
}

export async function dbInsertUsage(rec: LlmUsageRecord): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO llm_usage
      (provider, model, prompt_tokens, completion_tokens, total_tokens, feature, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
      rec.provider,
      rec.model,
      rec.promptTokens,
      rec.completionTokens,
      rec.totalTokens,
      rec.feature ?? null,
      new Date().toISOString()
    ]
  );
}

export async function dbUsageSummary(): Promise<{
  totalCalls: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
}> {
  const db = await getDb();
  const rows = await db.select<
    Array<{
      calls: number | null;
      pt: number | null;
      ct: number | null;
      tt: number | null;
    }>
  >(
    `SELECT
       COUNT(*) AS calls,
       SUM(prompt_tokens) AS pt,
       SUM(completion_tokens) AS ct,
       SUM(total_tokens) AS tt
     FROM llm_usage`
  );
  const r = rows[0];
  return {
    totalCalls: r?.calls ?? 0,
    totalPromptTokens: r?.pt ?? 0,
    totalCompletionTokens: r?.ct ?? 0,
    totalTokens: r?.tt ?? 0
  };
}
