import type { Locator, Page } from "@playwright/test"
import { expect, seedWorkspace, test, type E2eGateway } from "./fixtures.js"
import { FILLER_PREFIX } from "./prebuild-session.js"

async function enter(page: Page, gateway: E2eGateway) {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await seedWorkspace(page, gateway.workspaceId)
  await page.goto(gateway.entryUrl)
  await expect(page.locator("nav.session-list")).toBeVisible({ timeout: 30_000 })
}

/** 默认按日期分组，六个批量会话都落在同一个桶里；行始终在 DOM，靠 grid-rows 折叠。 */
const section = (page: Page) => page.locator(".session-section").first()

test("侧栏分组默认收起，点开后列出会话", async ({ page, navGateway }) => {
  await enter(page, navGateway)

  const toggle = section(page).locator(".section-toggle")
  const group = section(page).locator(".session-list-group")

  await expect(toggle).toHaveAttribute("aria-expanded", "false")
  await expect(group).not.toHaveClass(/is-open/)
  await expect(toggle.locator(".section-count")).toHaveText("6")

  await toggle.click()
  await expect(toggle).toHaveAttribute("aria-expanded", "true")
  await expect(group).toHaveClass(/is-open/)
  await expect(toggle.locator(".section-count")).toHaveCount(0)

  await toggle.click()
  await expect(toggle).toHaveAttribute("aria-expanded", "false")
  await expect(group).not.toHaveClass(/is-open/)
})

test("显示更多每次多放一页", async ({ page, navGateway }) => {
  await enter(page, navGateway)
  await section(page).locator(".section-toggle").click()

  const cards = section(page).locator(".session-card")
  const more = section(page).locator(".more-button")

  // SECTION_PAGE 是 5，默认按更新时间倒序，最新的排最前
  await expect(cards).toHaveCount(5)
  await expect(cards.first()).toContainText(`${FILLER_PREFIX} 6`)

  await more.click()
  await expect(cards).toHaveCount(6)
  await expect(cards.last()).toContainText(`${FILLER_PREFIX} 1`)
  // 同一位置换成「收起」，再点回一页
  await expect(more).toHaveText(/收起/)
  await more.click()
  await expect(cards).toHaveCount(5)
  await expect(more).toHaveText(/显示更多/)
})

test("搜索弹层过滤并跳到选中会话", async ({ page, navGateway }) => {
  await enter(page, navGateway)

  await page.locator(".nav-footer").getByRole("button", { name: "搜索" }).click()

  const dialog = page.locator(".search-dialog")
  await expect(dialog).toBeVisible()

  // 回归：rt 面板靠 flex + margin:auto 对中，写 transform 位移会把它推离正中
  const box = await dialog.boundingBox()
  const viewport = page.viewportSize()
  expect(box).not.toBeNull()
  expect(viewport).not.toBeNull()
  expect(Math.abs(box!.x + box!.width / 2 - viewport!.width / 2)).toBeLessThanOrEqual(1)

  const input = dialog.locator(".search-input")
  await input.fill("批量会话 3")
  await expect(dialog.locator(".search-row")).toHaveCount(1)
  await expect(dialog.locator(".search-row")).toContainText(`${FILLER_PREFIX} 3`)

  await input.fill("没有这个会话")
  await expect(dialog.locator(".search-row")).toHaveCount(0)
  await expect(dialog.locator(".search-empty")).toHaveText("没有匹配的会话")

  await input.fill("批量会话 2")
  await dialog.locator(".search-row").first().click()
  await expect(page).toHaveURL(/\/sessions\/e2e-filler-1$/)
  await expect(dialog).toHaveCount(0)
})

/** 标题右缘离卡片内容区右缘的距离：状态位不该把标题挤短。 */
async function titleRightGap(card: Locator): Promise<number> {
  return card.evaluate((el) => {
    const title = el.querySelector<HTMLElement>(".title")
    const style = getComputedStyle(el)
    const contentRight = el.getBoundingClientRect().right - parseFloat(style.paddingInlineEnd)
    return contentRight - (title?.getBoundingClientRect().right ?? 0)
  })
}

test("状态位不挤占标题宽度：无状态行与草稿行都写满整行", async ({ page, navGateway }) => {
  await enter(page, navGateway)
  await section(page).locator(".section-toggle").click()

  const plain = section(page).locator(".session-card").first()
  // 打开会话后它不再算未读，行上就没有状态图标
  await plain.click()
  await expect(plain.locator(".state-icon")).toHaveCount(0)
  expect(await titleRightGap(plain)).toBeLessThanOrEqual(1)

  await page.getByRole("button", { name: "新建会话", exact: true }).click()
  const draft = page.locator(".session-card.is-placeholder")
  await expect(draft).toBeVisible()
  await expect(draft.locator(".state-icon")).toHaveCount(1)
  expect(await titleRightGap(draft)).toBeLessThanOrEqual(1)
})
