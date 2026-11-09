import { expect, seedWorkspace, test } from "./fixtures.js"
import { CHILD_MARKER, CHILD_SESSION_ID, FILLER_PREFIX } from "./prebuild-session.js"
import { installTurnBridge } from "./sim-turn.js"

test("subagent 子任务：时间线卡片与摘要面板都列出进展，点开在抽屉里只读看子会话", async ({
  page,
  subagentGateway,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await seedWorkspace(page, subagentGateway.workspaceId)
  const bridge = await installTurnBridge(page)
  await page.goto(subagentGateway.entryUrl)

  // 子会话不进侧栏
  await expect(page.locator(".session-card")).toHaveCount(1, { timeout: 30_000 })
  await page.locator(".session-card").first().click()
  await expect(page.getByText(`${FILLER_PREFIX} 1 的内容`)).toBeVisible({ timeout: 30_000 })

  await page.getByRole("textbox", { name: "Prompt" }).fill("派两个子任务")
  await page.locator("button.send").click()
  const sessionId = await bridge.waitForPrompt()
  bridge.send({
    type: "event",
    event: {
      type: "session_progress",
      sessionId,
      progress: {
        type: "item_started",
        item: {
          id: "call-sub",
          role: "tool",
          toolCallId: "call-sub",
          toolName: "subagent",
          input: { tasks: [] },
          content: [],
          details: {
            mode: "parallel",
            results: [
              {
                agent: "scout",
                task: "摸清协议层",
                status: "done",
                sessionId: CHILD_SESSION_ID,
                steps: ["read websocket.ts"],
                usage: { input: 1, output: 1, cost: 0 },
              },
              {
                agent: "planner",
                task: "出方案",
                status: "running",
                steps: ["read service.ts"],
                usage: { input: 0, output: 0, cost: 0 },
              },
            ],
          },
          timestamp: Date.now(),
          status: "running",
          isError: false,
        },
      },
    },
  })

  // 窄于常驻宽度：右上角按钮带进度，点开浮层看 Task 块
  const toggle = page.locator(".rail-toggle")
  await expect(toggle).toContainText("1/2")
  await toggle.click()
  const popover = page.locator(".rail-popover")
  await expect(popover.getByText("planner")).toBeVisible()
  await expect(popover.getByText("read service.ts")).toBeVisible()

  await popover.getByRole("button", { name: /scout/ }).click()
  const drawer = page.locator(".child-drawer")
  await expect(drawer.getByText("子任务 · 只读")).toBeVisible()
  await expect(drawer.getByText(CHILD_MARKER)).toBeVisible({ timeout: 30_000 })
})
