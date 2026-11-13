import { BG_AGENT_TITLE, BG_FAIL_TITLE, BG_TASK_TITLE } from "./background-task-agent.js"
import { expect, seedWorkspace, test, type E2eGateway } from "./fixtures.js"
import type { Page } from "@playwright/test"

async function runCommand(page: Page, gateway: E2eGateway, command: string) {
  await page.setViewportSize({ width: 1680, height: 900 })
  await page.emulateMedia({ reducedMotion: "reduce" })
  await seedWorkspace(page, gateway.workspaceId)
  await page.goto(gateway.entryUrl)

  const field = page.locator(".composer .field, .field").first()
  await expect(field).toBeVisible({ timeout: 30_000 })
  await field.click()
  await page.keyboard.type(command)
  await page.keyboard.press("Escape")
  await page.locator("button.send").click()
}

test("开发服务器：后台命令在跑，输出在走；切走再切回还在跑；点停止变成已停止", async ({
  page,
  backgroundTaskGateway,
}) => {
  await runCommand(page, backgroundTaskGateway, "/bg")

  const rail = page.locator(".rail-docked")
  const task = rail.locator(".rail-task", { hasText: BG_TASK_TITLE })
  await expect(task).toHaveAttribute("data-status", "running", { timeout: 30_000 })
  await expect(rail.getByText("进行中")).toBeVisible()

  // 展开看输出：命令的输出实时进来
  await task.locator(".rail-task-title").click()
  const output = task.locator(".rail-task-output pre")
  await expect(output).toContainText("tick", { timeout: 30_000 })

  // 往上翻看早先的输出：新输出和每秒走的计时都不把视图拽回底部
  await output.evaluate((el) => (el.scrollTop = 0))
  await page.waitForTimeout(1500)
  expect(await output.evaluate((el) => el.scrollTop)).toBe(0)

  // 回到新建页再切回这个会话：任务还在跑
  await page.getByRole("button", { name: "新建会话" }).first().click()
  await expect(rail).toBeHidden()
  await page.locator(".session-card").last().click()
  await expect(task).toHaveAttribute("data-status", "running", { timeout: 30_000 })

  await task.getByRole("button", { name: "停止这个任务" }).click()
  await expect(task).toHaveAttribute("data-status", "stopped", { timeout: 30_000 })
  await expect(rail.getByText("已结束")).toBeVisible()
  await expect(page.locator(".task-notice")).toContainText("后台命令已停止")
  await expect(page.locator(".task-notice")).toContainText(BG_TASK_TITLE)

  // 清除已结束：任务从面板上消失，刷新后也不回来
  await rail.getByRole("button", { name: "清除已结束的任务" }).click()
  await expect(task).toHaveCount(0)
})

test("长耗时命令失败：任务显示失败，时间线出现失败通知", async ({
  page,
  backgroundTaskGateway,
}) => {
  await runCommand(page, backgroundTaskGateway, "/bg-fail")

  const task = page.locator(".rail-docked .rail-task", { hasText: BG_FAIL_TITLE })
  await expect(task).toHaveAttribute("data-status", "failed", { timeout: 30_000 })
  await expect(task).toContainText("失败")
  await expect(page.locator(".task-notice").first()).toContainText("后台命令失败")

  await task.locator(".rail-task-title").click()
  await expect(task.locator(".rail-task-output pre")).toContainText("boom")
})

test("后台代理：摘要面板能停止它，停止后时间线出现通知", async ({
  page,
  backgroundTaskGateway,
}) => {
  await runCommand(page, backgroundTaskGateway, "/bg-agent")

  const task = page.locator(".rail-docked .rail-task", { hasText: BG_AGENT_TITLE })
  await expect(task).toHaveAttribute("data-status", "running", { timeout: 30_000 })

  await task.getByRole("button", { name: "停止这个任务" }).click()
  await expect(task).toHaveAttribute("data-status", "stopped", { timeout: 30_000 })
  await expect(page.locator(".task-notice")).toContainText("后台代理已停止")
})
