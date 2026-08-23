import { describe, expect, it } from "vitest";
import type { TranscriptItem, Usage } from "@earendil-works/pi-protocol";
import {
  contextUsagePercent,
  formatTokenCount,
  lastAssistantUsage,
  modelContextWindow,
  projectContextUsage,
  segmentShare,
} from "@features/chat-input/lib/context-usage.js";
import { contextUsageSummary } from "@features/chat-input/components/ContextUsagePanel.vue";
import {
  composerCwdLabel,
  contextUsageAriaLabel,
  usageRingOffset,
  USAGE_RING_LENGTH,
} from "@features/chat-input/components/ComposerMeta.vue";
import type { ChatInputVendor } from "@features/chat-input/types.js";

function usage(partial: Partial<Usage> = {}): Usage {
  return {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    ...partial,
  };
}

describe("formatTokenCount", () => {
  it("小于 1K 用整数，1K 到 100K 一位小数，更大取整", () => {
    expect(formatTokenCount(471)).toBe("471");
    expect(formatTokenCount(9100)).toBe("9.1K");
    expect(formatTokenCount(3000)).toBe("3.0K");
    expect(formatTokenCount(70300)).toBe("70.3K");
    expect(formatTokenCount(200_000)).toBe("200K");
  });
});

describe("projectContextUsage", () => {
  it("无 usage 时占用为 0，窗口仍保留", () => {
    expect(projectContextUsage(undefined, 200_000)).toEqual({
      used: 0,
      window: 200_000,
      percent: 0,
      segments: [],
    });
  });

  it("占用取 input，分段只展示大于 0 的 usage 字段", () => {
    const projected = projectContextUsage(
      usage({ input: 70_300, output: 200, cacheRead: 2000, reasoning: 500, totalTokens: 73_000 }),
      200_000,
    );
    expect(projected.used).toBe(70_300);
    expect(projected.window).toBe(200_000);
    expect(projected.percent).toBe(35);
    expect(projected.segments.map((segment) => segment.id)).toEqual([
      "input",
      "output",
      "cache",
      "reasoning",
    ]);
  });

  it("窗口为 0 时百分比为 0", () => {
    expect(contextUsagePercent(100, 0)).toBe(0);
    expect(segmentShare(50, 200)).toBe(25);
  });
});

describe("lastAssistantUsage / modelContextWindow", () => {
  it("从后往前取最近一条带 usage 的助手消息", () => {
    const items: TranscriptItem[] = [
      {
        id: "u1",
        role: "user",
        content: [{ type: "text", text: "hi" }],
        timestamp: 1,
      },
      {
        id: "a1",
        role: "assistant",
        status: "complete",
        stopReason: "stop",
        model: { provider: "xai", id: "grok" },
        content: [{ type: "text", text: "old" }],
        timestamp: 2,
        usage: usage({ input: 10 }),
      },
      {
        id: "a2",
        role: "assistant",
        status: "complete",
        stopReason: "stop",
        model: { provider: "xai", id: "grok" },
        content: [{ type: "text", text: "new" }],
        timestamp: 3,
        usage: usage({ input: 70_300 }),
      },
    ];
    expect(lastAssistantUsage(items)?.input).toBe(70_300);
    expect(lastAssistantUsage(items.slice(0, 1))).toBeUndefined();
  });

  it("按 provider/id 从目录取 contextWindow", () => {
    const catalog: ChatInputVendor[] = [
      {
        id: "xai",
        name: "xAI",
        models: [{ id: "grok", name: "Grok", thinkingLevels: ["off"], contextWindow: 200_000 }],
      },
    ];
    expect(modelContextWindow(catalog, { provider: "xai", id: "grok" })).toBe(200_000);
    expect(modelContextWindow(catalog, { provider: "xai", id: "missing" })).toBe(0);
    expect(modelContextWindow(catalog, undefined)).toBe(0);
  });
});

describe("composer meta / panel copy", () => {
  it("目录只取路径末段", () => {
    expect(composerCwdLabel("G:\\AICode\\pig")).toBe("pig");
    expect(composerCwdLabel(undefined)).toBe("");
  });

  it("占用环按百分比切弧长", () => {
    expect(usageRingOffset(0)).toBe(USAGE_RING_LENGTH);
    expect(usageRingOffset(100)).toBe(0);
    expect(usageRingOffset(50)).toBeCloseTo(USAGE_RING_LENGTH / 2);
  });

  it("面板摘要与按钮标签用中文占用口径", () => {
    const projected = projectContextUsage(usage({ input: 70_300, output: 1 }), 200_000);
    expect(contextUsageSummary(projected)).toBe("70.3K / 200K token");
    expect(contextUsageAriaLabel(projected)).toBe("上下文占用 35%");
  });
});
