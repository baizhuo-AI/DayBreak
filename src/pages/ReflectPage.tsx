import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Lightbulb, Sparkles, Loader2, CheckCircle2, AlertTriangle, ListTodo } from "lucide-react";
import { useTodoStore, type Todo } from "../lib/store";
import { useGoalsStore } from "../lib/goalsStore";
import {
  dbListReflections,
  dbUpsertReflection,
  type ReflectionRow,
  type ReflectPeriod
} from "../lib/db";
import { generateReflection } from "../lib/llm";
import { cn } from "../lib/utils";

/**
 * Reflect 页 — 每日/本周反思
 *
 * 上半:周期切换(今日/本周)+ 统计数字 + "生成反思"按钮
 * 下半:LLM 生成的反思内容 + 历史反思列表
 *
 * 反思一周一条 / 一日一条,生成时覆盖该周期已有的(不累积)。
 */

function formatDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** ISO 周编号(简单实现:从年初算到本周的第几周) */
function formatWeekKey(d: Date): string {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (tmp.getUTCDay() + 6) % 7;
  tmp.setUTCDate(tmp.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 4));
  const week =
    1 +
    Math.round(
      ((tmp.getTime() - firstThursday.getTime()) / 86400000 -
        3 +
        ((firstThursday.getUTCDay() + 6) % 7)) /
        7
    );
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function ReflectPage() {
  const { t } = useTranslation();
  const todos = useTodoStore((s) => s.todos);
  const goals = useGoalsStore((s) => s.goals);
  const [period, setPeriod] = useState<ReflectPeriod>("day");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<ReflectionRow[]>([]);

  // 加载 reflections 历史
  useEffect(() => {
    void (async () => {
      try {
        const rows = await dbListReflections(period);
        setHistory(rows);
      } catch (err) {
        console.error("[Reflect] list failed:", err);
      }
    })();
  }, [period]);

  const today = useMemo(() => new Date(), []);
  const todayKey = formatDateKey(today);
  const weekKey = formatWeekKey(today);

  // 计算 stats 用的 todos:今日 = scheduledDate === today,本周 = 这周里
  const inScope = useMemo(() => {
    if (period === "day") {
      return todos.filter((t) => {
        const k = t.scheduledDate ?? formatDateKey(new Date(t.createdAt));
        return k === todayKey;
      });
    } else {
      const weekStart = new Date(today);
      const dow = (weekStart.getDay() + 6) % 7;
      weekStart.setDate(weekStart.getDate() - dow);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      return todos.filter((t) => {
        const dateStr = t.scheduledDate ?? formatDateKey(new Date(t.createdAt));
        const d = new Date(dateStr);
        return d >= weekStart && d < weekEnd;
      });
    }
  }, [todos, period, todayKey, today]);

  const completed = inScope.filter((t) => t.status === "done");
  const pending = inScope.filter((t) => t.status !== "done" && !t.isProcrastinated);
  const procrastinated = inScope.filter((t) => t.isProcrastinated && t.status !== "done");

  const dateLabel = period === "day" ? todayKey : weekKey;
  const currentReflection = history.find(
    (r) => r.date === dateLabel && r.period === period
  );

  async function handleGenerate() {
    if (busy) return;
    setBusy(true);
    try {
      const content = await generateReflection({
        period,
        label: dateLabel,
        completed: completed.map((t) => ({ title: t.title, estTime: t.estTime })),
        pending: pending.map((t) => ({ title: t.title, estTime: t.estTime })),
        procrastinated: procrastinated.map((t) => ({
          title: t.title,
          days: procrastDays(t)
        })),
        goals: goals
          .filter((g) => g.status === "active")
          .map((g) => ({ period: g.period, title: g.title }))
      });
      const rec: ReflectionRow = {
        id: `r${Date.now()}`,
        date: dateLabel,
        period,
        content,
        moodTags: [],
        createdAt: new Date().toISOString()
      };
      await dbUpsertReflection(rec);
      setHistory((h) => [rec, ...h.filter((x) => !(x.date === dateLabel && x.period === period))]);
    } catch (err) {
      console.error("[Reflect] generate failed:", err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="h-full flex flex-col">
      <header className="h-14 px-6 flex items-center border-b border-zinc-200 dark:border-zinc-800 flex-shrink-0 gap-3 justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Lightbulb className="w-4 h-4 text-zinc-400 dark:text-zinc-500 flex-shrink-0" />
          <div className="min-w-0">
            <h1 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              {t("reflect.title")}
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
              {t("reflect.subtitle")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-zinc-100 dark:bg-zinc-900 rounded-lg p-1">
            <PeriodTab
              active={period === "day"}
              onClick={() => setPeriod("day")}
              label={t("reflect.period.day")}
            />
            <PeriodTab
              active={period === "week"}
              onClick={() => setPeriod("week")}
              label={t("reflect.period.week")}
            />
          </div>
          <button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={busy}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
              "text-white bg-indigo-500 hover:bg-indigo-600",
              "disabled:opacity-60 disabled:cursor-not-allowed"
            )}
          >
            {busy ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            {busy ? t("reflect.generating") : t("reflect.generate")}
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-auto scrollbar-thin">
        <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
          {/* Stats */}
          <section className="grid grid-cols-3 gap-3">
            <StatCard
              icon={<CheckCircle2 className="w-4 h-4" />}
              label={t("reflect.stats.completed")}
              value={completed.length}
              tone="emerald"
            />
            <StatCard
              icon={<ListTodo className="w-4 h-4" />}
              label={t("reflect.stats.pending")}
              value={pending.length}
              tone="indigo"
            />
            <StatCard
              icon={<AlertTriangle className="w-4 h-4" />}
              label={t("reflect.stats.procrastinated")}
              value={procrastinated.length}
              tone="amber"
            />
          </section>

          {/* 当前反思 */}
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3">
              {t("reflect.current", { date: dateLabel })}
            </h2>
            <div className={cn(
              "rounded-xl p-5",
              "bg-white dark:bg-zinc-900",
              "border border-zinc-200 dark:border-zinc-800"
            )}>
              {currentReflection ? (
                <div className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-200 whitespace-pre-wrap">
                  {currentReflection.content}
                </div>
              ) : (
                <p className="text-sm text-zinc-400 dark:text-zinc-500 italic">
                  {t("reflect.empty")}
                </p>
              )}
            </div>
          </section>

          {/* 历史 */}
          {history.length > 1 && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3">
                {t("reflect.history")}
              </h2>
              <div className="space-y-3">
                {history
                  .filter((r) => !(r.date === dateLabel && r.period === period))
                  .slice(0, 10)
                  .map((r) => (
                    <div
                      key={r.id}
                      className={cn(
                        "rounded-xl p-4",
                        "bg-zinc-50 dark:bg-zinc-900/50",
                        "border border-zinc-200 dark:border-zinc-800"
                      )}
                    >
                      <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1.5">
                        {r.date}
                      </div>
                      <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-300 whitespace-pre-wrap">
                        {r.content}
                      </p>
                    </div>
                  ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function procrastDays(t: Todo): number {
  return Math.max(
    1,
    Math.floor(
      (Date.now() - new Date(t.createdAt).getTime()) / (24 * 60 * 60 * 1000)
    )
  );
}

function PeriodTab({
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

function StatCard({
  icon,
  label,
  value,
  tone
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "emerald" | "indigo" | "amber";
}) {
  const toneCls = {
    emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/50",
    indigo: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900/50",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300 border-amber-200 dark:border-amber-900/50"
  }[tone];

  return (
    <div className={cn("rounded-xl p-4 border", toneCls)}>
      <div className="flex items-center gap-2 mb-2 opacity-80">
        {icon}
        <span className="text-[11px] font-semibold uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className="text-2xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}
