import { expect, seedWorkspace, test } from "./fixtures.js"
import { COMPLEX_SESSION_NAME } from "./prebuild-session.js"

test("缩略图：回合刻度、上下回合按钮与键盘导航", async ({ page, complexGateway }) => {
  test.setTimeout(120_000)
  await page.emulateMedia({ reducedMotion: "reduce" })
  await seedWorkspace(page, complexGateway.workspaceId)
  await page.goto(complexGateway.entryUrl)
  await expect(page.locator("nav.session-list")).toBeVisible({ timeout: 30_000 })

  const card = page.locator(".session-card", {
    has: page.getByText(COMPLEX_SESSION_NAME, { exact: true }),
  })

  await expect(card).toBeVisible()
  await card.click()

  const minimap = page.locator(".timeline-minimap")
  await expect(minimap).toBeVisible({ timeout: 30_000 })
  const ticks = minimap.locator(".minimap-tick")
  expect(await ticks.count()).toBeGreaterThan(1)

  // 打开时贴底：当前是最后一个回合，上一个可用、下一个不可用
  const previous = minimap.locator(".minimap-nav.is-previous")
  await expect(previous).toBeEnabled()
  await expect(minimap.locator(".minimap-nav.is-next")).toBeDisabled()

  // 上一个回合：正文滚回上一轮
  const panel = page.locator("#transcript-panel")
  const before = await panel.evaluate((el) => el.scrollTop)
  await previous.click()
  await expect.poll(() => panel.evaluate((el) => el.scrollTop)).not.toBe(before)

  // 键盘：焦点在刻度上，方向键落到相邻回合
  await ticks.first().focus()
  await page.keyboard.press("ArrowDown")
  await expect(ticks.nth(1)).toBeFocused()
})
