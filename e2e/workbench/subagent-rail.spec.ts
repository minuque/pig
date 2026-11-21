import { expect, test } from "../support/fixtures.js"
import { CHILD_MARKER } from "../support/prebuild-session.js"
import { startSubagentTurn } from "../support/subagent-turn.js"

test("摘要面板：窗口变窄时从常驻卡收成头部浮层，变宽再回来", async ({ page, subagentGateway }) => {
  await page.setViewportSize({ width: 1600, height: 900 })
  await startSubagentTurn(page, subagentGateway)
  await expect(page.locator(".rail-toggle-docked")).toBeVisible()
  await expect(page.locator(".rail-docked")).toBeVisible()

  await page.setViewportSize({ width: 1000, height: 800 })
  await expect(page.locator(".rail-toggle-popover")).toBeVisible()
  await expect(page.locator(".rail-docked")).toHaveCount(0)

  await page.setViewportSize({ width: 1600, height: 900 })
  await expect(page.locator(".rail-toggle-docked")).toBeVisible()
  await expect(page.locator(".rail-docked")).toBeVisible()
})

test("subagent 子任务：时间线卡片与摘要面板都列出进展，点开在右侧面板里只读看子会话", async ({
  page,
  subagentGateway,
}) => {
  await page.setViewportSize({ width: 1000, height: 800 })
  await startSubagentTurn(page, subagentGateway)

  const toggle = page.locator(".rail-toggle-popover")
  await toggle.hover()
  await expect(page.locator('[data-slot="tooltip-content"]')).toContainText("1/2")
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

test("摘要面板：卡片可折叠、拖拽换位，刷新后保持", async ({ page, subagentGateway }) => {
  await page.setViewportSize({ width: 1680, height: 900 })
  await startSubagentTurn(page, subagentGateway)

  const rail = page.locator(".rail-docked")
  const titles = rail.locator(".rail-title")
  await expect(titles.first()).toHaveText("环境")
  await expect(titles.last()).toHaveText("后台任务")

  const headerBox = (await page.locator(".workbench-header").boundingBox())!
  const mainBox = (await page.locator(".shell > main").boundingBox())!
  expect(headerBox.x).toBeCloseTo(mainBox.x, 0)
  expect(headerBox.x + headerBox.width).toBeCloseTo(mainBox.x + mainBox.width, 0)

  const railBox = (await rail.boundingBox())!
  const composerBox = (await page.locator(".composer-stack").boundingBox())!
  expect(composerBox.x + composerBox.width).toBeLessThanOrEqual(railBox.x)
  const viewportBox = (await page.locator(".transcript-viewport").boundingBox())!
  expect(viewportBox.x + viewportBox.width).toBeGreaterThan(railBox.x)
  expect(railBox.x + railBox.width).toBeLessThanOrEqual(viewportBox.x + viewportBox.width + 1)

  const contextCard = rail.locator(".rail-card", { hasText: "上下文" })
  await contextCard.locator(".ctx-row button").first().click()
  const preview = page.getByRole("dialog")
  const body = preview.locator(".preview-body")
  await expect(body).not.toBeEmpty({ timeout: 30_000 })
  await expect(body).not.toHaveText("无法加载预览。")
  await expect(page.locator(".rail-pane")).toHaveCount(0)
  await preview.getByRole("button", { name: "查看源码" }).click()
  await expect(preview.locator(".file-code-line").first()).toBeVisible()
  await preview.getByRole("button", { name: "关闭" }).last().click()
  await expect(preview).toBeHidden()

  const env = rail.locator(".rail-card").first()
  const envHead = env.locator(".rail-head")
  await envHead.click()
  await expect(envHead).toHaveAttribute("aria-expanded", "false")
  await expect(env.locator(".rail-summary")).toHaveText("本机")

  const tasks = rail.locator(".rail-card").last()
  const tasksHead = tasks.locator(".rail-head")
  const expanded = await tasksHead.getAttribute("aria-expanded")
  const from = (await tasksHead.boundingBox())!
  const top = (await env.boundingBox())!
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(from.x + from.width / 2, top.y - 160, { steps: 16 })
  await page.mouse.up()
  await expect(titles.first()).toHaveText("后台任务")
  await expect(rail.locator(".rail-head").first()).toHaveAttribute("aria-expanded", expanded!)

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

  const toggle = page.locator(".rail-toggle-docked")
  await expect(toggle).toHaveAttribute("aria-pressed", "true")
  await toggle.click()
  await expect(rail).toBeHidden()
  await page.reload()
  await page.locator(".session-card").first().click()
  await expect(toggle).toHaveAttribute("aria-pressed", "false", { timeout: 30_000 })
  await expect(rail).toBeHidden()
})
