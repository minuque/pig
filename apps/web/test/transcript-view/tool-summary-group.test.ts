import { createSSRApp } from "vue"
import { renderToString } from "@vue/server-renderer"
import { describe, expect, it } from "vitest"
import ToolCall from "@features/transcript-view/components/ToolCall.vue"
import ToolSteps from "@features/transcript-view/components/ToolSteps.vue"
import type {
  ToolCallView,
  ToolGroup,
  ToolRow as ToolRowViewModel,
  ToolRowStep,
} from "@features/transcript-view/type.js"
import {
  directGroupItem,
  editDiffPreview,
  toolSummaryDetail,
} from "@features/transcript-view/lib/tool-summary.js"

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
  const app = createSSRApp(ToolCall, { step: group, isExpand: new Map() })
  app.config.warnHandler = (message) => {
    if (!message.startsWith("SSR-optimized slot function")) throw new Error(message)
  }
  return renderToString(app)
}

async function renderOpenGroup(group: ToolGroup): Promise<string> {
  const app = createSSRApp(ToolCall, {
    step: group,
    isExpand: new Map([[group.id, true]]),
  })
  app.config.warnHandler = (message) => {
    if (!message.startsWith("SSR-optimized slot function")) throw new Error(message)
  }
  return renderToString(app)
}

async function renderStep(step: Exclude<ToolRowStep, { type: "assistant" }>): Promise<string> {
  const app = createSSRApp(ToolCall, { step, isExpand: new Map() })
  app.config.warnHandler = (message) => {
    if (!message.startsWith("SSR-optimized slot function")) throw new Error(message)
  }
  return renderToString(app)
}

async function renderToolRow(row: ToolRowViewModel): Promise<string> {
  const app = createSSRApp(ToolSteps, {
    row,
    isExpand: false,
    expandedTools: new Map(),
  })
  app.config.warnHandler = (message) => {
    if (!message.startsWith("SSR-optimized slot function")) throw new Error(message)
  }
  return renderToString(app)
}

function fileCall(toolName: string, input: unknown): ToolCallView {
  return {
    id: "f1",
    toolName,
    running: false,
    isError: false,
    input,
    outputText: "",
    outputImages: [],
  }
}

describe("工具摘要详情", () => {
  it("单条文件路径只保留文件名", () => {
    expect(
      toolSummaryDetail([fileCall("read", { path: "G:/AICode/pig/apps/web/src/App.vue" })]),
    ).toEqual({
      kind: "file",
      name: "App.vue",
      path: "G:/AICode/pig/apps/web/src/App.vue",
    })
  })

  it("编辑工具按 oldText/newText 核增减行", () => {
    expect(
      toolSummaryDetail([
        fileCall("edit", {
          path: "apps/web/src/types/session-type.ts",
          edits: [
            {
              oldText: "export interface SessionCard {\n  id: string\n}",
              newText: "export interface SessionCard {\n  id: string\n  name: string\n}",
            },
          ],
        }),
      ]),
    ).toEqual({
      kind: "file",
      name: "session-type.ts",
      path: "apps/web/src/types/session-type.ts",
      added: 1,
      removed: 0,
    })
  })

  it("写入工具按 content 行数记新增", () => {
    expect(
      toolSummaryDetail([fileCall("write", { path: "notes.md", content: "a\nb\nc\n" })]),
    ).toEqual({
      kind: "file",
      name: "notes.md",
      path: "notes.md",
      added: 3,
      removed: 0,
    })
  })

  it("编辑入参不齐或写入空内容时不显示行统计", () => {
    expect(toolSummaryDetail([fileCall("edit", { path: "a.ts" })])).toEqual({
      kind: "file",
      name: "a.ts",
      path: "a.ts",
    })
    expect(toolSummaryDetail([fileCall("write", { path: "a.ts", content: "" })])).toEqual({
      kind: "file",
      name: "a.ts",
      path: "a.ts",
    })
  })

  it("成功编辑展开用 StreamDiff，失败仍走入参输出", async () => {
    const input = {
      path: "apps/web/src/types/session-type.ts",
      edits: [{ oldText: "a\n", newText: "a\nb\n" }],
    }
    expect(editDiffPreview(input)?.hunks).toEqual([{ original: "a\n", modified: "a\nb\n" }])
    expect(editDiffPreview({ path: "a.ts" })).toBeNull()
    const open = await renderOpenGroup({
      type: "tools",
      id: "group:e1",
      key: "edit",
      items: [fileCall("edit", input)],
    })
    expect(open).toContain("stream-diffs-vue-diff")
    expect(open).not.toContain(">入参<")
    const failed = await renderOpenGroup({
      type: "tools",
      id: "group:e2",
      key: "edit",
      items: [{ ...fileCall("edit", input), isError: true }],
    })
    expect(failed).toContain(">入参<")
    expect(failed).not.toContain("stream-diffs-vue-diff")
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
  it("单条命令保留摘要，展开后在其下显示 command card", async () => {
    const html = await renderGroup({
      type: "tools",
      id: "group:c1",
      key: "command",
      items: [command("c1")],
    })

    expect(html).toContain('class="tool-summary"')
    expect(html).toContain(' summary"')
    expect(html).toContain('style="display:none;"')
    expect(html).not.toContain(">Run<")
    expect(
      await renderOpenGroup({
        type: "tools",
        id: "group:c1",
        key: "command",
        items: [command("c1")],
      }),
    ).toContain("tool-step-card")
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

  it("单条 read 不显示重复的 Read 行，展开卡片贴齐摘要", async () => {
    const group: ToolGroup = {
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
    }
    const html = await renderOpenGroup(group)

    expect(html).toContain("tool-step-card")
    expect(html).not.toContain(">Read<")
  })
})

describe("运行态工具过程", () => {
  it("实时过程忽略手动折叠并给摘要添加 shimmer", async () => {
    const item = {
      ...command("live"),
      toolName: "read",
      running: true,
      input: { path: "G:/AICode/pig/apps/web/src/App.vue" },
    }
    const group: ToolGroup = {
      type: "tools",
      id: "group:live",
      key: "read",
      items: [item],
    }
    const html = await renderToolRow({
      id: "tools:live",
      role: "tools",
      mode: "live",
      turnStreaming: true,
      steps: [group],
      aborted: false,
      error: false,
    })
    expect(html).toContain("is-open")
    expect(html).toContain("shimmer")
  })

  it("流式 Turn 的中间工具行忽略折叠状态并保持展开", async () => {
    const html = await renderToolRow({
      id: "tools:middle",
      role: "tools",
      mode: "done",
      turnStreaming: true,
      steps: [
        {
          type: "tools",
          id: "group:middle",
          key: "read",
          items: [command("middle")],
        },
      ],
      aborted: false,
      error: false,
    })

    expect(html).toContain("is-open")
    expect(html).toContain("echo middle")
  })

  it("Turn 完成后中间工具行按折叠状态收起", async () => {
    const html = await renderToolRow({
      id: "tools:done",
      role: "tools",
      mode: "done",
      turnStreaming: false,
      steps: [
        {
          type: "tools",
          id: "group:done",
          key: "read",
          items: [command("done")],
        },
      ],
      aborted: false,
      error: false,
    })

    expect(html).not.toContain("is-open")
  })
})
