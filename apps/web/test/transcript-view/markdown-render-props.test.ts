import { describe, expect, it } from "vitest"
import {
  chatMarkdownProps,
  withoutHeavyBlocks,
} from "@features/transcript-view/lib/markdown-render-props.js"

describe("chatMarkdownProps", () => {
  it("历史先轻量，rich 和流式才上完整渲染", () => {
    const light = chatMarkdownProps({ streaming: false, isDark: false })
    expect(light.renderCodeBlocksAsPre).toBe(true)
    expect(light.mode).toBe("minimal")
    const history = chatMarkdownProps({ streaming: false, isDark: false, rich: true })
    expect(history.nodeVirtual).toBe(true)
    expect(history.maxLiveNodes).toBeGreaterThan(0)
    expect(history.batchRendering).toBe(true)
    expect(history.renderBatchBudgetMs).toBe(8)
    expect(history.renderCodeBlocksAsPre).toBeUndefined()
    const live = chatMarkdownProps({ streaming: true, isDark: false })
    expect(live.nodeVirtual).toBe(false)
    expect(live.maxLiveNodes).toBe(0)
    expect(live.batchRendering).toBe(true)
    expect(live.renderBatchBudgetMs).toBe(8)
  })
})

describe("withoutHeavyBlocks", () => {
  it("去掉 infographic 和 mermaid 围栏", () => {
    const text = ["# 标题", "", "```infographic", '{ "x": 1 }', "```", "", "正文", ""].join("\n")
    expect(withoutHeavyBlocks(text)).toBe("# 标题\n\n\n\n正文")
  })
})
