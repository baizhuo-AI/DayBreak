import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import {
  Sparkles,
  Loader2,
  X,
  CheckCircle2
} from "lucide-react";
import { newTodoId, useTodoStore, type Todo } from "../lib/store";
import { parseTask } from "../lib/llm";
import { onSync } from "../lib/syncBus";
import { dateKey, parseScheduledTime } from "../lib/calendar";
import { cn } from "../lib/utils";
import { toast } from "../lib/toast";

/**
 * 浮窗模式 — 240×400 常驻置顶
 *
 * 内容:
 *  - 顶部:Cmd+K 风格的自然语言输入
 *  - 中间:今日 active 任务列表(已完成不显示,节省空间)
 *  - 底部:进度统计
 *
 * 数据同步:订阅 BroadcastChannel 的 "todos" topic,主 App 改东西时 re-hydrate。
 *
 * 浮窗 URL:#/__floating__,主 App 加载 # 主路由,浮窗加载这个 hash。
 */

function todayKeyOf(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function FloatingApp() {
  const { t } = useTranslation();
  const todos = useTodoStore((s) => s.todos);
  const hydrate = useTodoStore((s) => s.hydrate);
  const addTodo = useTodoStore((s) => s.addTodo);
  const toggleComplete = useTodoStore((s) => s.toggleComplete);
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void hydrate();
    const off = onSync("todos", () => void hydrate());
    return off;
  }, [hydrate]);

  const todayKey = todayKeyOf();
  const activeToday = todos
    .filter((t) => {
      const k = t.scheduledDate ?? dateKey(new Date(t.createdAt));
      return k === todayKey && t.status !== "done";
    })
    .sort(sortByScheduledTime);

  const total = todos.filter((t) => {
    const k = t.scheduledDate ?? dateKey(new Date(t.createdAt));
    return k === todayKey;
  }).length;
  const done = total - activeToday.length;

  async function handleSubmit() {
    if (!value.trim() || submitting) return;
    setSubmitting(true);
    try {
      const parsed = await parseTask(value.trim());
      await addTodo({
        id: newTodoId(),
        title: parsed.title,
        reason: parsed.reason,
        deadline: parsed.deadline,
        priority: parsed.priority,
        tags: parsed.tags,
        estTime: parsed.estTime,
        scheduledTime: parsed.scheduledTime,
        scheduledDate: todayKey,
        status: "todo",
        createdAt: new Date().toISOString()
      });
      setValue("");
      if (parsed.parsed) {
        toast.success(t("floating.added"));
      } else {
        toast.warning(t("floating.addedNoParse"));
      }
    } catch (err) {
      console.error("[Floating] submit failed:", err);
      toast.error(t("floating.addFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="h-screen flex flex-col bg-bg text-text overflow-hidden">
      {/* 顶部:可拖动条 + 输入 */}
      <header
        data-tauri-drag-region
        className="px-3 pt-3 pb-2 border-b border-zinc-200 dark:border-zinc-800 flex-shrink-0"
      >
        <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2 select-none">
          {t("floating.title")}
        </div>
        <div className="relative">
          <Sparkles
            className={cn(
              "absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 transition-colors",
              value
                ? "text-indigo-500 dark:text-indigo-400"
                : "text-zinc-400 dark:text-zinc-500"
            )}
          />
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !submitting) {
                e.preventDefault();
                void handleSubmit();
              }
            }}
            disabled={submitting}
            placeholder={t("floating.placeholder")}
            className={cn(
              "w-full pl-7 pr-7 py-1.5 rounded-md text-sm outline-none transition-colors",
              "bg-zinc-100 dark:bg-zinc-900",
              "border border-transparent",
              "focus:bg-white dark:focus:bg-zinc-950 focus:border-indigo-500",
              "text-zinc-900 dark:text-zinc-100",
              "placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
            )}
          />
          {submitting && (
            <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-indigo-500" />
          )}
        </div>
      </header>

      {/* 任务列表 */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="px-2 py-2 space-y-1">
          {activeToday.length === 0 ? (
            <div className="px-3 py-12 text-center text-xs text-zinc-400 dark:text-zinc-500">
              {t("floating.empty")}
            </div>
          ) : (
            activeToday.map((todo) => (
              <TodoLine
                key={todo.id}
                todo={todo}
                onToggle={() => void toggleComplete(todo.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* 底部:进度 */}
      <footer className="px-3 py-2 border-t border-zinc-200 dark:border-zinc-800 flex-shrink-0 flex items-center justify-between text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
        <span>{t("floating.progress", { done, total })}</span>
        {done > 0 && (
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
        )}
      </footer>
    </div>
  );
}

function sortByScheduledTime(a: Todo, b: Todo): number {
  const ra = parseScheduledTime(a.scheduledTime);
  const rb = parseScheduledTime(b.scheduledTime);
  if (ra && rb) return ra.startMin - rb.startMin;
  if (ra) return -1;
  if (rb) return 1;
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}

function TodoLine({
  todo,
  onToggle
}: {
  todo: Todo;
  onToggle: () => void;
}) {
  return (
    <motion.div
      layout
      className={cn(
        "group flex items-start gap-2 px-2 py-1.5 rounded-md transition-colors",
        "hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-3.5 h-3.5 mt-0.5 rounded-full border flex-shrink-0 border-zinc-300 dark:border-zinc-700 hover:border-emerald-500 hover:bg-emerald-500/10 transition-colors"
        aria-label="complete"
      />
      <div className="flex-1 min-w-0">
        {todo.scheduledTime && (
          <span className="inline-block text-[10px] font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-1 py-0.5 rounded mb-0.5">
            {todo.scheduledTime}
          </span>
        )}
        <div className="text-xs leading-snug text-zinc-900 dark:text-zinc-100 line-clamp-2">
          {todo.title}
        </div>
      </div>
    </motion.div>
  );
}
