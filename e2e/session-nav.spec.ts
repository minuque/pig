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
