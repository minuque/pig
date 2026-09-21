import { describe, expect, it } from "vitest"
import { chatMarkdownProps } from "@features/transcript-view/lib/markdown-render-props.js"

describe("chatMarkdownProps", () => {
  it("历史挂载即终态，流式仍 defer；节点虚拟化交给库，单帧预算 8ms", () => {
    const history = chatMarkdownProps({ streaming: false, isDark: false })
    expect(history.nodeVirtual).toBe("auto")
    expect(history.maxLiveNodes).toBe(0)
    expect(history.batchRendering).toBe(true)
    expect(history.renderBatchBudgetMs).toBe(8)
    expect(history.deferNodesUntilVisible).toBe(false)
    expect(history.viewportPriority).toBe(false)
    const live = chatMarkdownProps({ streaming: true, isDark: false })
    expect(live.nodeVirtual).toBe("auto")
    expect(live.maxLiveNodes).toBe(0)
    expect(live.batchRendering).toBe(true)
    expect(live.renderBatchBudgetMs).toBe(8)
    expect(live.deferNodesUntilVisible).toBe(true)
    expect(live.viewportPriority).toBe(false)
  })

  it("有 sessionKey 时历史开虚拟滚动并可恢复状态，流式关闭", () => {
    const history = chatMarkdownProps({ streaming: false, isDark: false, sessionKey: "md:a1" })
    expect(history.virtualScroll).toMatchObject({ enabled: true, sessionKey: "md:a1" })
    const live = chatMarkdownProps({ streaming: true, isDark: false, sessionKey: "md:a1" })
    expect(live.virtualScroll).toMatchObject({ enabled: false, sessionKey: "md:a1" })
    const bare = chatMarkdownProps({ streaming: false, isDark: false })
    expect(bare.virtualScroll).toBeUndefined()
  })
})
