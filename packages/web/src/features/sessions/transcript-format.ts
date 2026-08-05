import type { TranscriptEntry } from "@no-pi-no-gang/contracts";

/** 单条会话记录（Pi SessionEntry）渲染为 UI 部件的分类结果。 */
export type TranscriptPart =
  | { kind: "user"; text: string }
  | { kind: "agent"; text: string; thinking: string[] }
  | { kind: "tool"; name: string; isError: boolean; text: string }
  | { kind: "other"; label: string; detail: string };

interface Block {
  type?: unknown;
  text?: unknown;
  thinking?: unknown;
}
interface MessageLike {
  role?: unknown;
  content?: unknown;
  toolName?: unknown;
  isError?: unknown;
}

function textFromContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((block): block is Block => typeof block === "object" && block !== null)
    .map((block) => (typeof block.text === "string" ? block.text : ""))
    .join("");
}

/** 将持久化 transcript 条目解析为 UI 部件；无可见内容时返回 undefined。 */
export function parseTranscriptEntry(entry: TranscriptEntry): TranscriptPart | undefined {
  if (entry.type !== "message") {
    return { kind: "other", label: String(entry.type ?? "entry"), detail: "" };
  }
  const message = entry.message;
  if (!message || typeof message !== "object") return undefined;
  const role = (message as MessageLike).role;
  if (role === "user") {
    const text = textFromContent((message as MessageLike).content);
    return text ? { kind: "user", text } : undefined;
  }
  if (role === "assistant") {
    const content = Array.isArray((message as MessageLike).content)
      ? ((message as MessageLike).content as Block[])
      : [];
    const thinking = content
      .filter((block) => block?.type === "thinking")
      .map((block) => (typeof block.thinking === "string" ? block.thinking : ""))
      .filter(Boolean);
    const text = textFromContent((message as MessageLike).content);
    if (!text && thinking.length === 0) return undefined;
    return { kind: "agent", text, thinking };
  }
  if (role === "toolResult") {
    const name = (message as MessageLike).toolName;
    return {
      kind: "tool",
      name: typeof name === "string" && name ? name : "工具",
      isError: (message as MessageLike).isError === true,
      text: textFromContent((message as MessageLike).content),
    };
  }
  return undefined;
}
