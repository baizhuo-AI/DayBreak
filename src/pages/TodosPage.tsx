import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "motion/react";
import {
  Search,
  Plus,
  Calendar,
  Type,
  Clock,
  LayoutGrid,
  List,
  ChevronRight,
  X,
  ArrowDownAZ,
  Pencil
} from "lucide-react";
import { useTodoStore, type Todo, type Priority } from "../lib/store";
import { cn } from "../lib/utils";
import { NewTaskModal } from "../components/NewTaskModal";

type SortKey = "createdAt" | "deadline" | "priority" | "title";
type FilterPriority = "all" | Priority;

/**
 * 待办管理 - 全量列表视图
 *
 * Active / Done 分组:
 *  - Active 在上,正常显示
 *  - Done 折叠在底部,展开后 hover 出删除按钮
 *  - 头部 + 按钮唤起精确表单 modal(无 LLM,纯手填)
 *
 * P1.5:list 视图 + 精确表单
 * 后续:kanban 视图、搜索过滤、字段排序
 */
export function TodosPage() {
  const { t } = useTranslation();
  const todos = useTodoStore((s) => s.todos);
  const toggleComplete = useTodoStore((s) => s.toggleComplete);
  const removeTodo = useTodoStore((s) => s.removeTodo);
  const [view, setView] = useState<"list" | "kanban">("list");
  const [doneExpanded, setDoneExpanded] = useState(false);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [query, setQuery] = useState("");
  const [filterPriority, setFilterPriority] = useState<FilterPriority>("all");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");

  // 过滤 + 排序
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return todos
      .filter((todo) => {
        if (filterPriority !== "all" && todo.priority !== filterPriority) {
          return false;
        }
        if (q) {
          const inTitle = todo.title.toLowerCase().includes(q);
          const inReason = todo.reason?.toLowerCase().includes(q) ?? false;
          const inTags = todo.tags.some((tag) => tag.toLowerCase().includes(q));
          if (!inTitle && !inReason && !inTags) return false;
        }
        return true;
      })
      .sort(makeSorter(sortKey));
  }, [todos, query, filterPriority, sortKey]);

  const active = visible.filter((todo) => todo.status !== "done");
  const done = visible.filter((todo) => todo.status === "done");

  // 全局快捷键 N(没在输入框中时)→ 唤起新建 modal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        setNewTaskOpen(true);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* 顶部:标题 + 工具条 */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-10 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md flex-shrink-0">
        <div className="px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            {t("todos.title")}
          </h1>

          <div className="flex items-center gap-2">
            <div className="flex bg-zinc-100 dark:bg-zinc-900 rounded-lg p-1">
              <button
                type="button"
                onClick={() => setView("list")}
                className={cn(
                  "p-1.5 rounded-md transition-colors",
                  view === "list"
                    ? "bg-white dark:bg-zinc-800 shadow-sm text-zinc-900 dark:text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                )}
                aria-label={t("todos.viewList")}
              >
                <List className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setView("kanban")}
                className={cn(
                  "p-1.5 rounded-md transition-colors",
                  view === "kanban"
                    ? "bg-white dark:bg-zinc-800 shadow-sm text-zinc-900 dark:text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                )}
                aria-label={t("todos.viewKanban")}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setNewTaskOpen(true)}
              title={t("todos.addTaskHint")}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
                "text-white bg-zinc-900 hover:bg-zinc-800",
                "dark:text-zinc-900 dark:bg-zinc-100 dark:hover:bg-white"
              )}
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">{t("todos.addTask")}</span>
            </button>
          </div>
        </div>

        <div className="px-6 pb-4 flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("todos.search")}
              className={cn(
                "w-full pl-9 pr-4 py-1.5 rounded-lg text-sm outline-none transition-all",
                "bg-zinc-100 dark:bg-zinc-900",
                "border border-transparent",
                "focus:bg-white dark:focus:bg-zinc-950 focus:border-zinc-300 dark:focus:border-zinc-700",
                "text-zinc-900 dark:text-zinc-100",
                "placeholder:text-zinc-500"
              )}
            />
          </div>

          {/* 优先级 filter */}
          <div className="flex bg-zinc-100 dark:bg-zinc-900 rounded-lg p-1">
            {(["all", "high", "medium", "low", "none"] as FilterPriority[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setFilterPriority(p)}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium rounded-md transition-colors",
                  filterPriority === p
                    ? "bg-white dark:bg-zinc-800 shadow-sm text-zinc-900 dark:text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                )}
              >
                {p === "all" ? t("todos.filter.all") : t(`newTask.priority.${p}`)}
              </button>
            ))}
          </div>

          {/* 排序 */}
          <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            <ArrowDownAZ className="w-3.5 h-3.5" />
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className={cn(
                "bg-transparent outline-none cursor-pointer",
                "border border-zinc-200 dark:border-zinc-800 rounded-md px-2 py-1",
                "hover:border-zinc-300 dark:hover:border-zinc-700",
                "text-zinc-700 dark:text-zinc-300"
              )}
            >
              <option value="createdAt">{t("todos.sort.createdAt")}</option>
              <option value="deadline">{t("todos.sort.deadline")}</option>
              <option value="priority">{t("todos.sort.priority")}</option>
              <option value="title">{t("todos.sort.title")}</option>
            </select>
          </div>
        </div>
      </div>

      {/* 列表 */}
      <div className="flex-1 overflow-auto px-6 py-6 scrollbar-thin">
        <div className="max-w-4xl mx-auto">
          {/* 表头 */}
          <div className="grid grid-cols-[1fr_120px_140px_80px] gap-4 mb-3 px-4 text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400 tracking-wider">
            <div>{t("todos.columns.title")}</div>
            <div className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {t("todos.columns.deadline")}
            </div>
            <div className="flex items-center gap-1">
              <Type className="w-3.5 h-3.5" />
              {t("todos.columns.tags")}
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {t("todos.columns.estTime")}
            </div>
          </div>

          {/* Active 列表 */}
          <div className="space-y-1">
            {active.length === 0 && done.length === 0 && (
              <div className="py-16 text-center text-sm text-zinc-500 dark:text-zinc-400">
                {t("todos.empty")}
              </div>
            )}
            {active.map((todo) => (
              <TodoRow
                key={todo.id}
                todo={todo}
                onToggle={() => void toggleComplete(todo.id)}
                onRemove={() => void removeTodo(todo.id)}
                onEdit={() => setEditingTodo(todo)}
                noDeadlineLabel={t("todos.noDeadline")}
              />
            ))}
          </div>

          {/* Done 折叠区 */}
          {done.length > 0 && (
            <div className="mt-8">
              <div className="flex items-center justify-between mb-3 px-4">
                <button
                  type="button"
                  onClick={() => setDoneExpanded((v) => !v)}
                  className="flex items-center gap-2 text-xs font-semibold tracking-wider uppercase text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                >
                  <ChevronRight
                    className={cn(
                      "w-3.5 h-3.5 transition-transform",
                      doneExpanded && "rotate-90"
                    )}
                  />
                  {t("todos.doneSection", { count: done.length })}
                </button>
                {doneExpanded && (
                  <button
                    type="button"
                    onClick={() => {
                      done.forEach((todo) => void removeTodo(todo.id));
                    }}
                    className="text-xs font-medium text-zinc-400 dark:text-zinc-500 hover:text-red-500 transition-colors"
                  >
                    {t("todos.clearDone")}
                  </button>
                )}
              </div>

              <AnimatePresence initial={false}>
                {doneExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-1">
                      {done.map((todo) => (
                        <TodoRow
                          key={todo.id}
                          todo={todo}
                          onToggle={() => void toggleComplete(todo.id)}
                          onRemove={() => void removeTodo(todo.id)}
                          onEdit={() => setEditingTodo(todo)}
                          noDeadlineLabel={t("todos.noDeadline")}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      <NewTaskModal
        open={newTaskOpen || !!editingTodo}
        initial={editingTodo}
        onClose={() => {
          setNewTaskOpen(false);
          setEditingTodo(null);
        }}
      />
    </div>
  );
}

/** 排序器:优先级 high→medium→low→none;deadline 字符串 ascending;createdAt 降序 */
function makeSorter(key: SortKey): (a: Todo, b: Todo) => number {
  const priWeight: Record<Priority, number> = {
    high: 0,
    medium: 1,
    low: 2,
    none: 3
  };
  switch (key) {
    case "priority":
      return (a, b) => priWeight[a.priority] - priWeight[b.priority];
    case "deadline":
      return (a, b) => {
        const av = a.deadline ?? "￿";
        const bv = b.deadline ?? "￿";
        return av.localeCompare(bv);
      };
    case "title":
      return (a, b) => a.title.localeCompare(b.title, "zh");
    case "createdAt":
    default:
      return (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  }
}

/**
 * 一行 todo,Active 和 Done 折叠区共用。
 * 完成态:勾选打绿钩 + 文字划线灰化。
 * Hover:右侧弹出"×"删除按钮(absolute,不挤占 grid)。
 */
function TodoRow({
  todo,
  onToggle,
  onRemove,
  onEdit,
  noDeadlineLabel
}: {
  todo: Todo;
  onToggle: () => void;
  onRemove: () => void;
  onEdit: () => void;
  noDeadlineLabel: string;
}) {
  const isDone = todo.status === "done";
  return (
    <div
      onDoubleClick={onEdit}
      className={cn(
        "group relative grid grid-cols-[1fr_120px_140px_80px] gap-4 items-center px-4 py-3 transition-all rounded-xl cursor-default",
        "bg-white dark:bg-zinc-900",
        "border border-zinc-200 dark:border-zinc-800",
        "hover:bg-zinc-50 dark:hover:bg-zinc-800/50",
        isDone && "opacity-60"
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            "w-4 h-4 rounded border flex-shrink-0 transition-colors",
            isDone
              ? "bg-emerald-500 border-emerald-500"
              : "border-zinc-300 dark:border-zinc-700 hover:border-emerald-500 hover:bg-emerald-500/10"
          )}
          aria-label="complete"
        />
        <span
          className={cn(
            "text-sm font-medium truncate",
            isDone
              ? "text-zinc-400 dark:text-zinc-500 line-through decoration-zinc-400"
              : "text-zinc-900 dark:text-zinc-100"
          )}
        >
          {todo.title}
        </span>
      </div>
      <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
        {todo.deadline ?? noDeadlineLabel}
      </div>
      <div className="flex flex-wrap gap-1">
        {todo.tags.map((tag) => (
          <span
            key={tag}
            className="text-xs bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 px-1.5 py-0.5 rounded truncate max-w-[100px]"
          >
            {tag}
          </span>
        ))}
      </div>
      <div className="text-xs text-zinc-500 dark:text-zinc-400">
        {todo.estTime ?? "-"}
      </div>

      {/* hover 右侧浮出 编辑 + 删除 两个按钮（absolute 不挤 grid） */}
      <button
        type="button"
        onClick={onEdit}
        className="absolute right-10 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 rounded text-zinc-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-all"
        aria-label="edit"
        title="编辑"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 rounded text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-all"
        aria-label="delete"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
