import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Command,
  Sparkles,
  Sun,
  Moon,
  Monitor,
  Loader2
} from "lucide-react";
import { cn } from "../lib/utils";
import { useThemeStore } from "../lib/theme";
import { useTodoStore, newTodoId } from "../lib/store";
import { parseTask } from "../lib/llm";
import { toast } from "../lib/toast";

/**
 * 顶栏:Cmd+K 全局快捷键的自然语言输入
 *
 * 行为:
 *  - 聚焦后,⌘K hint 仍在右侧;submitting 时 hint 变成 spinner
 *  - 按 Enter 或失焦+输入有内容 → 调 parseTask + addTodo,落 db
 *  - 解析失败(没 key 或网络问题)→ fallback 用原文当 title 存,console.warn
 *  - 之前的"AI 实时解析预览面板"用的是 mock 字段,已经移除
 */
export function TopBar() {
  const { t } = useTranslation();
  const [value, setValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const addTodo = useTodoStore((s) => s.addTodo);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  /** 提交:走 LLM 解析,落 SQLite */
  async function handleSubmit() {
    if (!value.trim() || isSubmitting) return;
    setIsSubmitting(true);
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
        scheduledDate: todayKey(),
        status: "todo",
        createdAt: new Date().toISOString()
      });
      setValue("");
      setIsFocused(false);
      inputRef.current?.blur();
      if (parsed.parsed) {
        toast.success(`已添加:${parsed.title}`);
      } else {
        toast.warning("AI 未生效(可能没配 key),已用原文存为标题");
      }
    } catch (err) {
      console.error("[TopBar] submit failed:", err);
      toast.error("添加失败,详情见 console");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <header className="h-14 flex items-center px-6 gap-4 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md z-40 flex-shrink-0">
      {/* 左占位:让中间搜索框视觉居中 */}
      <div className="flex-1" />

      {/* 中:输入框 */}
      <div className="relative w-full max-w-xl">
        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
          <Sparkles
            className={cn(
              "w-4 h-4 transition-colors",
              isFocused || value
                ? "text-indigo-500 dark:text-indigo-400"
                : "text-zinc-400 dark:text-zinc-500"
            )}
          />
        </div>

        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 120)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !isSubmitting) {
              e.preventDefault();
              void handleSubmit();
            } else if (e.key === "Escape") {
              setValue("");
              inputRef.current?.blur();
            }
          }}
          disabled={isSubmitting}
          placeholder={t("topbar.placeholder")}
          className={cn(
            "w-full bg-zinc-100 dark:bg-zinc-900 border border-transparent",
            "hover:border-zinc-200 dark:hover:border-zinc-800",
            "focus:bg-white dark:focus:bg-zinc-950 focus:border-indigo-500",
            "rounded-lg pl-9 pr-12 py-1.5 text-sm",
            "outline-none transition-all",
            "text-zinc-900 dark:text-zinc-100",
            "placeholder:text-zinc-500"
          )}
        />

        {/* 右侧 hint:平时显示 ⌘K,submitting 时转圈 */}
        <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
          {isSubmitting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
          ) : (
            <kbd className="hidden md:inline-flex items-center gap-1 font-mono text-xs text-zinc-500 dark:text-zinc-400 bg-white dark:bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700">
              <Command className="w-3 h-3" />
              <span>K</span>
            </kbd>
          )}
        </div>
      </div>

      {/* 右:主题切换 */}
      <div className="flex-1 flex justify-end">
        <ThemeToggle />
      </div>
    </header>
  );
}

/** 今天 YYYY-MM-DD(本地时区) */
function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * 主题切换按钮:三态循环 light → dark → system → light
 * icon 反映用户选择(不是当前实际),让用户清楚知道"我选了哪个"
 */
function ThemeToggle() {
  const mode = useThemeStore((s) => s.mode);
  const cycle = useThemeStore((s) => s.cycle);

  const Icon = mode === "system" ? Monitor : mode === "dark" ? Moon : Sun;
  const label =
    mode === "system" ? "跟随系统" : mode === "dark" ? "暗色" : "亮色";

  return (
    <button
      type="button"
      onClick={cycle}
      title={label}
      aria-label={label}
      className={cn(
        "p-1.5 rounded-md transition-colors",
        "text-zinc-500 dark:text-zinc-400",
        "hover:bg-zinc-100 dark:hover:bg-zinc-800",
        "hover:text-zinc-900 dark:hover:text-zinc-100"
      )}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}
