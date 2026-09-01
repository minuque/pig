import { createSSRApp } from "vue"
import { renderToString } from "@vue/server-renderer"
import { describe, expect, it } from "vitest"
import ToolStepCard from "@features/transcript-view/components/ToolStepCard.vue"

describe("ToolRow 共享卡片", () => {
  it("命令类型由共享卡片渲染内部结构", async () => {
    const html = await renderToString(
      createSSRApp(ToolStepCard, {
        variant: "command",
        command: "echo test",
        cwd: "C:/workspace/pig",
        outputText: "test",
        outputImages: [],
        emptyOutput: "(no output)",
        status: "success",
        statusLabel: "执行完成",
      }),
    )

    expect(html).toContain("command-heading")
    expect(html).toContain("echo test")
    expect(html).toContain("test")
  })

  it("思考类型由共享卡片提供内部形态", async () => {
    const html = await renderToString(
      createSSRApp(ToolStepCard, {
        variant: "thought",
        text: "检查工具输出",
      }),
    )

    expect(html).toContain("tool-step-card")
    expect(html).toContain("is-thought")
    expect(html).toContain("检查工具输出")
  })

  it("普通工具类型由共享卡片渲染入参和输出", async () => {
    const html = await renderToString(
      createSSRApp(ToolStepCard, {
        variant: "tool",
        inputFull: '{"path":"a.ts"}',
        outputText: "ok",
        outputImages: [],
        emptyOutput: "(no output)",
        outputLabel: "输出",
      }),
    )

    expect(html).toContain("入参")
    expect(html).toContain("输出")
    expect(html).toContain("ok")
  })
})
