import { describe, expect, it } from "vitest"
import {
  chatMarkdownProps,
  plainMarkdownProps,
} from "@features/transcript-view/lib/markdown-render-props.js"

const theme = { isDark: true, codeBlockProps: { theme: "dark-plus" as const } }

describe("chatMarkdownProps", () => {
  it("历史揭开前推迟节点，揭开后铺完", () => {
    expect(chatMarkdownProps({ ...theme, streaming: false }).deferNodesUntilVisible).toBe(true)
    expect(
      chatMarkdownProps({ ...theme, streaming: false, settleMarkdown: true })
        .deferNodesUntilVisible,
    ).toBe(false)
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
