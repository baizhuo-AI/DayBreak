import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Eye,
  EyeOff,
  Languages,
  Palette,
  KeyRound,
  Database,
  RotateCcw,
  Download,
  Upload,
  Trash2,
  Bell,
  Plug
} from "lucide-react";
import {
  useSettingsStore,
  type Lang,
  type ProviderName,
  type ChatBackend
} from "../lib/settings";
import { invoke } from "@tauri-apps/api/core";
import { useThemeStore, type ThemeMode } from "../lib/theme";
import { cn } from "../lib/utils";
import { useConfirm } from "../components/ConfirmDialog";
import { deleteAllTodos, downloadExport, importFromJson } from "../lib/dataIO";
import { toast } from "../lib/toast";
import { dbUsageSummary } from "../lib/db";

/**
 * Settings 页 — App 偏好的全部入口
 *
 * 4 个 section:
 *  1. 外观:语言 + 主题
 *  2. LLM:provider 切换 + 各家 API key 输入(密文显示,可切显)
 *  3. 用量:(留位,等 P3 接 llm_usage 表)
 *  4. 数据:重置设置 + 清空数据库
 */
export function SettingsPage() {
  const { t } = useTranslation();
  const settings = useSettingsStore();
  const themeMode = useThemeStore((s) => s.mode);
  const setThemeMode = useThemeStore((s) => s.setMode);
  const confirm = useConfirm();

  return (
    <div className="h-full flex flex-col">
      <header className="h-14 px-6 flex items-center border-b border-zinc-200 dark:border-zinc-800 flex-shrink-0">
        <h1 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          {t("settings.title")}
        </h1>
      </header>

      <div className="flex-1 overflow-auto scrollbar-thin">
        <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
          {/* 外观 */}
          <Section
            icon={<Palette className="w-4 h-4" />}
            title={t("settings.appearance.title")}
          >
            <Field label={t("settings.appearance.lang")}>
              <SegmentControl<Lang>
                value={settings.lang}
                onChange={settings.setLang}
                options={[
                  { value: "zh", label: "中文" },
                  { value: "en", label: "English" }
                ]}
              />
            </Field>
            <Field label={t("settings.appearance.theme")}>
              <SegmentControl<ThemeMode>
                value={themeMode}
                onChange={setThemeMode}
                options={[
                  { value: "light", label: t("settings.appearance.themeLight") },
                  { value: "dark", label: t("settings.appearance.themeDark") },
                  {
                    value: "system",
                    label: t("settings.appearance.themeSystem")
                  }
                ]}
              />
            </Field>
          </Section>

          {/* 定时提醒 */}
          <Section
            icon={<Bell className="w-4 h-4" />}
            title={t("settings.reminder.title")}
            description={t("settings.reminder.description")}
          >
            <ReminderSettings />
          </Section>

          {/* LLM */}
          <Section
            icon={<KeyRound className="w-4 h-4" />}
            title={t("settings.llm.title")}
            description={t("settings.llm.description")}
          >
            <Field label={t("settings.llm.provider")}>
              <SegmentControl<ProviderName>
                value={settings.llmProvider}
                onChange={settings.setProvider}
                options={[
                  { value: "deepseek", label: "DeepSeek" },
                  { value: "anthropic", label: "Claude" },
                  { value: "openai", label: "OpenAI" },
                  { value: "mock", label: t("settings.llm.providerMock") }
                ]}
              />
            </Field>

            {settings.llmProvider !== "mock" && (
              <ProviderKeyEditor provider={settings.llmProvider} />
            )}
          </Section>

          {/* 对话后端切换：DeepSeek API / 三家本地 CLI */}
          <Section
            title="对话后端"
            description="选 DeepSeek API 直连或本地 CLI（claude/codex/kiro）"
            icon={<Plug className="w-4 h-4" />}
          >
            <ChatBackendField />
          </Section>

          {/* 接入 AI 助手（MCP）*/}
          <Section
            icon={<Plug className="w-4 h-4" />}
            title="接入 AI 助手"
            description="让 Claude Code 等 AI 通过 MCP 直接读写你的任务、目标、复盘和时间日志。"
          >
            <McpAccessSection />
          </Section>

          {/* 用量 */}
          <Section
            icon={<Languages className="w-4 h-4 rotate-180" />}
            title={t("settings.usage.title")}
            description={t("settings.usage.description")}
          >
            <UsagePanel />
          </Section>

          {/* 数据 */}
          <Section
            icon={<Database className="w-4 h-4" />}
            title={t("settings.data.title")}
            description={t("settings.data.description")}
          >
            <DataActions confirm={confirm} settingsReset={settings.reset} />
          </Section>
        </div>
      </div>
    </div>
  );
}

/* ---------- 子组件 ---------- */

function Section({
  icon,
  title,
  description,
  children
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-zinc-400 dark:text-zinc-500">{icon}</span>
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {title}
        </h2>
      </div>
      {description && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3 ml-6">
          {description}
        </p>
      )}
      <div
        className={cn(
          "rounded-xl p-4 space-y-4",
          "bg-white dark:bg-zinc-900",
          "border border-zinc-200 dark:border-zinc-800"
        )}
      >
        {children}
      </div>
    </section>
  );
}

function Field({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <label className="text-sm text-zinc-700 dark:text-zinc-300 flex-shrink-0">
        {label}
      </label>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

interface SegmentOption<V extends string> {
  value: V;
  label: string;
}

function SegmentControl<V extends string>({
  value,
  onChange,
  options
}: {
  value: V;
  onChange: (v: V) => void;
  options: SegmentOption<V>[];
}) {
  return (
    <div className="inline-flex bg-zinc-100 dark:bg-zinc-800 rounded-lg p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "px-3 py-1 text-xs font-medium rounded-md transition-colors",
            value === opt.value
              ? "bg-white dark:bg-zinc-950 shadow-sm text-zinc-900 dark:text-zinc-100"
              : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function UsagePanel() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<{
    totalCalls: number;
    totalPromptTokens: number;
    totalCompletionTokens: number;
    totalTokens: number;
  } | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const s = await dbUsageSummary();
        setStats(s);
      } catch (err) {
        console.error("[Settings] usage summary failed:", err);
      }
    })();
  }, []);

  if (!stats) {
    return (
      <p className="text-sm text-zinc-400 dark:text-zinc-500">
        {t("common.loading")}
      </p>
    );
  }

  // DeepSeek 价格估算(deepseek-chat ¥0.001/1K input + ¥0.002/1K output,粗算)
  const costInput = (stats.totalPromptTokens / 1000) * 0.001;
  const costOutput = (stats.totalCompletionTokens / 1000) * 0.002;
  const cost = (costInput + costOutput).toFixed(3);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <UsageStat label={t("settings.usage.calls")} value={String(stats.totalCalls)} />
      <UsageStat label={t("settings.usage.promptTokens")} value={fmtNum(stats.totalPromptTokens)} />
      <UsageStat
        label={t("settings.usage.completionTokens")}
        value={fmtNum(stats.totalCompletionTokens)}
      />
      <UsageStat label={t("settings.usage.estCost")} value={`¥${cost}`} />
    </div>
  );
}

function UsageStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg p-3 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-zinc-500 dark:text-zinc-400">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
        {value}
      </div>
    </div>
  );
}

function fmtNum(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}K`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

/* ---------- 接入 AI 助手（MCP）---------- */

interface McpConnInfo {
  port: number;
  token: string;
  command: string;
}

function McpAccessSection() {
  const [info, setInfo] = useState<McpConnInfo | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        setInfo(await invoke<McpConnInfo>("mcp_connection_info"));
      } catch (e) {
        setErr(String(e));
      }
    })();
  }, []);

  async function copy() {
    if (!info) return;
    try {
      await navigator.clipboard.writeText(info.command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setErr("复制失败，请手动选中命令复制");
    }
  }

  if (err) return <p className="text-sm text-red-500">{err}</p>;
  if (!info)
    return <p className="text-sm text-zinc-400 dark:text-zinc-500">加载中…</p>;

  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
        在终端运行下面这条命令，把 Daybreak 接入 Claude
        Code（配一次永久有效，重启 / 升级都不用重配）：
      </p>
      <div className="relative">
        <pre className="text-xs font-mono bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 pr-16 overflow-x-auto whitespace-pre-wrap break-all text-zinc-800 dark:text-zinc-200">
{info.command}
        </pre>
        <button
          type="button"
          onClick={() => void copy()}
          className="absolute right-2 top-2 px-2.5 py-1 text-xs font-medium rounded-md bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
        >
          {copied ? "已复制" : "复制"}
        </button>
      </div>
      <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
        端口 {info.port}，仅本机可连，需保持 Daybreak 运行。密钥已自动生成并保存。
      </p>
    </div>
  );
}

function DataActions({
  confirm,
  settingsReset
}: {
  confirm: (opts: {
    title: string;
    message: string;
    destructive?: boolean;
    confirmLabel?: string;
  }) => Promise<boolean>;
  settingsReset: () => void;
}) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleExport() {
    try {
      const result = await downloadExport();
      toast.success(
        t("settings.data.exportDone", {
          filename: result.filename,
          kb: (result.size / 1024).toFixed(1)
        })
      );
    } catch (err) {
      console.error(err);
      toast.error("导出失败,详情见 console");
    }
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleImportFile(file: File) {
    try {
      const text = await file.text();
      const summary = await importFromJson(text);
      toast.success(
        t("settings.data.importDone", {
          todos: summary.todosImported,
          goals: summary.goalsImported,
          skipped: summary.todosSkipped + summary.goalsSkipped
        })
      );
    } catch (err) {
      console.error(err);
      toast.error(`导入失败:${(err as Error).message}`);
    }
  }

  async function handleClearTodos() {
    const ok = await confirm({
      title: t("settings.data.clearTodos"),
      message: t("settings.data.clearTodosConfirm"),
      destructive: true,
      confirmLabel: t("settings.data.clearTodos")
    });
    if (!ok) return;
    const n = await deleteAllTodos();
    toast.success(t("settings.data.clearTodosDone", { count: n }));
  }

  async function handleResetSettings() {
    const ok = await confirm({
      title: t("settings.data.resetSettings"),
      message: t("settings.data.resetSettingsConfirm"),
      destructive: true
    });
    if (ok) {
      settingsReset();
      toast.success(t("settings.data.resetDone"));
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <DataButton icon={<Download className="w-3.5 h-3.5" />} onClick={() => void handleExport()}>
        {t("settings.data.export")}
      </DataButton>
      <DataButton icon={<Upload className="w-3.5 h-3.5" />} onClick={handleImportClick}>
        {t("settings.data.import")}
      </DataButton>
      <DataButton icon={<RotateCcw className="w-3.5 h-3.5" />} onClick={() => void handleResetSettings()}>
        {t("settings.data.resetSettings")}
      </DataButton>
      <DataButton
        icon={<Trash2 className="w-3.5 h-3.5" />}
        onClick={() => void handleClearTodos()}
        destructive
      >
        {t("settings.data.clearTodos")}
      </DataButton>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleImportFile(file);
          e.target.value = ""; // 允许再次选同一文件
        }}
      />
    </div>
  );
}

function DataButton({
  icon,
  onClick,
  destructive,
  children
}: {
  icon: React.ReactNode;
  onClick: () => void;
  destructive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
        destructive
          ? "text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/40"
          : "text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-zinc-100"
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function ProviderKeyEditor({
  provider
}: {
  provider: Exclude<ProviderName, "mock">;
}) {
  const { t } = useTranslation();
  const settings = useSettingsStore();
  const cfg = settings.providers[provider];
  const [showKey, setShowKey] = useState(false);
  const [draft, setDraft] = useState(cfg.apiKey ?? "");
  const [model, setModel] = useState(cfg.model ?? "");

  function commit() {
    settings.setProviderConfig(provider, {
      apiKey: draft.trim() || undefined,
      model: model.trim() || undefined
    });
  }

  const placeholderKey =
    provider === "deepseek"
      ? "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
      : provider === "anthropic"
        ? "sk-ant-xxxxxxxx"
        : "sk-proj-xxxxxxxx";

  return (
    <>
      <Field label={t("settings.llm.apiKey")}>
        <div className="flex items-center gap-2">
          <div className="relative">
            <input
              type={showKey ? "text" : "password"}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              placeholder={placeholderKey}
              className={cn(
                "w-72 px-3 py-1.5 pr-9 rounded-lg text-sm outline-none transition-colors font-mono",
                "bg-zinc-50 dark:bg-zinc-950",
                "border border-zinc-200 dark:border-zinc-700",
                "focus:border-indigo-500",
                "text-zinc-900 dark:text-zinc-100",
                "placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
              )}
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              aria-label={showKey ? "hide" : "show"}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            >
              {showKey ? (
                <EyeOff className="w-3.5 h-3.5" />
              ) : (
                <Eye className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </Field>
      <Field label={t("settings.llm.model")}>
        <input
          type="text"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          onBlur={commit}
          placeholder={cfg.model ?? ""}
          className={cn(
            "w-72 px-3 py-1.5 rounded-lg text-sm outline-none transition-colors font-mono",
            "bg-zinc-50 dark:bg-zinc-950",
            "border border-zinc-200 dark:border-zinc-700",
            "focus:border-indigo-500",
            "text-zinc-900 dark:text-zinc-100",
            "placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
          )}
        />
      </Field>
    </>
  );
}

/* ---------- 定时提醒设置 ---------- */

const reminderInputCls = cn(
  "w-16 px-2 py-1 rounded-md text-sm text-center outline-none transition-colors tabular-nums",
  "bg-zinc-50 dark:bg-zinc-950",
  "border border-zinc-200 dark:border-zinc-700",
  "focus:border-indigo-500",
  "text-zinc-900 dark:text-zinc-100"
);

function clampInt(raw: string, min: number, max: number, fallback: number): number {
  const n = parseInt(raw, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** 今天 23:59:59 的时间戳(ms),给"今天不再提醒"用 */
function endOfTodayTs(): number {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

function ReminderSettings() {
  const { t } = useTranslation();
  const reminder = useSettingsStore((s) => s.reminder);
  const setReminder = useSettingsStore((s) => s.setReminder);
  const paused = reminder.pausedUntil != null && Date.now() < reminder.pausedUntil;

  return (
    <>
      <Field label={t("settings.reminder.enabled")}>
        <SegmentControl<"on" | "off">
          value={reminder.enabled ? "on" : "off"}
          onChange={(v) => setReminder({ enabled: v === "on" })}
          options={[
            { value: "on", label: t("settings.reminder.on") },
            { value: "off", label: t("settings.reminder.off") }
          ]}
        />
      </Field>

      {reminder.enabled && (
        <>
          <Field label={t("settings.reminder.interval")}>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={5}
                max={480}
                value={reminder.intervalMin}
                onChange={(e) =>
                  setReminder({ intervalMin: clampInt(e.target.value, 5, 480, 120) })
                }
                className={reminderInputCls}
              />
              <span className="text-xs text-zinc-400 dark:text-zinc-500">
                {t("settings.reminder.minutes")}
              </span>
            </div>
          </Field>

          <Field label={t("settings.reminder.channel")}>
            <SegmentControl<"floating" | "notification" | "both">
              value={reminder.channel}
              onChange={(v) => setReminder({ channel: v })}
              options={[
                { value: "floating", label: t("settings.reminder.channelFloating") },
                { value: "notification", label: t("settings.reminder.channelNotification") },
                { value: "both", label: t("settings.reminder.channelBoth") }
              ]}
            />
          </Field>

          <Field label={t("settings.reminder.workHours")}>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={0}
                max={23}
                value={reminder.workStart}
                onChange={(e) =>
                  setReminder({ workStart: clampInt(e.target.value, 0, 23, 9) })
                }
                className={reminderInputCls}
              />
              <span className="text-xs text-zinc-400 dark:text-zinc-500">–</span>
              <input
                type="number"
                min={0}
                max={23}
                value={reminder.workEnd}
                onChange={(e) =>
                  setReminder({ workEnd: clampInt(e.target.value, 0, 23, 22) })
                }
                className={reminderInputCls}
              />
            </div>
          </Field>

          <Field label={t("settings.reminder.pause")}>
            {paused ? (
              <button
                type="button"
                onClick={() => setReminder({ pausedUntil: undefined })}
                className="px-2.5 py-1 rounded-md text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors"
              >
                {t("settings.reminder.resume")}
              </button>
            ) : (
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setReminder({ pausedUntil: Date.now() + 60 * 60 * 1000 })}
                  className="px-2.5 py-1 rounded-md text-xs font-medium text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                >
                  {t("settings.reminder.pause1h")}
                </button>
                <button
                  type="button"
                  onClick={() => setReminder({ pausedUntil: endOfTodayTs() })}
                  className="px-2.5 py-1 rounded-md text-xs font-medium text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                >
                  {t("settings.reminder.pauseToday")}
                </button>
              </div>
            )}
          </Field>
        </>
      )}
    </>
  );
}

/* ---------- 对话后端切换 + CLI 安装检测 ---------- */

function ChatBackendField() {
  const settings = useSettingsStore();
  const [detection, setDetection] = useState<Record<string, boolean | null>>({
    claude: null,
    codex: null,
    kiro: null,
  });

  useEffect(() => {
    let mounted = true;
    const detect = async (kind: "claude" | "codex" | "kiro") => {
      try {
        const ok = await invoke<boolean>("cli_agent_detect", { kind });
        if (mounted) setDetection((d) => ({ ...d, [kind]: ok }));
      } catch {
        if (mounted) setDetection((d) => ({ ...d, [kind]: false }));
      }
    };
    void detect("claude");
    void detect("codex");
    void detect("kiro");
    return () => {
      mounted = false;
    };
  }, []);

  // 当前选中后端的状态文案：装没装 / 是否还需登录 / MCP 怎么配
  const statusText = (() => {
    const b = settings.chatBackend;
    if (b === "deepseek-api") {
      return "✓ 用 DeepSeek API 直连，按 token 付费（已极便宜）。在上方「LLM」配好 DeepSeek key 即可。";
    }
    const key = b === "claude-cli" ? "claude" : b === "codex-cli" ? "codex" : "kiro";
    const v = detection[key];
    if (v === null) return "检测中…";
    if (!v) {
      const hint =
        key === "claude"
          ? "npm i -g @anthropic-ai/claude-code，然后 claude login 登录订阅"
          : key === "codex"
          ? "见 OpenAI Codex CLI 安装文档"
          : "见 AWS Kiro CLI 安装文档";
      return `✗ 未在 PATH 检测到 ${key === "kiro" ? "kiro-cli" : key} 命令。请先安装：${hint}`;
    }
    if (key === "kiro") {
      return "✓ 已检测到 kiro-cli。还需在系统环境变量里设置 KIRO_API_KEY（Kiro headless 强制要 key），MCP 在 Kiro 配置里加 daybreak server。";
    }
    if (key === "claude") {
      return "✓ 已检测到 claude。先 claude login 登录订阅。Daybreak 启动 claude 时会自动配 MCP 指向本机 server。";
    }
    return "✓ 已检测到 codex。先 codex login 登录。Daybreak 暂不自动配 MCP，请用 codex mcp add 一次性配好 daybreak server。";
  })();

  return (
    <>
      <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3 leading-relaxed">
        选内置对话用哪个 AI。DeepSeek API 按 token 付费（默认）；三家 CLI 走你本地的订阅或 API key，更省钱但需先装好 CLI 工具。
      </p>
      <Field label="后端">
        <SegmentControl<ChatBackend>
          value={settings.chatBackend}
          onChange={settings.setChatBackend}
          options={[
            { value: "deepseek-api", label: "DeepSeek API" },
            { value: "claude-cli", label: "Claude Code" },
            { value: "codex-cli", label: "Codex" },
            { value: "kiro-cli", label: "Kiro" },
          ]}
        />
        <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed">
          {statusText}
        </div>
      </Field>
    </>
  );
}
