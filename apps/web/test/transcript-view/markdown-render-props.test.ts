import { describe, expect, it } from "vitest"
import { chatMarkdownProps } from "@features/transcript-view/lib/markdown-render-props.js"

const theme = { isDark: true, codeBlockProps: { theme: "dark-plus" as const } }

describe("chatMarkdownProps", () => {
  it("历史揭开前推迟节点，揭开后铺完", () => {
    expect(chatMarkdownProps({ ...theme, streaming: false }).deferNodesUntilVisible).toBe(true)
    expect(
      chatMarkdownProps({ ...theme, streaming: false, settleMarkdown: true })
        .deferNodesUntilVisible,
    ).toBe(false)
  })

  it("流式不按可见性推迟", () => {
    expect(chatMarkdownProps({ ...theme, streaming: true }).deferNodesUntilVisible).toBe(false)
  })
})
