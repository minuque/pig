import type {
  AssistantTranscriptItem,
  ToolTranscriptItem,
  TranscriptItem,
  UserTranscriptItem,
} from "@earendil-works/pi-protocol";

export type TranscriptImageBlock = { data: string; mimeType: string };

export function isUserItem(item: TranscriptItem): item is UserTranscriptItem {
  return item.role === "user";
}

export function isAssistantItem(item: TranscriptItem): item is AssistantTranscriptItem {
  return item.role === "assistant";
}

export function transcriptText(item: TranscriptItem): string {
  return item.content
    .filter((block): block is { type: "text"; text: string } => block.type === "text")
    .map((block) => block.text)
    .join("");
}

export function transcriptImages(item: TranscriptItem): TranscriptImageBlock[] {
  return item.content
    .filter(
      (block): block is { type: "image"; data: string; mimeType: string } => block.type === "image",
    )
    .map((block) => ({ data: block.data, mimeType: block.mimeType }));
}

export function assistantThinking(item: AssistantTranscriptItem): string[] {
  return item.content
    .filter((block): block is { type: "thinking"; thinking: string } => block.type === "thinking")
    .map((block) => block.thinking)
    .filter(Boolean);
}

export function transcriptImageSrc(data: string, mimeType: string): string {
  if (data.startsWith("data:")) return data;
  return `data:${mimeType};base64,${data}`;
}

export function isVisibleTranscriptItem(item: TranscriptItem): boolean {
  if (isUserItem(item)) return transcriptText(item).length > 0 || transcriptImages(item).length > 0;
  if (isAssistantItem(item))
    return transcriptText(item).length > 0 || assistantThinking(item).length > 0;
  return true;
}

/** 可见条目：无文字且无图的用户句、仅有 toolCall 的助手句不占行。 */
export function conversationRows(items: readonly TranscriptItem[]): TranscriptItem[] {
  return items.filter(isVisibleTranscriptItem);
}

export function toolIconTone(item: ToolTranscriptItem): string {
  if (item.isError) return "var(--danger)";
  if (item.status === "running") return "var(--primary)";
  return "var(--accent-green)";
}
