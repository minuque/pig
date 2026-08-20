import type { SessionEntry } from "@earendil-works/pi-coding-agent";

/** 协议 SessionMetadata 不带消息数/模型；侧栏卡片从 Pi 文件投影。 */
export interface SessionCard {
  id: string;
  messageCount: number;
  model?: { provider: string; id: string };
}

/** 侧栏卡片用的当前模型：当前分支上最后一次 model_change。 */
export function modelFromBranch(
  entries: readonly SessionEntry[],
): { provider: string; id: string } | undefined {
  let model: { provider: string; id: string } | undefined;
  for (const entry of entries) {
    if (entry.type !== "model_change") continue;
    model = { provider: entry.provider, id: entry.modelId };
  }
  return model;
}
