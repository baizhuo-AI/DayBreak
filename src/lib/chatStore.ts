import { create } from "zustand";
import {
  dbDeleteConversation,
  dbInsertConversation,
  dbInsertMessage,
  dbListConversations,
  dbListMessages,
  dbTouchConversation,
  dbUpdateConversationTitle,
  dbUpdateMessageContent,
  type ChatMessageRow,
  type ConversationRow
} from "./db";
import { chatStreamCall } from "./llm";
import type { ChatMessage } from "./llm/types";

/** id 生成器 */
function newId(prefix: string): string {
  return `${prefix}${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

interface ChatStore {
  conversations: ConversationRow[];
  /** 当前激活的会话 id;null 表示未选 */
  currentId: string | null;
  /** 各会话的消息(懒加载,select 时填) */
  messagesByConv: Record<string, ChatMessageRow[]>;
  /** 正在流式接收的 assistant 消息内容(实时刷新,完整后才入 db) */
  streaming: string;
  /** 正在流式接收的思考过程(reasoning_content) */
  streamingReasoning: string;
  /** 正在请求中(submit 中) */
  loading: boolean;
  /** 中止当前请求 */
  abort: AbortController | null;

  hydrate: () => Promise<void>;
  selectConv: (id: string | null) => Promise<void>;
  createConv: (title?: string) => Promise<string>;
  deleteConv: (id: string) => Promise<void>;
  renameConv: (id: string, title: string) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  stop: () => void;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  conversations: [],
  currentId: null,
  messagesByConv: {},
  streaming: "",
  streamingReasoning: "",
  loading: false,
  abort: null,

  hydrate: async () => {
    try {
      const convs = await dbListConversations();
      set({ conversations: convs });
    } catch (err) {
      console.error("[chatStore] hydrate failed:", err);
    }
  },

  selectConv: async (id) => {
    if (!id) {
      set({ currentId: null });
      return;
    }
    set({ currentId: id });
    if (!get().messagesByConv[id]) {
      try {
        const msgs = await dbListMessages(id);
        set((s) => ({ messagesByConv: { ...s.messagesByConv, [id]: msgs } }));
      } catch (err) {
        console.error("[chatStore] load messages failed:", err);
      }
    }
  },

  createConv: async (title) => {
    const id = newId("c");
    const now = new Date().toISOString();
    const conv: ConversationRow = {
      id,
      title: title ?? "新对话",
      createdAt: now,
      updatedAt: now
    };
    await dbInsertConversation(conv);
    set((s) => ({
      conversations: [conv, ...s.conversations],
      currentId: id,
      messagesByConv: { ...s.messagesByConv, [id]: [] }
    }));
    return id;
  },

  deleteConv: async (id) => {
    await dbDeleteConversation(id);
    set((s) => {
      const next = { ...s.messagesByConv };
      delete next[id];
      return {
        conversations: s.conversations.filter((c) => c.id !== id),
        messagesByConv: next,
        currentId: s.currentId === id ? null : s.currentId
      };
    });
  },

  renameConv: async (id, title) => {
    await dbUpdateConversationTitle(id, title);
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === id ? { ...c, title } : c
      )
    }));
  },

  sendMessage: async (content) => {
    const trimmed = content.trim();
    if (!trimmed || get().loading) return;

    let convId = get().currentId;
    if (!convId) {
      convId = await get().createConv(trimmed.slice(0, 24));
    }

    // 用户消息先入库 + 入 state
    const userMsg: ChatMessageRow = {
      id: newId("m"),
      convId,
      role: "user",
      content: trimmed,
      createdAt: new Date().toISOString()
    };
    await dbInsertMessage(userMsg);
    set((s) => ({
      messagesByConv: {
        ...s.messagesByConv,
        [convId!]: [...(s.messagesByConv[convId!] ?? []), userMsg]
      }
    }));

    // 占位 assistant 消息(content 后续覆写)
    const assistantId = newId("m");
    const assistantPlaceholder: ChatMessageRow = {
      id: assistantId,
      convId,
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString()
    };
    await dbInsertMessage(assistantPlaceholder);
    set((s) => ({
      messagesByConv: {
        ...s.messagesByConv,
        [convId!]: [...(s.messagesByConv[convId!] ?? []), assistantPlaceholder]
      },
      loading: true,
      streaming: "",
      streamingReasoning: ""
    }));

    // 历史消息 → LLM(去掉空 assistant 占位)
    const history = (get().messagesByConv[convId] ?? [])
      .filter((m) => !(m.id === assistantId))
      .map((m): ChatMessage => ({ role: m.role, content: m.content }));

    const abort = new AbortController();
    set({ abort });

    let final = "";
    let finalReasoning = "";
    let usageJson: string | undefined;
    try {
      const result = await chatStreamCall(history, {
        signal: abort.signal,
        onToken: (token) => {
          set((s) => ({ streaming: s.streaming + token }));
        },
        onReasoningToken: (token) => {
          set((s) => ({ streamingReasoning: s.streamingReasoning + token }));
        }
      });
      final = result.content;
      finalReasoning = result.reasoning ?? "";
      if (result.usage) usageJson = JSON.stringify(result.usage);
    } catch (err) {
      console.error("[chatStore] stream failed:", err);
      final = "(请求失败,请稍后重试。错误已记录到 console)";
    } finally {
      // 写回 assistant 消息完整内容
      await dbUpdateMessageContent(
        assistantId,
        final,
        finalReasoning || undefined,
        usageJson
      ).catch((e) => console.error("[chatStore] update msg failed:", e));
      await dbTouchConversation(convId!).catch(() => undefined);

      set((s) => ({
        messagesByConv: {
          ...s.messagesByConv,
          [convId!]: (s.messagesByConv[convId!] ?? []).map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: final,
                  reasoningContent: finalReasoning || undefined,
                  usageJson
                }
              : m
          )
        },
        // 把会话顶到列表最上
        conversations: [
          ...s.conversations.filter((c) => c.id === convId).map((c) => ({
            ...c,
            updatedAt: new Date().toISOString()
          })),
          ...s.conversations.filter((c) => c.id !== convId)
        ],
        streaming: "",
        streamingReasoning: "",
        loading: false,
        abort: null
      }));
    }
  },

  stop: () => {
    const a = get().abort;
    if (a) a.abort();
  }
}));
