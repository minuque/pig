import type { Page } from "@playwright/test"

import { expect, seedWorkspace, type E2eGateway } from "./fixtures.js"
import { CHILD_SESSION_ID, FILLER_PREFIX } from "./prebuild-session.js"
import { installTurnBridge } from "./sim-turn.js"

/** 打开普通会话，发一句，再推一条带两个子任务的 subagent 工具条目。 */
export async function startSubagentTurn(page: Page, subagentGateway: E2eGateway) {
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
}
