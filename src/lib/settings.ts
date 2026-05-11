import { create } from "zustand";
import i18n from "./i18n";

/**
 * 应用偏好设置
 *
 * 持久化:localStorage(简单方案)。P3 上 Tauri keychain 后,API key 部分搬过去。
 *
 * 包含:
 *  - lang:中/英
 *  - llmProvider:当前激活 LLM
 *  - keys:各家的 API key(脱敏显示)
 *  - baseUrls / models:各家的可选覆盖
 *
 * 主题不在这里,在 lib/theme.ts(主题切换有专门的 system 模式 + matchMedia 监听,逻辑分离更清楚)
 */

export type Lang = "zh" | "en";
export type ProviderName = "deepseek" | "anthropic" | "openai" | "mock";

interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

export interface SettingsState {
  lang: Lang;
  llmProvider: ProviderName;
  providers: {
    deepseek: ProviderConfig;
    anthropic: ProviderConfig;
    openai: ProviderConfig;
  };
}

const STORAGE_KEY = "daybreak.settings";

/** 默认值:provider 从 .env.local 兜底(给开发期方便);用户在 Settings 里填会覆盖 */
function defaults(): SettingsState {
  const env = import.meta.env;
  return {
    lang: detectInitialLang(),
    llmProvider:
      ((env.VITE_LLM_PROVIDER as ProviderName) ?? "deepseek") || "deepseek",
    providers: {
      deepseek: {
        apiKey: env.VITE_DEEPSEEK_API_KEY,
        baseUrl: env.VITE_DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
        model: env.VITE_DEEPSEEK_MODEL ?? "deepseek-chat"
      },
      anthropic: {
        apiKey: env.VITE_ANTHROPIC_API_KEY,
        baseUrl: "https://api.anthropic.com",
        model: env.VITE_ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514"
      },
      openai: {
        apiKey: env.VITE_OPENAI_API_KEY,
        baseUrl: "https://api.openai.com/v1",
        model: env.VITE_OPENAI_MODEL ?? "gpt-4o"
      }
    }
  };
}

function detectInitialLang(): Lang {
  if (typeof window === "undefined") return "zh";
  const nav = window.navigator.language ?? "zh";
  return nav.toLowerCase().startsWith("en") ? "en" : "zh";
}

function readStored(): SettingsState {
  if (typeof window === "undefined") return defaults();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults();
    const parsed = JSON.parse(raw) as Partial<SettingsState>;
    const def = defaults();
    // 浅合并 + 嵌套合并
    return {
      lang: parsed.lang === "en" || parsed.lang === "zh" ? parsed.lang : def.lang,
      llmProvider:
        parsed.llmProvider && validProvider(parsed.llmProvider)
          ? parsed.llmProvider
          : def.llmProvider,
      providers: {
        deepseek: { ...def.providers.deepseek, ...(parsed.providers?.deepseek ?? {}) },
        anthropic: { ...def.providers.anthropic, ...(parsed.providers?.anthropic ?? {}) },
        openai: { ...def.providers.openai, ...(parsed.providers?.openai ?? {}) }
      }
    };
  } catch (err) {
    console.error("[settings] parse failed, falling back to defaults:", err);
    return defaults();
  }
}

function validProvider(v: string): v is ProviderName {
  return ["deepseek", "anthropic", "openai", "mock"].includes(v);
}

function persist(state: SettingsState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error("[settings] persist failed:", err);
  }
}

interface SettingsStore extends SettingsState {
  setLang: (lang: Lang) => void;
  setProvider: (p: ProviderName) => void;
  setProviderConfig: (p: Exclude<ProviderName, "mock">, cfg: ProviderConfig) => void;
  reset: () => void;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  ...readStored(),
  setLang: (lang) => {
    set({ lang });
    persist({ ...get(), lang });
    void i18n.changeLanguage(lang);
  },
  setProvider: (llmProvider) => {
    set({ llmProvider });
    persist({ ...get(), llmProvider });
    // 让 LLM 模块下次取 provider 时重新构造(单例失效)
    resetProviderCache();
  },
  setProviderConfig: (p, cfg) => {
    const merged = { ...get().providers[p], ...cfg };
    const providers = { ...get().providers, [p]: merged };
    set({ providers });
    persist({ ...get(), providers });
    resetProviderCache();
  },
  reset: () => {
    const d = defaults();
    set(d);
    persist(d);
    void i18n.changeLanguage(d.lang);
    resetProviderCache();
  }
}));

/**
 * LLM provider 缓存失效信号
 * lib/llm/index.ts 监听这个,切换 provider 或改 key 时重建实例
 */
let _resetters: Array<() => void> = [];
export function onProviderConfigChange(cb: () => void): () => void {
  _resetters.push(cb);
  return () => {
    _resetters = _resetters.filter((x) => x !== cb);
  };
}
function resetProviderCache() {
  _resetters.forEach((cb) => cb());
}

/** 启动时同步 i18n 到 store 里的 lang */
export function applyInitialLang() {
  const lang = useSettingsStore.getState().lang;
  void i18n.changeLanguage(lang);
}
