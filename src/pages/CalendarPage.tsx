import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "motion/react";
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Loader2
} from "lucide-react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent
} from "@dnd-kit/core";
import { useTodoStore, type Todo, type Priority } from "../lib/store";
import { generateTodayPlan } from "../lib/llm";
import { toast } from "../lib/toast";
import {
  addDays,
  addMonths,
  dateKey,
  formatHM,
  isSameDay,
  monthLabel,
  monthMatrix,
  parseScheduledTime,
  snapMinutes,
  startOfDay,
  startOfWeek,
  weekDays,
  weekLabel
} from "../lib/calendar";
import { cn } from "../lib/utils";

/**
 * 日历页 - 月/周视图 + AI 排今日 + 拖拽改时段
 *
 * 视图切换:
 *  - 月:7×6 日格,日格上小圆点+任务数;点格切到周
 *  - 周:7 列日 × 时间网格(8:00-22:00),任务卡按 scheduledTime 绝对定位
 *
 * 拖拽:
 *  - 周视图任务卡可拖到不同时段或不同天(基于 delta.y,自动吸附到 15 min)
 *  - 未排期 sidebar 卡片可拖到时间格(默认占该天 60 min,从 9:00 开始排起)
 *  - 跨工作时段 8-22 时会 clamp 到边界
 *
 * AI 排今日:把当天未完成且非 push-back 的 todos 送 LLM,重新排 scheduledTime。
 */

type ViewMode = "month" | "week";

const HOUR_HEIGHT = 56;
const DAY_START_HOUR = 0;
const DAY_END_HOUR = 24;
const VIEW_HEIGHT = (DAY_END_HOUR - DAY_START_HOUR) * HOUR_HEIGHT;
const MIN_TASK_MIN = 15;
/** 视图打开时默认滚到的 hour(让用户落地直接看工作时段) */
const INITIAL_SCROLL_HOUR = 7;

export function CalendarPage() {
  const { t, i18n } = useTranslation();
  const lang: "zh" | "en" = i18n.language?.startsWith("en") ? "en" : "zh";
  const todos = useTodoStore((s) => s.todos);
  const applySchedules = useTodoStore((s) => s.applySchedules);

  const [view, setView] = useState<ViewMode>("week");
  const [anchor, setAnchor] = useState<Date>(() => startOfDay(new Date()));
  const [aiBusy, setAiBusy] = useState(false);
  const [draggingTodo, setDraggingTodo] = useState<Todo | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  const todosByDate = useMemo(() => {
    const map = new Map<string, Todo[]>();
    for (const todo of todos) {
      const key = todo.scheduledDate ?? dateKey(new Date(todo.createdAt));
      const list = map.get(key) ?? [];
      list.push(todo);
      map.set(key, list);
    }
    return map;
  }, [todos]);

  function navPrev() {
    setAnchor(view === "month" ? addMonths(anchor, -1) : addDays(anchor, -7));
  }
  function navNext() {
    setAnchor(view === "month" ? addMonths(anchor, 1) : addDays(anchor, 7));
  }
  function navToday() {
    setAnchor(startOfDay(new Date()));
  }

  async function handleAiPlan() {
    if (aiBusy) return;
    const today = startOfDay(new Date());
    const todayKey = dateKey(today);
    const candidates = todos.filter(
      (todo) =>
        todo.status !== "done" &&
        !todo.isPushBackSuggestion &&
        (todo.scheduledDate ?? dateKey(new Date(todo.createdAt))) === todayKey
    );
    if (candidates.length === 0) {
      toast.info("今天没有可排的任务");
      return;
    }
    setAiBusy(true);
    try {
      await generateTodayPlan(candidates);
      toast.success(`AI 已排好今天 ${candidates.length} 条任务`);
    } catch (err) {
      console.error("[Calendar] AI plan failed:", err);
      toast.error("AI 排今日失败,详情见 console");
    } finally {
      setAiBusy(false);
    }
  }

  function handleDragStart(e: DragStartEvent) {
    const id = String(e.active.id).replace(/^unscheduled-/, "");
    const todo = todos.find((t) => t.id === id);
    setDraggingTodo(todo ?? null);
  }

  function handleDragEnd(e: DragEndEvent) {
    setDraggingTodo(null);
    const overId = e.over?.id;
    if (!overId) return;

    const activeIdRaw = String(e.active.id);
    const isUnscheduled = activeIdRaw.startsWith("unscheduled-");
    const todoId = activeIdRaw.replace(/^unscheduled-/, "");
    const todo = todos.find((t) => t.id === todoId);
    if (!todo) return;

    // overId 形如 "day-2026-05-11"
    const m = String(overId).match(/^day-(\d{4}-\d{2}-\d{2})$/);
    if (!m) return;
    const targetDateKey = m[1];

    // 计算时段
    const deltaY = e.delta.y;
    const orig = parseScheduledTime(todo.scheduledTime);
    let newStartMin: number;
    let durationMin: number;

    if (isUnscheduled || !orig) {
      // 未排期 → 给默认时段(从工作时段开始,1h);后续可改成 mouse-aware
      newStartMin = DAY_START_HOUR * 60 + Math.max(0, Math.round(deltaY / HOUR_HEIGHT * 60));
      durationMin = parseEstMinutes(todo.estTime) ?? 60;
    } else {
      // 已排期 → 按 deltaY 位移
      newStartMin = orig.startMin + Math.round(deltaY / HOUR_HEIGHT * 60);
      durationMin = orig.endMin - orig.startMin;
    }

    // 15min 吸附
    newStartMin = snapMinutes(newStartMin, 15);

    // clamp 到工作时段 8-22
    const minStart = DAY_START_HOUR * 60;
    const maxEnd = DAY_END_HOUR * 60;
    durationMin = Math.max(MIN_TASK_MIN, durationMin);
    if (newStartMin < minStart) newStartMin = minStart;
    if (newStartMin + durationMin > maxEnd) {
      newStartMin = Math.max(minStart, maxEnd - durationMin);
    }

    const newScheduledTime = `${formatHM(newStartMin)}-${formatHM(newStartMin + durationMin)}`;
    void applySchedules([
      {
        id: todo.id,
        scheduledTime: newScheduledTime,
        scheduledDate: targetDateKey
      }
    ]);
  }

  return (
    <div className="h-full flex flex-col">
      {/* 顶部:导航 + 视图 + AI */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-10 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md flex-shrink-0 px-6 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={navPrev}
            className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label="prev"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={navToday}
            className="px-2.5 py-1 text-xs font-medium rounded-md text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors border border-zinc-200 dark:border-zinc-800"
          >
            {t("calendar.today")}
          </button>
          <button
            type="button"
            onClick={navNext}
            className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label="next"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <h1 className="ml-2 text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            {view === "month"
              ? monthLabel(anchor, lang)
              : weekLabel(
                  startOfWeek(anchor),
                  addDays(startOfWeek(anchor), 6),
                  lang
                )}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-zinc-100 dark:bg-zinc-900 rounded-lg p-1">
            <ViewTab
              active={view === "week"}
              onClick={() => setView("week")}
              label={t("calendar.view.week")}
            />
            <ViewTab
              active={view === "month"}
              onClick={() => setView("month")}
              label={t("calendar.view.month")}
            />
          </div>
          <button
            type="button"
            onClick={() => void handleAiPlan()}
            disabled={aiBusy}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
              "text-white bg-indigo-500 hover:bg-indigo-600",
              "disabled:opacity-60 disabled:cursor-not-allowed"
            )}
          >
            {aiBusy ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>
              {aiBusy ? t("calendar.aiPlanning") : t("calendar.aiPlanToday")}
            </span>
          </button>
        </div>
      </header>

      {/* 视图区 */}
      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          {view === "month" ? (
            <motion.div
              key="month"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="h-full overflow-auto"
            >
              <MonthView
                anchor={anchor}
                todosByDate={todosByDate}
                onDayClick={(d) => {
                  setAnchor(d);
                  setView("week");
                }}
                weekdayLabels={getWeekdayLabels(t)}
              />
            </motion.div>
          ) : (
            <motion.div
              key="week"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="h-full overflow-hidden flex"
            >
              <DndContext
                sensors={sensors}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragCancel={() => setDraggingTodo(null)}
              >
                <WeekView
                  anchor={anchor}
                  todosByDate={todosByDate}
                  weekdayLabels={getWeekdayLabels(t)}
                />
                <DragOverlay dropAnimation={null}>
                  {draggingTodo ? (
                    <div
                      className={cn(
                        "rounded-md p-1.5 shadow-lg w-48",
                        priorityCardCls(draggingTodo.priority)
                      )}
                    >
                      <div className="text-[10px] font-mono opacity-80">
                        {draggingTodo.scheduledTime ?? t("calendar.noScheduled")}
                      </div>
                      <div className="text-xs font-medium leading-tight mt-0.5 line-clamp-2">
                        {draggingTodo.title}
                      </div>
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ---------- 子组件 ---------- */

function ViewTab({
  active,
  onClick,
  label
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 py-1 text-xs font-medium rounded-md transition-colors",
        active
          ? "bg-white dark:bg-zinc-800 shadow-sm text-zinc-900 dark:text-zinc-100"
          : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
      )}
    >
      {label}
    </button>
  );
}

/* ---------- Month View ---------- */

function MonthView({
  anchor,
  todosByDate,
  onDayClick,
  weekdayLabels
}: {
  anchor: Date;
  todosByDate: Map<string, Todo[]>;
  onDayClick: (d: Date) => void;
  weekdayLabels: string[];
}) {
  const matrix = useMemo(
    () => monthMatrix(anchor.getFullYear(), anchor.getMonth()),
    [anchor]
  );
  const today = startOfDay(new Date());
  const currentMonth = anchor.getMonth();

  return (
    <div className="px-6 py-4">
      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekdayLabels.map((label) => (
          <div
            key={label}
            className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 text-center py-2"
          >
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {matrix.map((d) => {
          const inMonth = d.getMonth() === currentMonth;
          const isToday = isSameDay(d, today);
          const tasks = todosByDate.get(dateKey(d)) ?? [];
          return (
            <button
              key={d.toISOString()}
              type="button"
              onClick={() => onDayClick(d)}
              className={cn(
                "aspect-square min-h-[80px] flex flex-col items-start p-2 rounded-lg border transition-colors text-left",
                inMonth
                  ? "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                  : "bg-zinc-50 dark:bg-zinc-950 border-zinc-100 dark:border-zinc-900 opacity-60",
                "hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
              )}
            >
              <span
                className={cn(
                  "text-xs font-semibold mb-1 inline-flex items-center justify-center w-6 h-6 rounded-full",
                  isToday
                    ? "bg-indigo-500 text-white"
                    : inMonth
                      ? "text-zinc-700 dark:text-zinc-300"
                      : "text-zinc-400 dark:text-zinc-600"
                )}
              >
                {d.getDate()}
              </span>
              {tasks.length > 0 && (
                <div className="flex flex-wrap gap-0.5 max-h-12 overflow-hidden">
                  {tasks.slice(0, 4).map((todo) => (
                    <span
                      key={todo.id}
                      className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        priorityDotCls(todo.priority),
                        todo.status === "done" && "opacity-30"
                      )}
                      title={todo.title}
                    />
                  ))}
                  {tasks.length > 4 && (
                    <span className="text-[10px] text-zinc-400 leading-none">
                      +{tasks.length - 4}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Week View ---------- */

function WeekView({
  anchor,
  todosByDate,
  weekdayLabels
}: {
  anchor: Date;
  todosByDate: Map<string, Todo[]>;
  weekdayLabels: string[];
}) {
  const days = useMemo(() => weekDays(anchor), [anchor]);
  const today = startOfDay(new Date());
  const scrollerRef = useRef<HTMLDivElement>(null);

  // 当前时刻分钟数(刷新触发渲染)
  const [nowMin, setNowMin] = useState(() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  });

  // 每 60 秒更新当前时刻横线位置
  useEffect(() => {
    const id = setInterval(() => {
      const n = new Date();
      setNowMin(n.getHours() * 60 + n.getMinutes());
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  // 进入周视图自动滚动到 INITIAL_SCROLL_HOUR(让用户落地直接看到工作时段)
  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop =
        (INITIAL_SCROLL_HOUR - DAY_START_HOUR) * HOUR_HEIGHT;
    }
  }, [anchor]);

  // 未排期(本周内有 scheduledDate 但没 parse 成功的 scheduledTime)
  const unscheduled: Array<{ date: Date; todo: Todo }> = [];
  for (const d of days) {
    const list = todosByDate.get(dateKey(d)) ?? [];
    for (const todo of list) {
      const range = parseScheduledTime(todo.scheduledTime);
      if (!range) unscheduled.push({ date: d, todo });
    }
  }

  return (
    <>
      <div ref={scrollerRef} className="flex-1 overflow-auto">
        {/* sticky 头部 */}
        <div className="grid grid-cols-[60px_repeat(7,minmax(0,1fr))] sticky top-0 z-10 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
          <div />
          {days.map((d, i) => {
            const isToday = isSameDay(d, today);
            return (
              <div
                key={d.toISOString()}
                className={cn(
                  "px-2 py-2 text-center border-l border-zinc-100 dark:border-zinc-800/60",
                  isToday && "bg-indigo-50/40 dark:bg-indigo-500/5"
                )}
              >
                <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  {weekdayLabels[i]}
                </div>
                <div
                  className={cn(
                    "mt-0.5 inline-flex items-center justify-center w-6 h-6 rounded-full text-sm font-semibold",
                    isToday
                      ? "bg-indigo-500 text-white"
                      : "text-zinc-700 dark:text-zinc-300"
                  )}
                >
                  {d.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* 时间网格主体 */}
        <div
          className="grid grid-cols-[60px_repeat(7,minmax(0,1fr))] relative"
          style={{ height: VIEW_HEIGHT }}
        >
          {/* 时间标尺 */}
          <div className="relative">
            {Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, i) => (
              <div
                key={i}
                className="absolute right-2 text-[10px] font-mono text-zinc-400 dark:text-zinc-500"
                style={{ top: i * HOUR_HEIGHT - 6 }}
              >
                {String(DAY_START_HOUR + i).padStart(2, "0")}:00
              </div>
            ))}
          </div>

          {/* 7 列日(各自为 droppable) */}
          {days.map((d) => {
            const list = todosByDate.get(dateKey(d)) ?? [];
            const isToday = isSameDay(d, today);
            return (
              <DayColumn
                key={d.toISOString()}
                date={d}
                isToday={isToday}
                tasks={list}
                nowMin={isToday ? nowMin : null}
              />
            );
          })}
        </div>
      </div>

      <UnscheduledSidebar items={unscheduled} />
    </>
  );
}

function DayColumn({
  date,
  isToday,
  tasks,
  nowMin
}: {
  date: Date;
  isToday: boolean;
  tasks: Todo[];
  /** 仅"今天那列"传非 null:用于画当前时刻红色横线 */
  nowMin: number | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${dateKey(date)}` });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "relative border-l border-zinc-100 dark:border-zinc-800/60 transition-colors",
        isToday && "bg-indigo-50/20 dark:bg-indigo-500/[0.03]",
        isOver && "bg-indigo-100/50 dark:bg-indigo-500/10"
      )}
    >
      {/* 小时分隔线 */}
      {Array.from({ length: DAY_END_HOUR - DAY_START_HOUR + 1 }, (_, i) => (
        <div
          key={i}
          className="absolute left-0 right-0 border-t border-zinc-100 dark:border-zinc-800/40"
          style={{ top: i * HOUR_HEIGHT }}
        />
      ))}
      {/* 当前时刻红色横线 */}
      {nowMin != null && (
        <div
          className="absolute left-0 right-0 z-10 pointer-events-none"
          style={{ top: ((nowMin - DAY_START_HOUR * 60) / 60) * HOUR_HEIGHT }}
        >
          <div className="relative">
            <div className="h-px bg-red-500" />
            <div className="absolute -top-1 -left-1 w-2 h-2 rounded-full bg-red-500" />
          </div>
        </div>
      )}
      {/* 任务卡片 */}
      {tasks.map((todo) => {
        const range = parseScheduledTime(todo.scheduledTime);
        if (!range) return null;
        const startOffsetMin = range.startMin - DAY_START_HOUR * 60;
        const durationMin = range.endMin - range.startMin;
        const top = (startOffsetMin / 60) * HOUR_HEIGHT;
        const height = Math.max(24, (durationMin / 60) * HOUR_HEIGHT);
        if (top + height < 0 || top > VIEW_HEIGHT) return null;
        return (
          <DraggableTaskBlock
            key={todo.id}
            todo={todo}
            range={range}
            top={top}
            height={height}
          />
        );
      })}
    </div>
  );
}

function DraggableTaskBlock({
  todo,
  range,
  top,
  height
}: {
  todo: Todo;
  range: { startMin: number; endMin: number };
  top: number;
  height: number;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: todo.id
  });
  const isDone = todo.status === "done";

  return (
    <div
      ref={setNodeRef}
      style={{
        top,
        height,
        left: 4,
        right: 4,
        position: "absolute",
        opacity: isDragging ? 0.3 : 1
      }}
      {...listeners}
      {...attributes}
      className={cn(
        "rounded-md p-1.5 overflow-hidden cursor-grab active:cursor-grabbing transition-shadow",
        priorityCardCls(todo.priority),
        isDone && "opacity-50",
        "hover:shadow-md"
      )}
      title={todo.title}
    >
      <div className="text-[10px] font-mono opacity-80">
        {formatHM(range.startMin)} – {formatHM(range.endMin)}
      </div>
      <div
        className={cn(
          "text-xs font-medium leading-tight mt-0.5 line-clamp-2",
          isDone && "line-through"
        )}
      >
        {todo.title}
      </div>
    </div>
  );
}

function UnscheduledSidebar({
  items
}: {
  items: Array<{ date: Date; todo: Todo }>;
}) {
  const { t } = useTranslation();
  if (items.length === 0) return null;
  return (
    <aside className="w-56 flex-shrink-0 border-l border-zinc-200 dark:border-zinc-800 overflow-y-auto bg-zinc-50/50 dark:bg-zinc-900/30">
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 bg-zinc-50/80 dark:bg-zinc-900/80 backdrop-blur-md">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          {t("calendar.unscheduledHeader", { count: items.length })}
        </h3>
        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1">
          {t("calendar.unscheduledHint")}
        </p>
      </div>
      <div className="px-3 py-3 space-y-2">
        {items.map(({ date, todo }) => (
          <UnscheduledCard key={todo.id} date={date} todo={todo} />
        ))}
      </div>
    </aside>
  );
}

function UnscheduledCard({ date, todo }: { date: Date; todo: Todo }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `unscheduled-${todo.id}`
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "p-2 rounded-md cursor-grab active:cursor-grabbing transition-colors",
        "bg-white dark:bg-zinc-900",
        "border border-zinc-200 dark:border-zinc-800",
        "hover:border-indigo-400 dark:hover:border-indigo-500",
        todo.status === "done" && "opacity-50",
        isDragging && "opacity-30"
      )}
      title={todo.title}
    >
      <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium mb-0.5">
        {date.getMonth() + 1}/{date.getDate()}
        {todo.estTime ? ` · ${todo.estTime}` : ""}
      </div>
      <div
        className={cn(
          "text-xs leading-tight line-clamp-2",
          todo.status === "done"
            ? "text-zinc-400 dark:text-zinc-500 line-through"
            : "text-zinc-900 dark:text-zinc-100"
        )}
      >
        {todo.title}
      </div>
    </div>
  );
}

/* ---------- helpers ---------- */

function priorityDotCls(p: Priority): string {
  switch (p) {
    case "high":
      return "bg-red-500";
    case "medium":
      return "bg-amber-500";
    case "low":
      return "bg-emerald-500";
    case "none":
    default:
      return "bg-zinc-400 dark:bg-zinc-500";
  }
}

function priorityCardCls(p: Priority): string {
  switch (p) {
    case "high":
      return "bg-red-50 text-red-900 border-l-2 border-red-500 dark:bg-red-950/30 dark:text-red-200 dark:border-red-500";
    case "medium":
      return "bg-amber-50 text-amber-900 border-l-2 border-amber-500 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-500";
    case "low":
      return "bg-emerald-50 text-emerald-900 border-l-2 border-emerald-500 dark:bg-emerald-950/30 dark:text-emerald-200 dark:border-emerald-500";
    case "none":
    default:
      return "bg-indigo-50 text-indigo-900 border-l-2 border-indigo-500 dark:bg-indigo-950/30 dark:text-indigo-200 dark:border-indigo-400";
  }
}

function getWeekdayLabels(
  t: (k: string, opts?: Record<string, unknown>) => unknown
): string[] {
  const v = t("calendar.weekdays", { returnObjects: true });
  return Array.isArray(v)
    ? (v as string[])
    : ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
}

function parseEstMinutes(s: string | undefined): number | null {
  if (!s) return null;
  const m = s.trim().match(/^([\d.]+)\s*(h|m)$/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (Number.isNaN(n)) return null;
  return Math.round(m[2].toLowerCase() === "h" ? n * 60 : n);
}
