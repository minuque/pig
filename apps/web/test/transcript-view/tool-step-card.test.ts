import { createSSRApp } from "vue"
import { renderToString } from "@vue/server-renderer"
import { describe, expect, it } from "vitest"
import ToolStepCard from "@features/transcript-view/components/ToolStepCard.vue"

describe("ToolRow 共享卡片", () => {
  it("思考类型由共享卡片提供内部形态", async () => {
    const html = await renderToString(createSSRApp(ToolStepCard, { variant: "thought" }))

    expect(html).toContain("tool-step-card")
    expect(html).toContain("is-thought")
  })
})
