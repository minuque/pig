import { describe, expect, it } from "vitest"
import {
  contextUsagePercent,
  contextUsageSummary,
  formatTokenCount,
  projectContextUsage,
  segmentShare,
  shouldShowComposerMeta,
  type ContextUsageEstimate,
} from "@features/chat-input/lib/context-usage.js"
import { contextPreviewPath } from "@features/chat-input/components/ContextUsagePanel.vue"
import {
  composerCwdLabel,
  contextUsageAriaLabel,
  usageRingOffset,
  USAGE_RING_LENGTH,
} from "@features/chat-input/components/ComposerMeta.vue"

function estimate(partial: Partial<ContextUsageEstimate> = {}): ContextUsageEstimate {
  return {
    used: 70_300,
    window: 200_000,
    segments: {
      systemPrompt: 3000,
      memory: 5000,
      skills: 2000,
      tools: 7000,
      toolResults: 3000,
      conversation: 45_000,
      other: 5300,
      idle: 129_700,
    },
    ...partial,
  }
}

describe("formatTokenCount", () => {
  it("小于 1K 用整数，1K 到 100K 一位小数，更大取整", () => {
    expect(formatTokenCount(471)).toBe("471")
    expect(formatTokenCount(9100)).toBe("9.1K")
    expect(formatTokenCount(3000)).toBe("3.0K")
    expect(formatTokenCount(70_300)).toBe("70.3K")
    expect(formatTokenCount(200_000)).toBe("200K")
  })
})

describe("projectContextUsage", () => {
  it("无估算时不展示占用", () => {
    expect(projectContextUsage(undefined)).toBeUndefined()
  })

  it("按固定顺序投影六类估算", () => {
    const projected = projectContextUsage(estimate())
    expect(projected?.used).toBe(70_300)
    expect(projected?.window).toBe(200_000)
    expect(projected?.percent).toBe(35)
    expect(projected?.segments.map((segment) => segment.id)).toEqual([
      "systemPrompt",
      "memory",
      "skills",
      "tools",
      "toolResults",
      "conversation",
      "other",
      "idle",
    ])
  })

  it("窗口为 0 时百分比为 0", () => {
    expect(contextUsagePercent(100, 0)).toBe(0)
    expect(segmentShare(50, 200)).toBe(25)
  })
})

describe("shouldShowComposerMeta", () => {
  it("欢迎页不传 cwd/usage 时不展示底栏", () => {
    expect(shouldShowComposerMeta(undefined, undefined)).toBe(false)
  })

  it("有目录或占用数据时展示", () => {
    expect(shouldShowComposerMeta("/repo", undefined)).toBe(true)
    expect(shouldShowComposerMeta(undefined, projectContextUsage(estimate()))).toBe(true)
  })
})

describe("composer meta / panel copy", () => {
  it("目录只取路径末段", () => {
    expect(composerCwdLabel("G:\\AICode\\pig")).toBe("pig")
    expect(composerCwdLabel(undefined)).toBe("")
  })

  it("占用环按百分比切弧长", () => {
    expect(usageRingOffset(0)).toBe(USAGE_RING_LENGTH)
    expect(usageRingOffset(100)).toBe(0)
    expect(usageRingOffset(50)).toBeCloseTo(USAGE_RING_LENGTH / 2)
  })

  it("面板摘要与按钮标签用中文占用口径", () => {
    const projected = projectContextUsage(estimate())!
    expect(contextUsageSummary(projected)).toBe("70.3K / 200K token")
    expect(contextUsageAriaLabel(projected)).toBe("上下文占用 35%")
  })

  it("可预览分段点进占用接口", () => {
    const projected = projectContextUsage(estimate())!
    expect(projected.segments.find((segment) => segment.id === "conversation")?.previewable).toBe(
      true,
    )
    expect(projected.segments.find((segment) => segment.id === "idle")?.previewable).toBe(false)
    expect(contextPreviewPath("s1", "skills")).toBe(
      "/api/v1/platform/context-usage?sessionId=s1&preview=skills",
    )
  })
})
