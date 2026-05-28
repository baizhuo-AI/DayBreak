/**
 * Calendar 用的日期工具
 *
 * 周一作为一周的起始(中文场景标准),周末是周日。
 * 时间表示统一用 minutes since midnight(0-1439)。
 */

/** "2026-05-09" 格式的日期字符串(本地时区) */
export type DateKey = string;

export function dateKey(date: Date): DateKey {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function addMonths(date: Date, n: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

/**
 * 返回包含 date 的那一周(周一-周日)的 7 个 Date
 */
export function weekDays(date: Date): Date[] {
  const start = startOfWeek(date);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function startOfWeek(date: Date): Date {
  const d = startOfDay(date);
  // getDay():周日=0,周一=1...周六=6。我们要"周一是 0"。
  const dow = (d.getDay() + 6) % 7;
  return addDays(d, -dow);
}

/* ---------- deadline 快捷词 ---------- */

export type QuickDeadlineKind = "today" | "tomorrow" | "thisFri" | "nextMon";

/**
 * deadline 快捷词 → "YYYY-MM-DD"。本周五 = 本周一+4,下周一 = 本周一+7。
 * 传 now 便于单测(默认当前时间)。
 */
export function quickDeadline(kind: QuickDeadlineKind, now: Date = new Date()): DateKey {
  switch (kind) {
    case "today":
      return dateKey(now);
    case "tomorrow":
      return dateKey(addDays(now, 1));
    case "thisFri":
      return dateKey(addDays(startOfWeek(now), 4));
    case "nextMon":
      return dateKey(addDays(startOfWeek(now), 7));
  }
}

/**
 * 返回月视图的 6x7 矩阵(42 个 Date),包含上月尾和下月头填充
 */
export function monthMatrix(year: number, month0: number): Date[] {
  const first = new Date(year, month0, 1);
  const start = startOfWeek(first);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

/* ---------- 时间段 parse ---------- */

export interface TimeRange {
  startMin: number; // 0-1439
  endMin: number; // 0-1439, > startMin
}

/**
 * "09:30-11:00" → { startMin: 570, endMin: 660 }
 * 失败返回 null
 */
export function parseScheduledTime(s: string | undefined): TimeRange | null {
  if (!s) return null;
  const m = s.match(/^\s*(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})\s*$/);
  if (!m) return null;
  const startMin = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  const endMin = parseInt(m[3], 10) * 60 + parseInt(m[4], 10);
  if (
    startMin < 0 ||
    startMin >= 1440 ||
    endMin <= startMin ||
    endMin > 1440
  ) {
    return null;
  }
  return { startMin, endMin };
}

export function formatHM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/* ---------- label ---------- */

/**
 * "2026 年 5 月" / "May 2026"
 */
export function monthLabel(date: Date, lang: "zh" | "en"): string {
  if (lang === "en") {
    return date.toLocaleDateString("en-US", { year: "numeric", month: "long" });
  }
  return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月`;
}

/**
 * "5 月 4-10 日" / "May 4-10"
 */
export function weekLabel(start: Date, end: Date, lang: "zh" | "en"): string {
  if (lang === "en") {
    const m1 = start.toLocaleDateString("en-US", { month: "short" });
    return `${m1} ${start.getDate()}–${end.getDate()}`;
  }
  return `${start.getMonth() + 1} 月 ${start.getDate()}-${end.getDate()} 日`;
}

/* ---------- 工作日内空档/占用计算 ---------- */

export const WORK_START_HOUR = 9;
export const WORK_END_HOUR = 18;

/**
 * 合并重叠时段(范围已按 startMin 升序时也 OK)
 */
export function mergeRanges(ranges: TimeRange[]): TimeRange[] {
  const sorted = [...ranges].sort((a, b) => a.startMin - b.startMin);
  const merged: TimeRange[] = [];
  for (const r of sorted) {
    const last = merged[merged.length - 1];
    if (last && r.startMin <= last.endMin) {
      last.endMin = Math.max(last.endMin, r.endMin);
    } else {
      merged.push({ ...r });
    }
  }
  return merged;
}

/**
 * 给定一组 scheduledTime,计算 9:00-18:00 工作时段内:
 *  - 剩余空档分钟数(总工作 - 已占用)
 *  - 已占用的时段列表(合并重叠后,按时间顺序)
 */
export function workdayUsage(scheduledRanges: TimeRange[]): {
  freeMin: number;
  occupied: TimeRange[];
} {
  const workStart = WORK_START_HOUR * 60;
  const workEnd = WORK_END_HOUR * 60;

  // 裁剪到工作时段
  const clipped = scheduledRanges
    .map((r) => ({
      startMin: Math.max(r.startMin, workStart),
      endMin: Math.min(r.endMin, workEnd)
    }))
    .filter((r) => r.startMin < r.endMin);

  const occupied = mergeRanges(clipped);
  const occupiedMin = occupied.reduce(
    (acc, r) => acc + (r.endMin - r.startMin),
    0
  );

  return {
    freeMin: workEnd - workStart - occupiedMin,
    occupied
  };
}

/**
 * 把分钟数格式化成 "3.5h" / "45m"(去尾 0)
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = minutes / 60;
  // 1.0 → "1h",1.5 → "1.5h",2.25 → "2.3h"
  return `${(Math.round(h * 10) / 10).toString().replace(/\.0$/, "")}h`;
}

/**
 * 把一组时段格式化成 "09:30-11:00, 14:00-15:00"
 */
export function formatRangeList(ranges: TimeRange[]): string {
  return ranges
    .map((r) => `${formatHM(r.startMin)}-${formatHM(r.endMin)}`)
    .join(", ");
}

/**
 * 把分钟数吸附到最近的 step(默认 15 分钟)
 */
export function snapMinutes(minutes: number, step = 15): number {
  return Math.round(minutes / step) * step;
}
