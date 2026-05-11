import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/index.css";
import "./lib/i18n"; // 初始化 i18next(必须在 App 渲染前 import 一次)
import { applyInitialLang } from "./lib/settings";
import { watchSystemTheme } from "./lib/theme";

// 把 Settings 里存的 lang 同步给 i18n
applyInitialLang();

// 监听系统主题变化(mode === "system" 时跟随)
watchSystemTheme();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
