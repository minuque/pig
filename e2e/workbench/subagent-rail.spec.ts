import { expect, test } from "../support/fixtures.js"
import { CHILD_MARKER } from "../support/prebuild-session.js"
import { startSubagentTurn } from "../support/subagent-turn.js"

test("摘要抽屉：打开时只盖住右边一条，下面的对话照常能输入", async ({ page, subagentGateway }) => {
  await page.setViewportSize({ width: 1600, height: 900 })
  await startSubagentTurn(page, subagentGateway)
  await page.locator(".rail-toggle").click()
  const drawer = page.locator(".rail-drawer")
  await expect(drawer.getByText("planner")).toBeVisible()

  const composer = page.getByRole("textbox", { name: "Prompt" })
  await composer.click()
  await page.keyboard.type("still typing")
  await expect(composer).toContainText("still typing")
  await expect(drawer).toBeVisible()

  const drawerBox = (await drawer.boundingBox())!
  const headerBox = (await page.locator(".workbench-header").boundingBox())!
  expect(drawerBox.y).toBeGreaterThanOrEqual(headerBox.y)
})

test("subagent 子任务：时间线卡片与摘要面板都列出进展，点开在右侧面板里只读看子会话", async ({
  page,
  subagentGateway,
}) => {
  await page.setViewportSize({ width: 1000, height: 800 })
  await startSubagentTurn(page, subagentGateway)

  const toggle = page.locator(".rail-toggle")
  await toggle.hover()
  await expect(page.locator('[data-slot="tooltip-content"][data-open]')).toContainText("1/2")
  await toggle.click()
  const drawer = page.locator(".rail-drawer").first()
  await expect(drawer.getByText("planner")).toBeVisible()

  await drawer.locator(".task-row-open").first().click()
  const pane = page.locator(".rail-pane")
  await expect(pane.getByText("read service.ts")).toBeVisible()

  await pane
    .locator(".rail-task", { hasText: "scout" })
    .getByRole("button", { name: "查看过程" })
    .click()
  await expect(pane.getByText("子任务 · 只读")).toBeVisible()
  await expect(pane.getByText(CHILD_MARKER)).toBeVisible({ timeout: 30_000 })
})

test("摘要面板：分节可折叠，刷新后保持", async ({ page, subagentGateway }) => {
  await page.setViewportSize({ width: 1680, height: 900 })
  await startSubagentTurn(page, subagentGateway)

  await page.locator(".rail-toggle").click()
  const rail = page.locator(".rail-drawer")
  const titles = rail.locator(".rail-title")
  await expect(titles.first()).toHaveText("环境")
  await expect(titles.last()).toHaveText("后台任务")

  const contextCard = rail.locator(".rail-part", { hasText: "上下文" })
  await contextCard.locator(".ctx-row button").first().click()
  const preview = page.getByRole("dialog").filter({ has: page.locator(".preview-body") })
  const body = preview.locator(".preview-body")
  await expect(body).not.toBeEmpty({ timeout: 30_000 })
  await expect(body).not.toHaveText("无法加载预览。")
  await expect(page.locator(".rail-pane")).toHaveCount(0)
  await preview.getByRole("button", { name: "查看源码" }).click()
  await expect(preview.locator(".file-code-line").first()).toBeVisible()
  await preview.getByRole("button", { name: "关闭" }).last().click()
  await expect(preview).toBeHidden()

  const env = rail.locator(".rail-part").first()
  const envHead = env.locator(".rail-head")
  await envHead.click()
  await expect(envHead).toHaveAttribute("aria-expanded", "false")
  await expect(env.locator(".rail-summary")).toHaveText("本机")

  await page.reload()
  await page.locator(".session-card").first().click()
  await page.locator(".rail-toggle").click({ timeout: 30_000 })
  await expect(rail.locator(".rail-head", { hasText: "环境" })).toHaveAttribute(
    "aria-expanded",
    "false",
  )
})
