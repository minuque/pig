import type { Page } from "@playwright/test"
import type { TranscriptItem } from "@earendil-works/pi-protocol"
import { expect, seedWorkspace, test, type E2eGateway } from "../fixtures.js"
import { COMPLEX_SESSION_ID, COMPLEX_SESSION_NAME } from "../prebuild-session.js"
import { stabilize } from "./lib/stabilize.js"

// 固定内容走路由拦截，不用 complexGateway 的 fork 本机历史（跨机不确定）。
const HISTORY = [
  { id: "v-u1", role: "user", content: [{ type: "text", text: "看一下示例文件" }], timestamp: 1 },
  {
    id: "v-a1",
    role: "assistant",
    content: [
      { type: "text", text: "### 结果\n\n| 项目 | 状态 |\n| --- | --- |\n| 读取 | 完成 |" },
      { type: "toolCall", toolCallId: "v-t1", toolName: "read", input: { path: "src/example.ts" } },
    ],
    model: { provider: "test", id: "model" },
    timestamp: 2,
    status: "complete",
    stopReason: "stop",
  },
  {
    id: "v-t1",
    role: "tool",
    toolCallId: "v-t1",
    toolName: "read",
    input: { path: "src/example.ts" },
    content: [{ type: "text", text: "export const answer = 42\n" }],
    timestamp: 3,
    status: "complete",
    isError: false,
  },
] as unknown as TranscriptItem[]

test.describe("transcript 视觉", () => {
  test.use({ deviceScaleFactor: 1 })

  async function openTranscript(page: Page, gateway: E2eGateway) {
    await page.emulateMedia({ reducedMotion: "reduce" })
    await seedWorkspace(page, gateway.workspaceId)
    await page.route("**/api/v1/platform/transcript**", (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ items: HISTORY, timings: [], hasMore: false }),
      }),
    )
    await page.goto(gateway.entryUrl)
    await expect(page.locator("nav.session-list")).toBeVisible({ timeout: 30_000 })
    await page
      .locator(".session-card", { has: page.getByText(COMPLEX_SESSION_NAME, { exact: true }) })
      .click()
    await expect(page).toHaveURL(new RegExp(`/sessions/${COMPLEX_SESSION_ID}$`))
  }

  test("工具卡与消息渲染", async ({ page, complexGateway }) => {
    await openTranscript(page, complexGateway)
    await expect(page.getByText("看一下示例文件", { exact: true })).toBeVisible({ timeout: 30_000 })

    // 时间戳走 toLocaleString，跨时区会飘，遮掉
    const mask = await stabilize(page, [page.locator(".stamp")])
    const column = page.locator(".conversation-column")

    await expect(column).toHaveScreenshot("transcript-tools.png", {
      mask,
      maskColor: "#e5e5e5",
      maxDiffPixelRatio: 0,
    })
  })

  test("read 卡行号与代码预览", async ({ page, complexGateway }) => {
    await openTranscript(page, complexGateway)

    // 两级展开：先开工具组，再开单个 step
    await page.locator(".tool-steps .summary-btn").click()
    const step = page.locator(".tool-steps .step").first()
    await expect(step).toBeVisible({ timeout: 15_000 })
    await step.locator(".summary").click()

    const card = step.locator(".tool-step-card.is-read")
    await expect(card).toBeVisible({ timeout: 15_000 })
    const mask = await stabilize(page, [])

    await expect(card).toHaveScreenshot("read-step-card.png", {
      mask,
      maskColor: "#e5e5e5",
      maxDiffPixelRatio: 0,
    })
  })
})
