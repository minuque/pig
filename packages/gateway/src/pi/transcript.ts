import type { AgentSessionEvent, SessionEntry } from "@earendil-works/pi-coding-agent";
import type {
  JsonValue,
  TranscriptItem,
  TranscriptProgress,
  ToolTranscriptItem,
} from "@earendil-works/pi-protocol";
import {
  toProtocolAssistantMessage,
  toProtocolJsonValue,
  toProtocolToolResultMessage,
  toProtocolUserMessage,
} from "@earendil-works/pi-server";

/** 会话条目携带的消息（pi-ai 未直接依赖，从官方会话类型提取）。 */
type AgentMessage = Extract<SessionEntry, { type: "message" }>["message"];
type AssistantMessage = Extract<AgentMessage, { role: "assistant" }>;
type ToolResultMessage = Extract<AgentMessage, { role: "toolResult" }>;

/** 消息事件携带的消息；自定义角色（bash/custom/compaction 等）不进入 transcript。 */
type SessionMessage = Extract<
  AgentSessionEvent,
  { type: "message_start" | "message_update" | "message_end" }
>["message"];

/** 发给客户端的快照只留尾部。窗口为降低首包 JSON，历史截断，加载更早未做。 */
export const SNAPSHOT_TRANSCRIPT_WINDOW = 80;

/** 截断快照 transcript；不足窗口则原样返回，超出只留尾部且保持原顺序。 */
export function windowSnapshotTranscript<T>(items: readonly T[]): T[] {
  return items.slice(-SNAPSHOT_TRANSCRIPT_WINDOW);
}

/**
 * 协议投影：把 AgentSession 事件与 SessionManager 条目映射为官方
 * TranscriptProgress / TranscriptItem。
 *
 * id 约定：
 * - user/assistant 条目的快照 id 用会话条目 id；进度事件中的流式 id 用自增
 *   `m<N>`（消息条目在事件后才落盘，事件本身不带条目 id）。message_end 后
 *   服务端立即广播快照，客户端以快照重建投影，流式 id 不会残留。
 * - tool 条目统一用 toolCallId 作 id，保证 running 占位与完成条目在客户端合并。
 */
export class TranscriptProjection {
  /** toolCallId → 工具调用参数（来自助手消息事件与 tool_execution_start） */
  private readonly toolCalls = new Map<string, JsonValue>();
  private streamingMessageId: string | undefined;
  private nextMessageId = 0;
  private cachedEntries: readonly SessionEntry[] = [];
  private cachedTranscript: TranscriptItem[] = [];

  /** 把 AgentSession 事件映射为进度事件；无关事件返回 undefined。 */
  progress(event: AgentSessionEvent): TranscriptProgress | undefined {
    switch (event.type) {
      case "message_start":
        return this.messageProgress(event.message, "started");
      case "message_update":
        return this.messageProgress(event.message, "updated");
      case "message_end":
        return this.messageProgress(event.message, "finished");
      case "tool_execution_start": {
        let input: JsonValue;
        try {
          input = toProtocolJsonValue(event.args);
        } catch {
          return undefined; // 非 JSON 参数（不应发生），跳过该条目
        }
        this.toolCalls.set(event.toolCallId, input);
        return {
          type: "item_started",
          item: {
            id: event.toolCallId,
            role: "tool",
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            input,
            content: [],
            timestamp: Date.now(),
            status: "running",
            isError: false,
          },
        };
      }
      default:
        return undefined;
    }
  }

  /** 把当前分支的会话条目投影为协议 transcript（跳过非消息条目）。 */
  transcript(entries: readonly SessionEntry[]): TranscriptItem[] {
    if (
      entries.length === this.cachedEntries.length &&
      entries.every((entry, index) => entry.id === this.cachedEntries[index]?.id)
    )
      return this.cachedTranscript;
    const toolCalls = new Map<string, JsonValue>();
    const items: TranscriptItem[] = [];
    for (const entry of entries) {
      if (entry.type !== "message") continue;
      const message = entry.message;
      if (message.role === "user") {
        items.push(toProtocolUserMessage(message, { id: entry.id }));
      } else if (message.role === "assistant") {
        this.indexToolCalls(message.content, toolCalls);
        items.push(toProtocolAssistantMessage(message, { id: entry.id }));
      } else if (message.role === "toolResult") {
        const args = toolCalls.get(message.toolCallId);
        if (args === undefined) continue; // 找不到对应调用，无法构造输入
        items.push(this.toolItem(message, args));
      }
    }
    this.cachedEntries = entries;
    this.cachedTranscript = items;
    return items;
  }

  private messageProgress(
    message: SessionMessage,
    stage: "started" | "updated" | "finished",
  ): TranscriptProgress | undefined {
    switch (message.role) {
      case "user":
        // user 条目不会变化，且 item_finished 不接受 user，只在开始时发一次
        if (stage !== "started") return undefined;
        return {
          type: "item_started",
          item: toProtocolUserMessage(message, { id: this.allocateId() }),
        };
      case "assistant": {
        this.indexToolCalls(message.content, this.toolCalls);
        const id =
          stage === "started"
            ? (this.streamingMessageId = this.allocateId())
            : (this.streamingMessageId ?? this.allocateId());
        const item = toProtocolAssistantMessage(message, { id });
        if (stage === "finished") {
          this.streamingMessageId = undefined;
          // item_finished 只接受终态（无 stopReason 的 streaming 成员被收窄排除）
          if ("stopReason" in item) return { type: "item_finished", item };
          return undefined;
        }
        if (stage === "updated") return { type: "item_updated", item };
        return { type: "item_started", item };
      }
      case "toolResult": {
        // running 占位已由 tool_execution_start 发出；完成态在结束时发一次
        if (stage !== "finished") return undefined;
        const args = this.toolCalls.get(message.toolCallId);
        if (args === undefined) return undefined;
        this.toolCalls.delete(message.toolCallId);
        const item = this.toolItem(message, args);
        // finished 阶段 toProtocolToolResultMessage 只产出终态（running 占位已由 tool_execution_start 发出）
        return {
          type: "item_finished",
          item: item as Extract<ToolTranscriptItem, { status: "complete" | "error" }>,
        };
      }
      default:
        return undefined; // 自定义消息（bash/custom/compaction 等）不进 transcript
    }
  }

  private toolItem(message: ToolResultMessage, args: JsonValue): ToolTranscriptItem {
    return toProtocolToolResultMessage(message, {
      id: message.toolCallId,
      call: {
        type: "toolCall",
        id: message.toolCallId,
        name: message.toolName,
        arguments: toolCallArguments(args),
      },
    });
  }

  /** 索引助手消息中的 toolCall 参数；非 JSON 参数（不应发生）跳过。 */
  private indexToolCalls(
    content: AssistantMessage["content"],
    index: Map<string, JsonValue>,
  ): void {
    for (const part of content) {
      if (part.type !== "toolCall") continue;
      try {
        index.set(part.id, toProtocolJsonValue(part.arguments));
      } catch {
        // 不索引；对应 tool 条目将因找不到参数而跳过
      }
    }
  }

  private allocateId(): string {
    this.nextMessageId += 1;
    return `m${this.nextMessageId}`;
  }
}

/** 协议 ToolCall 要求参数为 JSON 对象；非对象参数按空对象处理（运行时同义）。 */
function toolCallArguments(value: JsonValue): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) return value;
  return {};
}
