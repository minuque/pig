import type { TranscriptItem } from "@earendil-works/pi-protocol";

/** 官方 TranscriptItem 的终态/进行态（assistant/tool 条目）。 */
export type TranscriptItemStatus = "streaming" | "running" | "complete" | "error" | "aborted";

/** 单条会话记录渲染为 UI 部件的分类结果；agent/tool 保留官方 status。 */
export type TranscriptPart =
  | { kind: "user"; text: string }
  | { kind: "agent"; text: string; thinking: string[]; status: TranscriptItemStatus }
  | { kind: "tool"; name: string; isError: boolean; text: string; status: TranscriptItemStatus };

interface Block {
  type?: unknown;
  text?: unknown;
  thinking?: unknown;
}

function textFromContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((block): block is Block => typeof block === "object" && block !== null)
    .map((block) => (typeof block.text === "string" ? block.text : ""))
    .join("");
}

/** 官方 TranscriptItem → UI 部件投影；无可见内容时返回 undefined。 */
export function projectTranscriptItem(item: TranscriptItem): TranscriptPart | undefined {
  if (item.role === "user") {
    const text = textFromContent(item.content);
    return text ? { kind: "user", text } : undefined;
  }
  if (item.role === "assistant") {
    const thinking = item.content
      .filter((block) => block.type === "thinking")
      .map((block) => block.thinking)
      .filter(Boolean);
    const text = textFromContent(item.content);
    if (!text && thinking.length === 0) return undefined;
    return { kind: "agent", text, thinking, status: item.status };
  }
  return {
    kind: "tool",
    name: item.toolName || "工具",
    isError: item.isError === true,
    text: textFromContent(item.content),
    status: item.status,
  };
}
