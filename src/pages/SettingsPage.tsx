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
  Trash2
} from "lucide-react";
import {
  useSettingsStore,
  type Lang,
  type ProviderName
} from "../lib/settings";
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
