import type { ModelRef, TranscriptItem, Usage } from "@earendil-works/pi-protocol";
import type { ChatInputVendor } from "@features/chat-input/types.js";

export interface ContextUsageSegment {
  id: "input" | "output" | "cache" | "reasoning" | "conversation";
  label: string;
  tokens: number;
  color: string;
}

export interface ContextUsage {
  used: number;
  window: number;
  percent: number;
  segments: ContextUsageSegment[];
}

/** 欢迎页不传 cwd/usage，不展示底栏。 */
export function shouldShowComposerMeta(
  cwd: string | undefined,
  usage: ContextUsage | undefined,
): boolean {
  return cwd !== undefined || usage !== undefined;
}

const SEGMENT_DEFS = [
  { id: "input" as const, label: "输入", key: "input" as const, color: "var(--primary)" },
  { id: "output" as const, label: "输出", key: "output" as const, color: "var(--accent-sunset)" },
  { id: "cache" as const, label: "缓存", key: "cacheRead" as const, color: "var(--accent-dusk)" },
  {
    id: "reasoning" as const,
    label: "思考",
    key: "reasoning" as const,
    color: "var(--accent-green)",
  },
];

/** 从后往前取最近一条带 usage 的助手消息。 */
export function lastAssistantUsage(items: readonly TranscriptItem[]): Usage | undefined {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (item?.role === "assistant" && item.usage) return item.usage;
  }
  return undefined;
}

export function modelContextWindow(
  catalog: readonly ChatInputVendor[],
  model: ModelRef | undefined,
): number {
  if (!model) return 0;
  return (
    catalog
      .find((vendor) => vendor.id === model.provider)
      ?.models.find((entry) => entry.id === model.id)?.contextWindow ?? 0
  );
}

/** <1K 整数；1K–100K 一位小数；更大取整。 */
export function formatTokenCount(tokens: number): string {
  const abs = Math.max(0, tokens);
  if (abs < 1000) return String(Math.round(abs));
  const kilo = abs / 1000;
  if (abs < 100_000) return `${kilo.toFixed(1)}K`;
  return `${Math.round(kilo)}K`;
}

export function contextUsagePercent(used: number, window: number): number {
  if (window <= 0 || used <= 0) return 0;
  return Math.min(100, Math.round((used / window) * 100));
}

function usageField(usage: Usage, key: "input" | "output" | "cacheRead" | "reasoning"): number {
  if (key === "reasoning") return usage.reasoning ?? 0;
  return usage[key];
}

/**
 * 占用取 input（当前窗口），分段按 usage 字段。
 * 没有分段时，有占用就落成一条「会话」。
 */
export function projectContextUsage(usage: Usage | undefined, window: number): ContextUsage {
  const windowSafe = Math.max(0, window);
  if (!usage) {
    return { used: 0, window: windowSafe, percent: 0, segments: [] };
  }
  const segments: ContextUsageSegment[] = SEGMENT_DEFS.map((def) => ({
    id: def.id,
    label: def.label,
    tokens: usageField(usage, def.key),
    color: def.color,
  })).filter((segment) => segment.tokens > 0);
  const used = Math.max(usage.input, 0);
  if (used > 0 && segments.length === 0) {
    segments.push({
      id: "conversation",
      label: "会话",
      tokens: used,
      color: "var(--accent-sunset)",
    });
  }
  return {
    used,
    window: windowSafe,
    percent: contextUsagePercent(used, windowSafe),
    segments,
  };
}

export function segmentShare(tokens: number, window: number): number {
  if (window <= 0 || tokens <= 0) return 0;
  return Math.min(100, (tokens / window) * 100);
}
