import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  dateKey,
  monthMatrix,
  addMonths,
  isSameDay,
  monthLabel
} from "../lib/calendar";
import { cn } from "../lib/utils";

interface DatePickerProps {
  /** "YYYY-MM-DD" 或 "" */
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}

const WEEKDAYS_ZH = ["一", "二", "三", "四", "五", "六", "日"];
const WEEKDAYS_EN = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

/** "YYYY-MM-DD" → 本地 Date;空/非法 → null */
function parseYmd(v: string): Date | null {
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * 自绘日历日期选择器(无依赖,配色/圆角跟随设计系统语义 token)。
 *
 * - 值格式 "YYYY-MM-DD",与原 <input type="date"> 兼容,可直接替换。
 * - 月网格用 calendar.ts 的 monthMatrix(周一为周首)。
 * - 关闭:点组件外部(document mousedown)。
 */
export function DatePicker({ value, onChange, placeholder, className }: DatePickerProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith("en") ? "en" : "zh";
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = parseYmd(value);
  const [viewMonth, setViewMonth] = useState<Date>(() => selected ?? new Date());
  const today = new Date();

  // 打开时把视图跳到选中月
  useEffect(() => {
    if (open && selected) setViewMonth(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // 点外部关闭
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const days = monthMatrix(viewMonth.getFullYear(), viewMonth.getMonth());
  const weekdays = lang === "en" ? WEEKDAYS_EN : WEEKDAYS_ZH;

  function pick(d: Date) {
    onChange(dateKey(d));
    setOpen(false);
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors",
          "border bg-bg-muted",
          open ? "border-accent" : "border-border",
          value ? "text-text" : "text-text-faint"
        )}
      >
        <span>{value || placeholder || ""}</span>
        <CalendarIcon className="h-3.5 w-3.5 flex-shrink-0 text-text-faint" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-xl border border-border bg-bg-elevated p-2.5 shadow-lg">
          {/* 月导航 */}
          <div className="mb-2 flex items-center justify-between px-1">
            <button
              type="button"
              onClick={() => setViewMonth((m) => addMonths(m, -1))}
              aria-label="prev month"
              className="rounded-md p-1 text-text-muted transition-colors hover:bg-bg-muted hover:text-text"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-medium text-text">{monthLabel(viewMonth, lang)}</span>
            <button
              type="button"
              onClick={() => setViewMonth((m) => addMonths(m, 1))}
              aria-label="next month"
              className="rounded-md p-1 text-text-muted transition-colors hover:bg-bg-muted hover:text-text"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* 星期表头(周一首) */}
          <div className="mb-1 grid grid-cols-7 gap-0.5">
            {weekdays.map((w) => (
              <div key={w} className="py-1 text-center text-[10px] font-medium text-text-faint">
                {w}
              </div>
            ))}
          </div>

          {/* 日期网格 */}
          <div className="grid grid-cols-7 gap-0.5">
            {days.map((d) => {
              const inMonth = d.getMonth() === viewMonth.getMonth();
              const isSel = selected != null && isSameDay(d, selected);
              const isToday = isSameDay(d, today);
              return (
                <button
                  key={d.toISOString()}
                  type="button"
                  onClick={() => pick(d)}
                  className={cn(
                    "flex h-7 items-center justify-center rounded-md text-xs transition-colors",
                    isSel
                      ? "bg-accent font-semibold text-white"
                      : cn(
                          "hover:bg-bg-muted",
                          inMonth ? "text-text" : "text-text-faint/50",
                          isToday && "font-semibold text-accent"
                        )
                  )}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>

          {/* 底部:清除 / 今天 */}
          <div className="mt-2 flex items-center justify-between border-t border-border/50 pt-2">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className="rounded px-2 py-0.5 text-[11px] text-text-faint transition-colors hover:text-danger"
            >
              {t("newTask.deadlineQuick.clear")}
            </button>
            <button
              type="button"
              onClick={() => pick(new Date())}
              className="rounded px-2 py-0.5 text-[11px] font-medium text-accent transition-colors hover:bg-accent/10"
            >
              {t("newTask.deadlineQuick.today")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
