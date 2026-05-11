/**
 * 跨窗口数据同步
 *
 * 主 App 和浮窗共享同一个 SQLite,但各自的 zustand store 是独立 JS context。
 * 改动后用 BroadcastChannel 广播,各窗口订阅后重新 hydrate。
 *
 * BroadcastChannel 是浏览器原生 API,Tauri webview 同 origin 多窗口支持。
 * 比走 Tauri events 简单(不要 capability,不要 Rust 端)。
 */

const CHANNEL_NAME = "daybreak-sync";

export type SyncTopic = "todos" | "goals" | "conversations" | "reflections";

let _channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
    return null;
  }
  if (!_channel) {
    _channel = new BroadcastChannel(CHANNEL_NAME);
  }
  return _channel;
}

/** 广播一条变更通知 */
export function emitSync(topic: SyncTopic, source?: string) {
  const ch = getChannel();
  if (!ch) return;
  ch.postMessage({ topic, source, ts: Date.now() });
}

/** 订阅:topic 触发时调 handler。返回取消订阅函数 */
export function onSync(
  topic: SyncTopic,
  handler: () => void
): () => void {
  const ch = getChannel();
  if (!ch) return () => undefined;
  const listener = (e: MessageEvent) => {
    if (e.data?.topic === topic) handler();
  };
  ch.addEventListener("message", listener);
  return () => ch.removeEventListener("message", listener);
}
