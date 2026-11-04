import type { Locator, Page } from "@playwright/test"
import { expect, seedWorkspace, test, type E2eGateway } from "./fixtures.js"
import { FILLER_PREFIX } from "./prebuild-session.js"

async function enter(page: Page, gateway: E2eGateway) {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await seedWorkspace(page, gateway.workspaceId)
  await page.goto(gateway.entryUrl)
  await expect(page.locator("nav.session-list")).toBeVisible({ timeout: 30_000 })
}

/** 收件箱没有段头：直接列出会话，架子靠段头收在列表底部。 */
const section = (page: Page) => page.locator('.session-section[data-key="active"]')

test("收件箱直接列出会话，按最近活动倒序", async ({ page, navGateway }) => {
  await enter(page, navGateway)

  const cards = section(page).locator(".session-card")
  await expect(cards).toHaveCount(6)
  await expect(cards.first()).toContainText(`${FILLER_PREFIX} 6`)
  await expect(cards.last()).toContainText(`${FILLER_PREFIX} 1`)
  await expect(section(page).locator(".section-head")).toHaveCount(0)
})

test("归档的会话离开收件箱，收进已归档段", async ({ page, navGateway }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await seedWorkspace(page, navGateway.workspaceId)
  await page.addInitScript(() => {
    localStorage.setItem("pig.sidebarSettledSessions", JSON.stringify(["e2e-filler-5"]))
  })
  await page.goto(navGateway.entryUrl)
  await expect(page.locator("nav.session-list")).toBeVisible({ timeout: 30_000 })

  const settled = page.locator('.session-section[data-key="settled"]')

  await expect(section(page).locator(".session-card")).toHaveCount(5)
  await expect(
    section(page).locator(".session-card", { hasText: `${FILLER_PREFIX} 6` }),
  ).toHaveCount(0)
  await expect(settled.locator(".section-count")).toHaveText("1")

  await settled.locator(".section-toggle").click()
  await expect(settled.locator(".session-card")).toHaveCount(1)
  await expect(settled.locator(".session-card")).toContainText(`${FILLER_PREFIX} 6`)
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

/** 用指针拖一行到目标中心：拖拽阈值为 5px，分步移动让 pointermove 生效。 */
async function dragCard(page: Page, from: Locator, to: Locator) {
  const start = await from.boundingBox()
  const end = await to.boundingBox()

  expect(start).not.toBeNull()
  expect(end).not.toBeNull()
  await page.mouse.move(start!.x + start!.width / 2, start!.y + start!.height / 2)
  await page.mouse.down()
  await page.mouse.move(end!.x + end!.width / 2, end!.y + end!.height / 2, { steps: 12 })
  await page.mouse.up()
}

test("拖拽会话进出置顶区：拖进置顶、拖出取消置顶", async ({ page, navGateway }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await seedWorkspace(page, navGateway.workspaceId)
  await page.addInitScript(() => {
    localStorage.setItem("pig.sidebarPinnedSessions", JSON.stringify(["e2e-filler-5"]))
  })
  await page.goto(navGateway.entryUrl)
  await expect(page.locator("nav.session-list")).toBeVisible({ timeout: 30_000 })

  const pinned = page.locator('.session-section[data-key="pinned"]')
  await expect(pinned.locator(".session-card")).toHaveCount(1)

  // 未置顶行拖进置顶区末尾
  const source = page.locator(".session-card", { hasText: "批量会话 4" }).first()
  await dragCard(page, source, pinned.locator(".session-card").last())
  await expect(pinned.locator(".session-card")).toHaveCount(2)
  await expect(pinned.locator(".session-card").last()).toContainText("批量会话 4")

  // 置顶行拖到收件箱首行：离开置顶区即取消置顶
  await dragCard(
    page,
    pinned.locator(".session-card").last(),
    section(page).locator(".session-card").first(),
  )
  await expect(pinned.locator(".session-card")).toHaveCount(1)
  await expect(pinned.locator(".session-card").first()).toContainText("批量会话 6")
})

test("没有置顶时拖起会话露出置顶落点", async ({ page, navGateway }) => {
  await enter(page, navGateway)

  const card = section(page).locator(".session-card").first()
  const start = await card.boundingBox()
  const windowTop = await page.locator(".session-window").boundingBox()

  expect(start).not.toBeNull()
  expect(windowTop).not.toBeNull()
  await page.mouse.move(start!.x + start!.width / 2, start!.y + start!.height / 2)
  await page.mouse.down()
  await page.mouse.move(start!.x + start!.width / 2, windowTop!.y + 20, { steps: 12 })
  await expect(page.locator(".session-section.pinned-drop")).toBeVisible()
  await page.mouse.up()

  const pinned = page.locator('.session-section[data-key="pinned"]')
  await expect(pinned.locator(".session-card")).toHaveCount(1)
})
