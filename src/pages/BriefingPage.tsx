import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "motion/react";
import {
  GripVertical,
  Info,
  FileClock,
  X,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Sparkles
} from "lucide-react";
import { useTodoStore, type Todo } from "../lib/store";
import { cn } from "../lib/utils";
import {
  dateKey,
  formatDuration,
  formatRangeList,
  parseScheduledTime,
  workdayUsage,
  type TimeRange
} from "../lib/calendar";
import { generateTodayPlan } from "../lib/llm";
import { useConfirm } from "../components/ConfirmDialog";
import { toast } from "../lib/toast";

/**
 * 早安页 - 产品定位的"门面"
 *
 * 真实数据(不再写死):
 *  - "今日空档 Xh"由 workdayUsage(9-18 工作时段 - 已占用)计算
 *  - "已预定 HH:MM-HH:MM"列出今日合并后的占用时段
 *  - "今日方案"按 scheduledTime 升序排,无 scheduledTime 的排在末尾
 *  - 底部"重新生成"按钮真接 generateTodayPlan(LLM)
 */
export function BriefingPage() {
  const { t } = useTranslation();
  const todos = useTodoStore((s) => s.todos);
  const toggleComplete = useTodoStore((s) => s.toggleComplete);
  const removeTodo = useTodoStore((s) => s.removeTodo);
  const confirm = useConfirm();
  const [regenBusy, setRegenBusy] = useState(false);

  // 今天的 todos(scheduledDate=today 或 fallback createdAt=today)
  const todayKey = dateKey(new Date());
  const todayTodos = useMemo(
    () =>
      todos.filter((todo) => {
        const key = todo.scheduledDate ?? dateKey(new Date(todo.createdAt));
        return key === todayKey;
      }),
    [todos, todayKey]
  );

  const plans = useMemo(
    () =>
      todayTodos
        .filter(
          (todo) =>
            todo.status !== "done" &&
            !todo.isProcrastinated &&
            !todo.isPushBackSuggestion
        )
        .sort(planSorter),
    [todayTodos]
  );
  const procrastinated = todayTodos.filter(
    (todo) => todo.isProcrastinated && todo.status !== "done"
  );
  const pushbacks = todayTodos.filter(
    (todo) => todo.isPushBackSuggestion && todo.status !== "done"
  );
  const completed = todayTodos.filter((todo) => todo.status === "done");

  // 今日空档/已预定:基于真 scheduledTime 计算
  const { freeMin, occupied } = useMemo(() => {
    const ranges = todayTodos
      .filter((todo) => todo.status !== "done")
      .map((todo) => parseScheduledTime(todo.scheduledTime))
      .filter((r): r is TimeRange => r !== null);
    return workdayUsage(ranges);
  }, [todayTodos]);

  const today = new Date();
  const dateLabel = `${today.getMonth() + 1}/${today.getDate()},${
    ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][today.getDay()]
  }`;

  async function handleRegenerate() {
    if (regenBusy) return;
    const candidates = todayTodos.filter(
      (todo) => todo.status !== "done" && !todo.isPushBackSuggestion
    );
    if (candidates.length === 0) {
      toast.info("今天没有可重新规划的任务");
      return;
    }
    setRegenBusy(true);
    try {
      await generateTodayPlan(candidates);
      toast.success("已重新规划今天");
    } catch (err) {
      console.error("[Briefing] regenerate failed:", err);
      toast.error("重新生成失败,详情见 console");
    } finally {
      setRegenBusy(false);
    }
  }

  async function handleDelete(id: string, title: string) {
    const ok = await confirm({
      title: t("briefing.actions.delete"),
      message: t("common.deleteConfirm", { title }),
      confirmLabel: t("briefing.actions.delete"),
      destructive: true
    });
    if (ok) void removeTodo(id);
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      {/* 标题 */}
      <div className="mb-10">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2 tracking-tight">
          {t("briefing.greeting", { date: dateLabel })}
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {t("briefing.subtitle")}
        </p>
      </div>

      <div className="space-y-10">
        {/* 今日空档(真实计算) */}
        <section className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg text-emerald-600 dark:text-emerald-400 flex-shrink-0">
            <FileClock className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
              {t("briefing.freeTime.label", { hours: formatDuration(freeMin) })}
            </h3>
            <p className="text-xs text-emerald-700/70 dark:text-emerald-400/70 mt-0.5">
              {occupied.length > 0
                ? t("briefing.freeTime.note", {
                    conflicts: formatRangeList(occupied)
                  })
                : t("briefing.freeTime.empty")}
            </p>
          </div>
        </section>

        {/* 今日方案 */}
        <section>
          <h2 className="text-xs font-semibold tracking-wider uppercase text-zinc-500 dark:text-zinc-400 mb-4">
            {t("briefing.todayPlan")}
          </h2>
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-2 shadow-sm">
            {plans.map((todo) => (
              <PlanRow
                key={todo.id}
                todo={todo}
                onComplete={() => toggleComplete(todo.id)}
              />
            ))}
            {plans.length === 0 && (
              <div className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                {t("briefing.empty")}
              </div>
            )}
          </div>
        </section>

        {/* 拖延提醒 */}
        {procrastinated.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold tracking-wider uppercase text-amber-600 dark:text-amber-500/80 mb-4 flex items-center gap-2">
              {t("briefing.procrastinated")}
              <span className="text-xs font-medium normal-case bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded-full tracking-normal">
                {procrastinated.length}
              </span>
            </h2>
            <div className="space-y-3">
              {procrastinated.map((todo) => (
                <ProcrastinatedRow
                  key={todo.id}
                  todo={todo}
                  onDelete={() => void handleDelete(todo.id, todo.title)}
                />
              ))}
            </div>
          </section>
        )}

        {/* 已完成(折叠) */}
        {completed.length > 0 && (
          <CompletedSection
            todos={completed}
            onRemove={(id) => void removeTodo(id)}
            onClearAll={async () => {
              const ok = await confirm({
                title: t("briefing.clearCompleted"),
                message: t("common.clearConfirm", { count: completed.length }),
                confirmLabel: t("briefing.clearCompleted"),
                destructive: true
              });
              if (ok) completed.forEach((todo) => void removeTodo(todo.id));
            }}
          />
        )}

        {/* 建议 push back */}
        {pushbacks.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold tracking-wider uppercase text-zinc-500 dark:text-zinc-400 mb-4">
              {t("briefing.pushBack")}
            </h2>
            <div className="space-y-3">
              {pushbacks.map((todo) => (
                <div
                  key={todo.id}
                  className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 flex gap-3 opacity-70 hover:opacity-100 transition-opacity"
                >
                  <X className="w-4 h-4 text-zinc-400 dark:text-zinc-500 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-200 line-through decoration-zinc-400 dark:decoration-zinc-500">
                      {todo.title}
                    </h3>
                    {todo.reason && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        {todo.reason}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* 底部操作 */}
      <div className="mt-16 flex items-center justify-between border-t border-zinc-200 dark:border-zinc-800 pt-6">
        <button
          type="button"
          className={cn(
            "flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition-colors shadow-sm",
            "text-white bg-zinc-900 hover:bg-zinc-800",
            "dark:text-zinc-900 dark:bg-zinc-100 dark:hover:bg-white"
          )}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>{t("briefing.actions.startToday")}</span>
        </button>
        <button
          type="button"
          onClick={() => void handleRegenerate()}
          disabled={regenBusy || plans.length + procrastinated.length === 0}
          className="flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {regenBusy ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Sparkles className="w-3.5 h-3.5" />
          )}
          {t("briefing.actions.regenerate")}
        </button>
      </div>
    </div>
  );
}

/** 升序排:有 scheduledTime 的按时段开始时间升序;无的排末尾(按 createdAt 升序) */
function planSorter(a: Todo, b: Todo): number {
  const ra = parseScheduledTime(a.scheduledTime);
  const rb = parseScheduledTime(b.scheduledTime);
  if (ra && rb) return ra.startMin - rb.startMin;
  if (ra) return -1;
  if (rb) return 1;
  return (
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

function PlanRow({
  todo,
  onComplete
}: {
  todo: Todo;
  onComplete: () => void;
}) {
  return (
    <motion.div
      layout
      className="group flex gap-3 py-3 border-b border-zinc-100 dark:border-zinc-800/50 last:border-0"
    >
      <div className="pt-1 cursor-move opacity-0 group-hover:opacity-100 transition-opacity">
        <GripVertical className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
      </div>

      <button
        type="button"
        onClick={onComplete}
        className={cn(
          "w-5 h-5 mt-0.5 rounded-full border flex-shrink-0 flex items-center justify-center",
          "border-zinc-300 dark:border-zinc-700",
          "hover:bg-emerald-500/10 hover:border-emerald-500",
          "transition-colors"
        )}
        aria-label="complete"
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {todo.scheduledTime && (
                <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-1.5 py-0.5 rounded">
                  {todo.scheduledTime}
                </span>
              )}
              <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                {todo.title}
              </h3>
            </div>
            {todo.reason && (
              <div className="mt-1 flex items-start gap-1.5">
                <Info className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {todo.reason}
                </p>
              </div>
            )}
          </div>
          {todo.estTime && (
            <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800/50 flex-shrink-0">
              {todo.estTime}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/**
 * 已完成折叠区
 */
function CompletedSection({
  todos,
  onRemove,
  onClearAll
}: {
  todos: Todo[];
  onRemove: (id: string) => void;
  onClearAll: () => void;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-2 text-xs font-semibold tracking-wider uppercase text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
        >
          <ChevronRight
            className={cn(
              "w-3.5 h-3.5 transition-transform",
              expanded && "rotate-90"
            )}
          />
          {t("briefing.completed", { count: todos.length })}
        </button>
        {expanded && todos.length > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            className="text-xs font-medium text-zinc-400 dark:text-zinc-500 hover:text-red-500 transition-colors"
          >
            {t("briefing.clearCompleted")}
          </button>
        )}
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="ml-5 space-y-1">
              {todos.map((todo) => (
                <div
                  key={todo.id}
                  className="group flex items-center gap-3 py-2 border-b border-zinc-100 dark:border-zinc-800/50 last:border-0"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400 flex-shrink-0" />
                  <span className="flex-1 text-sm text-zinc-400 dark:text-zinc-500 line-through decoration-zinc-300 dark:decoration-zinc-700 truncate">
                    {todo.title}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemove(todo.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-all"
                    aria-label="delete"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function ProcrastinatedRow({
  todo,
  onDelete
}: {
  todo: Todo;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const toggleComplete = useTodoStore((s) => s.toggleComplete);
  const days = Math.max(
    1,
    Math.floor(
      (Date.now() - new Date(todo.createdAt).getTime()) / (24 * 60 * 60 * 1000)
    )
  );

  return (
    <div className="border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20 rounded-xl p-3">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-medium text-amber-900 dark:text-amber-200">
          {todo.title}
        </h3>
        <span className="text-xs text-amber-700 dark:text-amber-400/70 bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 rounded font-medium flex-shrink-0">
          {t("briefing.procrastinatedFor", { days })}
        </span>
      </div>
      {todo.reason && (
        <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-1.5">
          {todo.reason}
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => void toggleComplete(todo.id)}
          className="text-xs font-medium text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40 hover:bg-amber-200 dark:hover:bg-amber-900/70 px-2.5 py-1 rounded-md transition-colors"
        >
          {t("briefing.actions.doNow")}
        </button>
        <button
          type="button"
          className="text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 px-2.5 py-1 rounded-md transition-colors"
          title="P2 接入 LLM 后:把任务排到下周;P1 暂未实现"
        >
          {t("briefing.actions.delayToNextWeek")}
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="text-xs font-medium text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40 px-2.5 py-1 rounded-md transition-colors"
        >
          {t("briefing.actions.delete")}
        </button>
      </div>
    </div>
  );
}
