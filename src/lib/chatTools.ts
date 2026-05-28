/**
 * 内置 AI 对话的工具层（function calling）
 *
 * 定义给 LLM 看的工具 schema + 每个工具的执行逻辑。
 * 执行直接复用前端已有的 db.ts / store 函数（不绕后端 MCP），执行后刷新对应 store，
 * 这样在对话里改的数据，TodosPage / Briefing / 浮窗等界面会实时更新。
 *
 * 工具集与后端 MCP 对齐（同样 16 个），保证"应用内对话"和"外部 Claude Code"能力一致。
 */

import {
  dbListTodos,
  dbUpdateTodoStatus,
  dbUpdateTodoSchedule,
  dbListReflections,
  dbUpsertReflection,
  dbListActivities,
} from "./db";
import { useTodoStore, newTodoId, type Todo, type Priority, type TodoStatus } from "./store";
import { useGoalsStore, newGoalId, type Goal } from "./goalsStore";
import { useActivityStore } from "./activityStore";
import { emitSync } from "./syncBus";

export interface ChatTool {
  name: string;
  description: string;
  /** JSON schema（OpenAI function parameters 格式） */
  parameters: Record<string, unknown>;
  /** 执行，返回给模型的结果文本 */
  execute: (args: Record<string, unknown>) => Promise<string>;
}

/* ---------- helpers ---------- */

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function reflectionId(): string {
  return `r${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v : undefined;
}

/** todos 写操作后统一刷新主窗口 + 通知其它窗口 */
async function refreshTodos() {
  await useTodoStore.getState().hydrate();
  emitSync("todos");
}

/* ---------- 工具定义 ---------- */

export const CHAT_TOOLS: ChatTool[] = [
  {
    name: "list_todos",
    description: "列出待办任务，可按状态过滤",
    parameters: {
      type: "object",
      properties: {
        status: { type: "string", description: "todo / doing / done / dropped；留空返回全部" },
        limit: { type: "number", description: "最多返回多少条，默认 50" },
      },
    },
    execute: async (a) => {
      const all = await dbListTodos();
      const status = str(a.status);
      const filtered = status ? all.filter((t) => t.status === status) : all;
      const limit = typeof a.limit === "number" ? a.limit : 50;
      const items = filtered.slice(0, limit).map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        scheduledDate: t.scheduledDate,
        scheduledTime: t.scheduledTime,
        deadline: t.deadline,
      }));
      return JSON.stringify({ count: items.length, todos: items });
    },
  },
  {
    name: "create_todo",
    description: "创建一个新待办任务",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "任务标题（必填）" },
        priority: { type: "string", description: "high / medium / low / none，默认 none" },
        deadline: { type: "string", description: "截止日期 YYYY-MM-DD" },
        scheduled_date: { type: "string", description: "排期到哪天 YYYY-MM-DD" },
        scheduled_time: { type: "string", description: "排期时段，如 09:30-11:00" },
        est_time: { type: "string", description: "预估耗时，如 1.5h" },
        reason: { type: "string", description: "为什么做（可选）" },
      },
      required: ["title"],
    },
    execute: async (a) => {
      const title = str(a.title);
      if (!title) return JSON.stringify({ error: "title 必填" });
      const todo: Todo = {
        id: newTodoId(),
        title,
        reason: str(a.reason),
        deadline: str(a.deadline),
        priority: (str(a.priority) as Priority) ?? "none",
        tags: [],
        estTime: str(a.est_time),
        status: "todo",
        scheduledTime: str(a.scheduled_time),
        scheduledDate: str(a.scheduled_date),
        createdAt: new Date().toISOString(),
      };
      await useTodoStore.getState().addTodo(todo); // 内含 db 写入 + state 更新 + emitSync
      return JSON.stringify({ created: { id: todo.id, title: todo.title } });
    },
  },
  {
    name: "set_todo_status",
    description: "更新任务状态。状态：todo / doing / done / dropped",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string" },
        status: { type: "string", description: "todo / doing / done / dropped" },
      },
      required: ["id", "status"],
    },
    execute: async (a) => {
      const id = str(a.id);
      const status = str(a.status);
      if (!id || !status) return JSON.stringify({ error: "id 和 status 必填" });
      await dbUpdateTodoStatus(id, status as TodoStatus);
      await refreshTodos();
      return JSON.stringify({ updated: true, id, status });
    },
  },
  {
    name: "schedule_todo",
    description: "给任务排期（归属日期和/或时段）",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string" },
        scheduled_date: { type: "string", description: "YYYY-MM-DD；留空清除" },
        scheduled_time: { type: "string", description: "如 09:30-11:00；留空清除" },
      },
      required: ["id"],
    },
    execute: async (a) => {
      const id = str(a.id);
      if (!id) return JSON.stringify({ error: "id 必填" });
      await dbUpdateTodoSchedule(id, str(a.scheduled_date) ?? null, str(a.scheduled_time) ?? null);
      await refreshTodos();
      return JSON.stringify({ updated: true, id });
    },
  },
  {
    name: "update_todo",
    description: "编辑已有任务的字段（标题/原因/优先级/deadline/标签/预估时间）。只填想改的字段；状态/排期请用 set_todo_status / schedule_todo",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "目标任务的 id" },
        title: { type: "string" },
        reason: { type: "string" },
        deadline: { type: "string", description: "YYYY-MM-DD；空字符串则清除" },
        priority: { type: "string", description: "high / medium / low / none" },
        tags: { type: "array", items: { type: "string" } },
        est_time: { type: "string", description: "如 1.5h / 30m" },
      },
      required: ["id"],
    },
    execute: async (a) => {
      const id = str(a.id);
      if (!id) return JSON.stringify({ error: "id 必填" });
      const all = await dbListTodos();
      const cur = all.find((t) => t.id === id);
      if (!cur) return JSON.stringify({ error: "没找到该 id" });
      const merged: Todo = {
        ...cur,
        title: typeof a.title === "string" && a.title.trim() ? a.title.trim() : cur.title,
        reason: typeof a.reason === "string" ? (a.reason || undefined) : cur.reason,
        deadline: typeof a.deadline === "string" ? (a.deadline || undefined) : cur.deadline,
        priority: (str(a.priority) as Priority) ?? cur.priority,
        tags: Array.isArray(a.tags)
          ? (a.tags as unknown[]).filter((x): x is string => typeof x === "string")
          : cur.tags,
        estTime: typeof a.est_time === "string" ? (a.est_time || undefined) : cur.estTime,
      };
      await useTodoStore.getState().updateTodo(merged);
      return JSON.stringify({
        updated: true,
        id,
        fieldsChanged: Object.keys(a).filter((k) => k !== "id"),
      });
    },
  },
  {
    name: "today_overview",
    description: "查看某一天的任务概览（默认今天）",
    parameters: {
      type: "object",
      properties: {
        date: { type: "string", description: "YYYY-MM-DD；留空默认今天" },
      },
    },
    execute: async (a) => {
      const date = str(a.date) ?? todayKey();
      const all = await dbListTodos();
      const items = all
        .filter((t) => (t.scheduledDate ?? "") === date)
        .map((t) => ({ id: t.id, title: t.title, status: t.status, scheduledTime: t.scheduledTime }));
      return JSON.stringify({ date, count: items.length, todos: items });
    },
  },
  {
    name: "delete_todo",
    description: "删除（放弃）任务——标记为 dropped，可用 recover_todo 恢复，不真删数据",
    parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
    execute: async (a) => {
      const id = str(a.id);
      if (!id) return JSON.stringify({ error: "id 必填" });
      await dbUpdateTodoStatus(id, "dropped");
      await refreshTodos();
      return JSON.stringify({ deleted: true, id, note: "已标记 dropped，可恢复" });
    },
  },
  {
    name: "recover_todo",
    description: "恢复被删除（dropped）的任务，状态改回 todo",
    parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
    execute: async (a) => {
      const id = str(a.id);
      if (!id) return JSON.stringify({ error: "id 必填" });
      await dbUpdateTodoStatus(id, "todo");
      await refreshTodos();
      return JSON.stringify({ recovered: true, id });
    },
  },
  {
    name: "list_goals",
    description: "列出目标，可按周期/状态过滤",
    parameters: {
      type: "object",
      properties: {
        period: { type: "string", description: "year / quarter / month" },
        status: { type: "string", description: "active / achieved / abandoned" },
      },
    },
    execute: async (a) => {
      let goals = useGoalsStore.getState().goals;
      if (goals.length === 0) {
        await useGoalsStore.getState().hydrate();
        goals = useGoalsStore.getState().goals;
      }
      const period = str(a.period);
      const status = str(a.status);
      const items = goals
        .filter((g) => (!period || g.period === period) && (!status || g.status === status))
        .map((g) => ({ id: g.id, title: g.title, period: g.period, status: g.status, targetDate: g.targetDate }));
      return JSON.stringify({ count: items.length, goals: items });
    },
  },
  {
    name: "create_goal",
    description: "创建目标。period：year / quarter / month",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        period: { type: "string", description: "year / quarter / month（必填）" },
        description: { type: "string" },
        target_date: { type: "string", description: "YYYY-MM-DD" },
      },
      required: ["title", "period"],
    },
    execute: async (a) => {
      const title = str(a.title);
      const period = str(a.period);
      if (!title || !period) return JSON.stringify({ error: "title 和 period 必填" });
      const goal: Goal = {
        id: newGoalId(),
        title,
        description: str(a.description),
        period: period as Goal["period"],
        targetDate: str(a.target_date),
        status: "active",
        createdAt: new Date().toISOString(),
      };
      await useGoalsStore.getState().addGoal(goal);
      emitSync("goals");
      return JSON.stringify({ created: { id: goal.id, title: goal.title } });
    },
  },
  {
    name: "set_goal_status",
    description: "更新目标状态：active / achieved / abandoned",
    parameters: {
      type: "object",
      properties: { id: { type: "string" }, status: { type: "string" } },
      required: ["id", "status"],
    },
    execute: async (a) => {
      const id = str(a.id);
      const status = str(a.status);
      if (!id || !status) return JSON.stringify({ error: "id 和 status 必填" });
      await useGoalsStore.getState().setStatus(id, status as Goal["status"]);
      emitSync("goals");
      return JSON.stringify({ updated: true, id, status });
    },
  },
  {
    name: "delete_goal",
    description: "删除（放弃）目标——标记 abandoned，可用 recover_goal 恢复",
    parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
    execute: async (a) => {
      const id = str(a.id);
      if (!id) return JSON.stringify({ error: "id 必填" });
      await useGoalsStore.getState().setStatus(id, "abandoned");
      emitSync("goals");
      return JSON.stringify({ deleted: true, id, note: "已标记 abandoned，可恢复" });
    },
  },
  {
    name: "recover_goal",
    description: "恢复被删除（abandoned）的目标，状态改回 active",
    parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
    execute: async (a) => {
      const id = str(a.id);
      if (!id) return JSON.stringify({ error: "id 必填" });
      await useGoalsStore.getState().setStatus(id, "active");
      emitSync("goals");
      return JSON.stringify({ recovered: true, id });
    },
  },
  {
    name: "list_reflections",
    description: "列出复盘记录。period：day（日）/ week（周）",
    parameters: {
      type: "object",
      properties: {
        period: { type: "string", description: "day / week" },
        limit: { type: "number", description: "默认 20" },
      },
      required: ["period"],
    },
    execute: async (a) => {
      const period = str(a.period);
      if (period !== "day" && period !== "week") return JSON.stringify({ error: "period 须为 day 或 week" });
      const limit = typeof a.limit === "number" ? a.limit : 20;
      const rows = await dbListReflections(period, limit);
      const items = rows.map((r) => ({ id: r.id, date: r.date, period: r.period, content: r.content, moodTags: r.moodTags }));
      return JSON.stringify({ count: items.length, reflections: items });
    },
  },
  {
    name: "upsert_reflection",
    description: "新增或覆盖某天/某周的复盘（同 date+period 只保留最新一条）",
    parameters: {
      type: "object",
      properties: {
        date: { type: "string", description: "日复盘 YYYY-MM-DD，周复盘 YYYY-Www" },
        period: { type: "string", description: "day / week" },
        content: { type: "string" },
        mood_tags: { type: "array", items: { type: "string" }, description: "心情标签，可选" },
      },
      required: ["date", "period", "content"],
    },
    execute: async (a) => {
      const date = str(a.date);
      const period = str(a.period);
      const content = str(a.content);
      if (!date || (period !== "day" && period !== "week") || !content)
        return JSON.stringify({ error: "date / period(day|week) / content 必填" });
      const moodTags = Array.isArray(a.mood_tags) ? (a.mood_tags as unknown[]).filter((x): x is string => typeof x === "string") : [];
      await dbUpsertReflection({ id: reflectionId(), date, period, content, moodTags, createdAt: new Date().toISOString() });
      emitSync("reflections");
      return JSON.stringify({ saved: { date, period } });
    },
  },
  {
    name: "list_activities",
    description: "列出最近的时间日志",
    parameters: { type: "object", properties: { limit: { type: "number", description: "默认 100" } } },
    execute: async (a) => {
      const limit = typeof a.limit === "number" ? a.limit : 100;
      const rows = await dbListActivities(limit);
      return JSON.stringify({ count: rows.length, activities: rows.map((r) => ({ id: r.id, content: r.content, createdAt: r.createdAt })) });
    },
  },
  {
    name: "log_activity",
    description: "记一条时间日志（你现在/刚才在做什么）",
    parameters: { type: "object", properties: { content: { type: "string" } }, required: ["content"] },
    execute: async (a) => {
      const content = str(a.content);
      if (!content) return JSON.stringify({ error: "content 必填" });
      await useActivityStore.getState().addActivity(content); // 内含 db 写入 + emitSync
      return JSON.stringify({ logged: { content } });
    },
  },
];

/** name → tool 映射 */
const TOOL_MAP: Record<string, ChatTool> = Object.fromEntries(
  CHAT_TOOLS.map((t) => [t.name, t])
);

/** 执行一个工具调用，返回给模型的结果文本（出错也返回 JSON，不抛） */
export async function runChatTool(name: string, args: Record<string, unknown>): Promise<string> {
  const tool = TOOL_MAP[name];
  if (!tool) return JSON.stringify({ error: `未知工具: ${name}` });
  try {
    return await tool.execute(args ?? {});
  } catch (e) {
    return JSON.stringify({ error: `工具 ${name} 执行失败: ${String(e)}` });
  }
}

/** 转成 OpenAI / DeepSeek 的 tools 参数格式 */
export function toolsForLLM() {
  return CHAT_TOOLS.map((t) => ({
    type: "function" as const,
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
}
