import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import zh from "./locales/zh.json";
import en from "./locales/en.json";

/**
 * 多语言初始化
 *
 * 资源 key 用短代码 "zh" / "en",让 changeLanguage("zh"|"en") 直接命中。
 * 默认 zh,Settings 可切。
 *
 * 重要约定:UI 文案统一走 t('namespace.key'),严禁硬编码中文。
 */

void i18n.use(initReactI18next).init({
  resources: {
    zh: { translation: zh },
    en: { translation: en }
  },
  lng: "zh",
  fallbackLng: "zh",
  interpolation: {
    escapeValue: false // React 已自带 XSS 防护
  },
  returnEmptyString: false
});

export default i18n;
