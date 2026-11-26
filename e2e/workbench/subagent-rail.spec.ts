import { expect, test } from "../support/fixtures.js"
import { CHILD_MARKER } from "../support/prebuild-session.js"
import { startSubagentTurn } from "../support/subagent-turn.js"

test("subagent 子任务：时间线卡片与摘要面板都列出进展，点开在右侧面板里只读看子会话", async ({
  page,
  subagentGateway,
}) => {
  await page.setViewportSize({ width: 1000, height: 800 })
  await startSubagentTurn(page, subagentGateway)

  const toggle = page.locator(".rail-toggle-popover")
  await toggle.hover()
  await expect(page.locator('[data-slot="tooltip-content"][data-open]')).toContainText("1/2")
  await toggle.click()
  const popover = page.locator(".rail-popover")
  await expect(popover.getByText("planner")).toBeVisible()

  await popover.locator(".task-row-open").first().click()
  await expect(popover).toBeHidden()
  const pane = page.locator(".rail-pane")
  await expect(pane.getByText("read service.ts")).toBeVisible()

  await pane
    .locator(".rail-task", { hasText: "scout" })
    .getByRole("button", { name: "查看过程" })
    .click()
  await expect(pane.getByText("子任务 · 只读")).toBeVisible()
  await expect(pane.getByText(CHILD_MARKER)).toBeVisible({ timeout: 30_000 })
})
