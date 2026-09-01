import { createSSRApp } from "vue"
import { renderToString } from "@vue/server-renderer"
import { describe, expect, it } from "vitest"
import ToolSummaryGroup from "@features/transcript-view/components/ToolSummaryGroup.vue"
import type { ToolCallView, ToolGroup } from "@features/transcript-view/lib/transcript-rows.js"
import { directCommandItem } from "@features/transcript-view/lib/tool-summary.js"

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
  return renderToString(createSSRApp(ToolSummaryGroup, { group, expanded: new Map() }))
}

describe("命令工具组展示", () => {
  it("单条命令直接显示 command card，不渲染命令组和 Run 摘要", async () => {
    const html = await renderGroup({
      type: "tools",
      id: "group:c1",
      key: "command",
      items: [command("c1")],
    })

    expect(html).toContain('class="well"')
    expect(html).not.toContain("运行了 1 条命令")
    expect(html).not.toContain(">Run<")
  })

  it("多条命令保留可折叠的命令组摘要", () => {
    const group: ToolGroup = {
      type: "tools",
      id: "group:c1",
      key: "command",
      items: [command("c1"), command("c2")],
    }

    expect(directCommandItem(group)).toBeUndefined()
  })
})
