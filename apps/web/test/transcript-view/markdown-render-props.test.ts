import { describe, expect, it } from "vitest"
import {
  chatMarkdownProps,
  plainMarkdownProps,
} from "@features/transcript-view/lib/markdown-render-props.js"

const theme = { isDark: true, codeBlockProps: { theme: "dark-plus" as const } }

describe("chatMarkdownProps", () => {
  it("非流式推迟重节点直到进视口", () => {
    expect(chatMarkdownProps({ ...theme, streaming: false }).deferNodesUntilVisible).toBe(true)
    expect(chatMarkdownProps({ ...theme, streaming: false }).viewportPriority).toBe(true)
  })

  it("流式不按可见性推迟，且不批挂、不虚拟化", () => {
    const props = chatMarkdownProps({ ...theme, streaming: true })
    expect(props.deferNodesUntilVisible).toBe(false)
    expect(props.batchRendering).toBe(false)
    expect(props.nodeVirtual).toBe(false)
    expect(props.maxLiveNodes).toBe(0)
  })
})

describe("plainMarkdownProps", () => {
  it("思考卡不批挂、不虚拟化", () => {
    const props = plainMarkdownProps({ streaming: true, isDark: true })
    expect(props.batchRendering).toBe(false)
    expect(props.nodeVirtual).toBe(false)
    expect(props.maxLiveNodes).toBe(0)
  })
})
