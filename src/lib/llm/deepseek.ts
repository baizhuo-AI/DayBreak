import type {
  ChatMessage,
  ChatOptions,
  ChatResult,
  LLMProvider,
  StreamHandlers,
  LLMUsage,
} from "./types";

/**
 * DeepSeek Provider
 *
 * 兼容 OpenAI 协议:
 *   POST {baseUrl}/chat/completions
 *   Authorization: Bearer {apiKey}
 *
 * 文档:https://api-docs.deepseek.com/
 *
 * - chat:非流式,适合 parseTask / generateTodayPlan / 生成 Briefing,以及 function calling 的 agent loop
 * - chatStream:SSE 流式,适合 Chat 对话(打字机效果)
 *
 * function calling:仅在 chat（非流式）支持 tools 参数 + 解析 tool_calls；
 * deepseek-chat 支持，deepseek-reasoner 不支持（带 tools 会报错）。
 */

interface DeepSeekConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

interface DeepSeekToolCall {
  id: string;
  type: string;
  function: { name: string; arguments: string };
}

interface DeepSeekChoice {
  message?: {
    content?: string;
    reasoning_content?: string;
    tool_calls?: DeepSeekToolCall[];
  };
  delta?: { content?: string; reasoning_content?: string };
  finish_reason?: string | null;
}

interface DeepSeekResponse {
  choices?: DeepSeekChoice[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

/** 把内部 ChatMessage 转成 DeepSeek/OpenAI 的消息格式（处理 tool_calls / tool 结果消息） */
function toApiMessage(m: ChatMessage): Record<string, unknown> {
  if (m.role === "assistant" && m.toolCalls && m.toolCalls.length > 0) {
    return {
      role: "assistant",
      content: m.content || "",
      tool_calls: m.toolCalls.map((tc) => ({
        id: tc.id,
        type: "function",
        function: { name: tc.name, arguments: tc.arguments },
      })),
    };
  }
  if (m.role === "tool") {
    return { role: "tool", tool_call_id: m.toolCallId, content: m.content };
  }
  return { role: m.role, content: m.content };
}

export class DeepSeekProvider implements LLMProvider {
  readonly name = "deepseek";
  private cfg: DeepSeekConfig;

  constructor(cfg: DeepSeekConfig) {
    this.cfg = cfg;
  }

  get model(): string {
    return this.cfg.model;
  }

  private buildBody(messages: ChatMessage[], opts: ChatOptions, stream: boolean) {
    const model = opts.model ?? this.cfg.model;
    const body: Record<string, unknown> = {
      model,
      messages: messages.map(toApiMessage),
      temperature: opts.temperature ?? 0.3,
      stream,
    };
    if (opts.maxTokens) body.max_tokens = opts.maxTokens;
    // 注意:deepseek-reasoner 不支持 response_format/JSON mode,启用了反而报错。
    if (opts.responseFormat === "json" && !model.includes("reasoner")) {
      body.response_format = { type: "json_object" };
    }
    // function calling:reasoner 不支持 tools，保险起见只在非 reasoner 上带
    if (opts.tools && opts.tools.length > 0 && !model.includes("reasoner")) {
      body.tools = opts.tools;
    }
    return body;
  }

  /** 取本次请求实际用的 model(opts 覆盖优先) */
  private resolveModel(opts: ChatOptions): string {
    return opts.model ?? this.cfg.model;
  }

  private url(): string {
    return `${this.cfg.baseUrl.replace(/\/$/, "")}/chat/completions`;
  }

  async chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<ChatResult> {
    const res = await fetch(this.url(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.cfg.apiKey}`,
      },
      body: JSON.stringify(this.buildBody(messages, opts, false)),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `[DeepSeek] HTTP ${res.status} ${res.statusText}: ${text.slice(0, 200)}`
      );
    }

    const data = (await res.json()) as DeepSeekResponse;
    const msg = data.choices?.[0]?.message;
    const content = msg?.content ?? "";
    const toolCalls = msg?.tool_calls?.map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: tc.function.arguments,
    }));

    // 有 tool_calls 时 content 可以为空（模型只想调工具），不算错误
    if (!content && (!toolCalls || toolCalls.length === 0)) {
      throw new Error("[DeepSeek] empty response");
    }

    return {
      content,
      reasoning: msg?.reasoning_content,
      toolCalls,
      usage: toUsage(data.usage),
      model: this.resolveModel(opts),
    };
  }

  async chatStream(
    messages: ChatMessage[],
    opts: ChatOptions,
    handlers: StreamHandlers
  ): Promise<ChatResult> {
    const res = await fetch(this.url(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.cfg.apiKey}`,
      },
      body: JSON.stringify(this.buildBody(messages, opts, true)),
      signal: handlers.signal,
    });

    if (!res.ok || !res.body) {
      const text = res.body ? await res.text().catch(() => "") : "";
      const err = new Error(
        `[DeepSeek] HTTP ${res.status} ${res.statusText}: ${text.slice(0, 200)}`
      );
      handlers.onError?.(err);
      throw err;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let accContent = "";
    let accReasoning = "";
    let usage: LLMUsage | undefined;

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line || !line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (payload === "[DONE]") continue;
          try {
            const chunk = JSON.parse(payload) as DeepSeekResponse;
            const delta = chunk.choices?.[0]?.delta;

            const reasonTok = delta?.reasoning_content;
            if (reasonTok) {
              accReasoning += reasonTok;
              handlers.onReasoningToken?.(reasonTok);
            }
            const contentTok = delta?.content;
            if (contentTok) {
              accContent += contentTok;
              handlers.onToken(contentTok);
            }

            if (chunk.usage) {
              usage = toUsage(chunk.usage);
            }
          } catch (err) {
            console.warn("[DeepSeek] failed to parse SSE chunk:", payload, err);
          }
        }
      }
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      handlers.onError?.(e);
      throw e;
    }

    const result: ChatResult = {
      content: accContent,
      reasoning: accReasoning || undefined,
      usage,
      model: this.resolveModel(opts),
    };
    handlers.onDone?.(result);
    return result;
  }
}

function toUsage(
  raw?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
): LLMUsage | undefined {
  if (!raw) return undefined;
  return {
    promptTokens: raw.prompt_tokens ?? 0,
    completionTokens: raw.completion_tokens ?? 0,
    totalTokens:
      raw.total_tokens ?? (raw.prompt_tokens ?? 0) + (raw.completion_tokens ?? 0),
  };
}
