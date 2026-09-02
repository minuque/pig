import { createSSRApp } from "vue"
import { renderToString } from "@vue/server-renderer"
import { describe, expect, it } from "vitest"
import ToolCall from "@features/transcript-view/components/ToolCall.vue"
import type { ToolCallView, ToolGroup } from "@features/transcript-view/lib/transcript-rows.js"
import { directGroupItem } from "@features/transcript-view/lib/tool-summary.js"

function command(id: string): ToolCallView {
  return {
    id,
    toolName: "bash",
    running: false,
    isError: false,
    input: { command: `echo ${id}` },
    outputText: id,
    outputImages: [],
  }
}

async function renderGroup(group: ToolGroup): Promise<string> {
  const app = createSSRApp(ToolCall, { step: group, expanded: new Map() })
  app.config.warnHandler = (message) => {
    if (!message.startsWith("SSR-optimized slot function")) throw new Error(message)
  }
  return renderToString(app)
}

describe("命令工具组展示", () => {
  it("单条命令保留命令组摘要，直接在其下显示 command card", async () => {
    const html = await renderGroup({
      type: "tools",
      id: "group:c1",
      key: "command",
      items: [command("c1")],
    })

    expect(html).toContain('class="tool-summary"')
    expect(html).toContain(' summary"')
    expect(html).toContain("tool-step-card")
    expect(html).not.toContain(">Run<")
  })

  it("多条命令保留可折叠的命令组摘要", () => {
    const group: ToolGroup = {
      type: "tools",
      id: "group:c1",
      key: "command",
      items: [command("c1"), command("c2")],
    }

    expect(directGroupItem(group)).toBeUndefined()
  })

  it("单条 read 不显示重复的 Read 行，卡片贴齐摘要", async () => {
    const html = await renderGroup({
      type: "tools",
      id: "group:r1",
      key: "read",
      items: [
        {
          id: "r1",
          toolName: "read",
          running: false,
          isError: false,
          input: { path: "G:/AICode/pig/CONTEXT.md" },
          outputText: "# Pig\n",
          outputImages: [],
        },
      ],
    })

    expect(html).toContain("direct body-inner")
    expect(html).toContain("tool-step-card")
    expect(html).not.toContain(">Read<")
  })
})
