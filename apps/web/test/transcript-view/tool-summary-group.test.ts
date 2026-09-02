import { createSSRApp } from "vue"
import { renderToString } from "@vue/server-renderer"
import { describe, expect, it } from "vitest"
import ToolCall from "@features/transcript-view/components/ToolCall.vue"
import type {
  ToolCallView,
  ToolGroup,
  ToolRowStep,
} from "@features/transcript-view/lib/transcript-rows.js"
import { directGroupItem, toolSummaryDetail } from "@features/transcript-view/lib/tool-summary.js"

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

async function renderStep(step: Exclude<ToolRowStep, { type: "assistant" }>): Promise<string> {
  const app = createSSRApp(ToolCall, { step, expanded: new Map() })
  app.config.warnHandler = (message) => {
    if (!message.startsWith("SSR-optimized slot function")) throw new Error(message)
  }
  return renderToString(app)
}

describe("工具摘要详情", () => {
  it("单条文件路径只保留文件名", () => {
    expect(
      toolSummaryDetail([
        {
          id: "r1",
          toolName: "read",
          running: false,
          isError: false,
          input: { path: "G:/AICode/pig/apps/web/src/App.vue" },
          outputText: "",
          outputImages: [],
        },
      ]),
    ).toEqual({
      kind: "file",
      name: "App.vue",
      path: "G:/AICode/pig/apps/web/src/App.vue",
    })
  })
})

describe("思考预览", () => {
  it("流式思考自动展开并显示内容", async () => {
    const html = await renderStep({
      type: "thought",
      id: "thought:1",
      text: "正在检查时间线",
      streaming: true,
      startedAt: 1000,
    })

    expect(html).toContain("正在检查时间线")
    expect(html).toContain("is-open")
  })

  it("完成后收起并显示思考耗时", async () => {
    const html = await renderStep({
      type: "thought",
      id: "thought:1",
      text: "检查完成",
      streaming: false,
      startedAt: 1000,
      endedAt: 6000,
    })

    expect(html).not.toContain("is-open")
  })
})

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
