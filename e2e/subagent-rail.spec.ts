import { expect, test } from "./fixtures.js"
import { CHILD_MARKER } from "./prebuild-session.js"
import { startSubagentTurn } from "./subagent-turn.js"

test("subagent 子任务：时间线卡片与摘要面板都列出进展，点开在抽屉里只读看子会话", async ({
  page,
  subagentGateway,
}) => {
  await startSubagentTurn(page, subagentGateway)

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

test("摘要面板：卡片可折叠、拖拽换位，刷新后保持", async ({ page, subagentGateway }) => {
  await page.setViewportSize({ width: 1680, height: 900 })
  await startSubagentTurn(page, subagentGateway)

  const rail = page.locator(".rail-docked")
  const titles = rail.locator(".rail-title")
  await expect(titles.first()).toHaveText("环境")
  await expect(titles.last()).toHaveText("任务")

  // 收起环境：正文收起，标题行显示摘要
  const env = rail.locator(".rail-card").first()
  const envHead = env.locator(".rail-head")
  await envHead.click()
  await expect(envHead).toHaveAttribute("aria-expanded", "false")
  await expect(env.locator(".rail-summary")).toHaveText("本机")

  // 拖任务卡的把手到最上方
  const tasks = rail.locator(".rail-card").last()
  await tasks.hover()
  const from = (await tasks.locator(".rail-grip").boundingBox())!
  const top = (await env.boundingBox())!
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(from.x + from.width / 2, top.y - 160, { steps: 16 })
  await page.mouse.up()
  await expect(titles.first()).toHaveText("任务")

  // 排列与开合记在本地，刷新后仍是这样
  await page.reload()
  await page.locator(".session-card").first().click()
  await expect(rail.locator(".rail-head", { hasText: "环境" })).toHaveAttribute(
    "aria-expanded",
    "false",
    {
      timeout: 30_000,
    },
  )
  const order = await page.evaluate(() => localStorage.getItem("pig.rail.layout"))
  expect(JSON.parse(order ?? "{}").order[0]).toBe("tasks")
})
