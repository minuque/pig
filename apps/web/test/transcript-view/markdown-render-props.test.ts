import { describe, expect, it } from "vitest"
import { chatMarkdownProps } from "@features/transcript-view/lib/markdown-render-props.js"

describe("chatMarkdownProps", () => {
  it("历史长文开窗口并分帧，流式只分帧", () => {
    const history = chatMarkdownProps({ streaming: false, isDark: false })
    expect(history.nodeVirtual).toBe(true)
    expect(history.maxLiveNodes).toBeGreaterThan(0)
    expect(history.batchRendering).toBe(true)
    expect(history.renderBatchBudgetMs).toBe(8)
    const live = chatMarkdownProps({ streaming: true, isDark: false })
    expect(live.nodeVirtual).toBe(false)
    expect(live.maxLiveNodes).toBe(0)
    expect(live.batchRendering).toBe(true)
    expect(live.renderBatchBudgetMs).toBe(8)
  })
})
