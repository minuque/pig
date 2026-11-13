import { expect, test } from "./fixtures.js"
import { CHILD_MARKER } from "./prebuild-session.js"
import { startSubagentTurn } from "./subagent-turn.js"

test("subagent 子任务：时间线卡片与摘要面板都列出进展，点开在抽屉里只读看子会话", async ({
  page,
  subagentGateway,
}) => {
  // 会话面板窄于 1012px：摘要面板收成头部按钮加浮层
  await page.setViewportSize({ width: 1000, height: 800 })
  await startSubagentTurn(page, subagentGateway)

  // 窄于常驻宽度：头部图标按钮，悬停提示带进度，点开浮层看 Task 块
  const toggle = page.locator(".rail-toggle-popover")
  await toggle.hover()
  await expect(page.locator(".rt-TooltipContent")).toContainText("1/2")
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

  // 摘要面板独占右列：输入框让位，不压在面板下
  const railBox = (await rail.boundingBox())!
  const composerBox = (await page.locator(".composer-stack").boundingBox())!
  expect(composerBox.x + composerBox.width).toBeLessThanOrEqual(railBox.x)
  // 正文滚动区横跨到最右，滚动条贴边，不夹在正文和面板之间
  const viewportBox = (await page.locator(".transcript-viewport").boundingBox())!
  const panelBox = (await page.locator(".session-panel").boundingBox())!
  expect(viewportBox.x + viewportBox.width).toBeCloseTo(panelBox.x + panelBox.width, 0)

  // 上下文展开：按分类列 token 与占比，点分类在模态框里看实际进上下文的内容
  const contextCard = rail.locator(".rail-card", { hasText: "上下文" })
  await contextCard.locator("button.ctx-row").first().click()
  const preview = page.locator(".ctx-preview")
  await expect(preview.locator(".ctx-preview-text")).not.toBeEmpty({ timeout: 30_000 })
  await expect(preview.locator(".ctx-preview-text")).not.toHaveText("无法加载预览。")
  await page.keyboard.press("Escape")
  await expect(preview).toBeHidden()

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

  // 头部按钮收起常驻面板，刷新后仍收起
  const toggle = page.locator(".rail-toggle-docked")
  await expect(toggle).toHaveAttribute("aria-pressed", "true")
  await toggle.click()
  await expect(rail).toBeHidden()
  await page.reload()
  await page.locator(".session-card").first().click()
  await expect(toggle).toHaveAttribute("aria-pressed", "false", { timeout: 30_000 })
  await expect(rail).toBeHidden()
})
