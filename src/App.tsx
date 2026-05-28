import { useEffect, useState } from "react";
import { HashRouter, Route, Routes } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { BriefingPage } from "./pages/BriefingPage";
import { TodosPage } from "./pages/TodosPage";
import { CalendarPage } from "./pages/CalendarPage";
import { ReflectPage } from "./pages/ReflectPage";
import { ChatPage } from "./pages/ChatPage";
import { TelosPage } from "./pages/TelosPage";
import { SettingsPage } from "./pages/SettingsPage";
import { FloatingApp } from "./pages/FloatingApp";
import { useTodoStore } from "./lib/store";
import { useGoalsStore } from "./lib/goalsStore";
import { useActivityStore } from "./lib/activityStore";
import { emitSync, type SyncTopic } from "./lib/syncBus";
import { startReminderScheduler } from "./lib/reminder";
import { ConfirmDialogProvider } from "./components/ConfirmDialog";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Toaster } from "./components/Toaster";

const FLOATING_HASH = "#/__floating__";

/**
 * App 主壳:根据 URL hash 决定渲染主 App 还是浮窗。
 *
 *  - 默认 hash 为空或主路由 → 主 App(Sidebar + TopBar + 6 个 tab)
 *  - hash === FLOATING_HASH → 浮窗(260×420,常驻置顶)
 *
 * 两个 Tauri 窗口共用同一份代码,通过 hash 切换入口。
 * 共享:SQLite db(同文件)+ BroadcastChannel 跨窗口同步。
 */
export default function App() {
  const [isFloating, setIsFloating] = useState(
    () => typeof window !== "undefined" && window.location.hash === FLOATING_HASH
  );

  // 不太可能但保险:hash 变化时切换
  useEffect(() => {
    const handler = () => setIsFloating(window.location.hash === FLOATING_HASH);
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  if (isFloating) {
    return (
      <ErrorBoundary>
        <ConfirmDialogProvider>
          <FloatingApp />
          <Toaster />
        </ConfirmDialogProvider>
      </ErrorBoundary>
    );
  }

  return <MainApp />;
}

function MainApp() {
  const hydrate = useTodoStore((s) => s.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // 监听 MCP 后端写操作发来的刷新事件：刷新本窗口对应 store，并经 BroadcastChannel 通知浮窗
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void (async () => {
      const { listen } = await import("@tauri-apps/api/event");
      unlisten = await listen<string>("daybreak://data-changed", (e) => {
        const topic = e.payload as SyncTopic;
        if (topic === "todos") void useTodoStore.getState().hydrate();
        else if (topic === "goals") void useGoalsStore.getState().hydrate();
        else if (topic === "activities") void useActivityStore.getState().hydrate();
        emitSync(topic);
      });
    })();
    return () => unlisten?.();
  }, []);

  // 间歇式时间日志:提醒调度只在主窗口起一份(浮窗走 FloatingApp 分支,不会到这里),避免重复提醒
  useEffect(() => {
    const stop = startReminderScheduler();
    return stop;
  }, []);

  return (
    <ErrorBoundary>
      <ConfirmDialogProvider>
        <HashRouter>
          <div className="flex h-screen overflow-hidden bg-bg text-text">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0">
              <TopBar />
              <main className="flex-1 overflow-y-auto scrollbar-thin">
                <Routes>
                  <Route path="/" element={<BriefingPage />} />
                  <Route path="/todos" element={<TodosPage />} />
                  <Route path="/calendar" element={<CalendarPage />} />
                  <Route path="/reflect" element={<ReflectPage />} />
                  <Route path="/chat" element={<ChatPage />} />
                  <Route path="/telos" element={<TelosPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Routes>
              </main>
            </div>
          </div>
        </HashRouter>
        <Toaster />
      </ConfirmDialogProvider>
    </ErrorBoundary>
  );
}
