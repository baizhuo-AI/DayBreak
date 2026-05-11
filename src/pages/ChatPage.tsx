import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  MessageSquare,
  Plus,
  Send,
  Square,
  Trash2,
  Sparkles,
  Brain,
  ChevronDown
} from "lucide-react";
import { useChatStore } from "../lib/chatStore";
import { cn } from "../lib/utils";
import { useConfirm } from "../components/ConfirmDialog";

/**
 * Chat 页
 *
 * 布局:左侧 240px 会话列表 + 右侧消息流 + 底部输入框
 *
 * 流式:assistant 消息边接收边显示(打字机效果),streaming state 实时刷新。
 *
 * 上下文:发送时,自动在 system prompt 里灌当前今日 todos + Telos goals + 当前时间。
 */
export function ChatPage() {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const conversations = useChatStore((s) => s.conversations);
  const currentId = useChatStore((s) => s.currentId);
  const messagesByConv = useChatStore((s) => s.messagesByConv);
  const streaming = useChatStore((s) => s.streaming);
  const streamingReasoning = useChatStore((s) => s.streamingReasoning);
  const loading = useChatStore((s) => s.loading);
  const hydrate = useChatStore((s) => s.hydrate);
  const selectConv = useChatStore((s) => s.selectConv);
  const createConv = useChatStore((s) => s.createConv);
  const deleteConv = useChatStore((s) => s.deleteConv);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const stop = useChatStore((s) => s.stop);

  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const messages = currentId ? (messagesByConv[currentId] ?? []) : [];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, streaming, currentId]);

  async function handleSend() {
    if (!draft.trim() || loading) return;
    const text = draft;
    setDraft("");
    inputRef.current?.focus();
    await sendMessage(text);
  }

  async function handleDeleteConv(id: string, title: string) {
    const ok = await confirm({
      title: t("chat.deleteConv"),
      message: t("common.deleteConfirm", { title }),
      destructive: true,
      confirmLabel: t("chat.deleteConv")
    });
    if (ok) void deleteConv(id);
  }

  return (
    <div className="h-full flex overflow-hidden">
      <aside className="w-60 flex-shrink-0 border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 flex flex-col">
        <div className="p-3 border-b border-zinc-200 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => void createConv()}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
              "text-white bg-zinc-900 hover:bg-zinc-800",
              "dark:text-zinc-900 dark:bg-zinc-100 dark:hover:bg-white"
            )}
          >
            <Plus className="w-4 h-4" />
            {t("chat.newConv")}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin px-2 py-2 space-y-0.5">
          {conversations.length === 0 ? (
            <div className="px-3 py-8 text-center text-xs text-zinc-400 dark:text-zinc-500">
              {t("chat.noConvs")}
            </div>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.id}
                type="button"
                onClick={() => void selectConv(conv.id)}
                className={cn(
                  "group w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-start gap-2",
                  currentId === conv.id
                    ? "bg-zinc-200/60 dark:bg-zinc-800/60 text-zinc-900 dark:text-zinc-100"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/40 dark:hover:bg-zinc-800/40 hover:text-zinc-900 dark:hover:text-zinc-100"
                )}
              >
                <MessageSquare className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <span className="flex-1 truncate font-medium">{conv.title}</span>
                <span
                  role="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleDeleteConv(conv.id, conv.title);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-zinc-400 hover:text-red-500 transition-all"
                  aria-label="delete"
                >
                  <Trash2 className="w-3 h-3" />
                </span>
              </button>
            ))
          )}
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {!currentId ? (
          <EmptyState onStart={() => void createConv()} />
        ) : (
          <>
            <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin">
              <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
                {messages
                  .filter((m) => m.role !== "system")
                  .map((m, idx) => {
                    const isAssistant = m.role === "assistant";
                    const isLast = idx === messages.length - 1;
                    const isStreamingThis = isAssistant && loading && isLast;
                    return (
                      <Bubble
                        key={m.id}
                        role={m.role}
                        content={isStreamingThis ? streaming : m.content}
                        reasoning={
                          isStreamingThis
                            ? streamingReasoning
                            : m.reasoningContent
                        }
                        streaming={isStreamingThis}
                      />
                    );
                  })}
              </div>
            </div>

            <div className="border-t border-zinc-200 dark:border-zinc-800 px-6 py-3 flex-shrink-0">
              <div className="max-w-3xl mx-auto flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      (e.metaKey || e.ctrlKey) &&
                      !loading
                    ) {
                      e.preventDefault();
                      void handleSend();
                    }
                  }}
                  rows={2}
                  placeholder={t("chat.placeholder")}
                  className={cn(
                    "flex-1 px-3 py-2 rounded-lg text-sm outline-none transition-colors resize-none leading-relaxed",
                    "bg-zinc-100 dark:bg-zinc-900",
                    "border border-transparent",
                    "focus:bg-white dark:focus:bg-zinc-950 focus:border-indigo-500",
                    "text-zinc-900 dark:text-zinc-100",
                    "placeholder:text-zinc-500"
                  )}
                />
                {loading ? (
                  <button
                    type="button"
                    onClick={stop}
                    className="flex-shrink-0 p-2 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors"
                    title={t("chat.stop")}
                  >
                    <Square className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleSend()}
                    disabled={!draft.trim()}
                    className="flex-shrink-0 p-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title={t("chat.send")}
                  >
                    <Send className="w-4 h-4" />
                  </button>
                )}
              </div>
              <p className="max-w-3xl mx-auto mt-1.5 text-[11px] text-zinc-400 dark:text-zinc-500">
                {t("chat.sendHint")}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Bubble({
  role,
  content,
  reasoning,
  streaming
}: {
  role: string;
  content: string;
  reasoning?: string;
  streaming?: boolean;
}) {
  const isUser = role === "user";
  return (
    <div className={cn("flex gap-3", isUser && "justify-end")}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-4 h-4" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[80%] rounded-2xl text-sm leading-relaxed",
          isUser
            ? "bg-indigo-500 text-white rounded-br-sm px-4 py-2.5"
            : "bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 rounded-bl-sm border border-zinc-200 dark:border-zinc-800"
        )}
      >
        {/* 思考过程(仅 assistant 且有 reasoning) */}
        {!isUser && reasoning && (
          <ReasoningSection
            reasoning={reasoning}
            streaming={streaming && !content}
          />
        )}
        {/* 最终回答(user 或 assistant 都进入这一段) */}
        <div
          className={cn(
            "whitespace-pre-wrap break-words",
            !isUser && "px-4 py-2.5",
            !isUser && reasoning && "border-t border-zinc-200 dark:border-zinc-800"
          )}
        >
          {content || (streaming ? "" : <span className="opacity-50">…</span>)}
          {streaming && content && (
            <span className="inline-block w-1.5 h-3.5 align-baseline -mb-0.5 ml-0.5 bg-current animate-pulse" />
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * 思考过程显示区
 *  - 默认展开(用户明确说"不需要隐藏")
 *  - 可点折叠/展开
 *  - 字体小、灰色、左侧 indigo 细边,跟最终回答视觉上分开
 */
function ReasoningSection({
  reasoning,
  streaming
}: {
  reasoning: string;
  streaming?: boolean;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="px-4 pt-2.5 pb-1.5">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
      >
        <Brain className="w-3 h-3" />
        <span>
          {streaming ? t("chat.reasoningStreaming") : t("chat.reasoning")}
        </span>
        <ChevronDown
          className={cn(
            "w-3 h-3 transition-transform",
            !expanded && "-rotate-90"
          )}
        />
      </button>
      {expanded && (
        <div className="mt-2 mb-1 pl-2.5 border-l-2 border-indigo-300/60 dark:border-indigo-400/40">
          <div className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400 whitespace-pre-wrap break-words font-mono">
            {reasoning}
            {streaming && (
              <span className="inline-block w-1 h-3 align-baseline -mb-0.5 ml-0.5 bg-current animate-pulse" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ onStart }: { onStart: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4">
          <Sparkles className="w-5 h-5" />
        </div>
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
          {t("chat.emptyTitle")}
        </h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed mb-4">
          {t("chat.emptyBody")}
        </p>
        <button
          type="button"
          onClick={onStart}
          className={cn(
            "inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
            "text-white bg-indigo-500 hover:bg-indigo-600"
          )}
        >
          <Plus className="w-4 h-4" />
          {t("chat.newConv")}
        </button>
      </div>
    </div>
  );
}
