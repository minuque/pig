import type { Page } from "@playwright/test"
import { expect, seedWorkspace, test, type E2eGateway } from "./fixtures.js"
import { FILLER_PREFIX } from "./prebuild-session.js"

async function enter(page: Page, gateway: E2eGateway) {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await seedWorkspace(page, gateway.workspaceId)
  await page.goto(gateway.entryUrl)
  await expect(page.locator("nav.session-list")).toBeVisible({ timeout: 30_000 })
  await page.locator(".session-section").first().locator(".section-toggle").click()
  await expect(page.locator(".session-card").first()).toBeVisible()
}

test("点另一张卡换掉 URL 与正文", async ({ page, navGateway }) => {
  await enter(page, navGateway)

  const cards = page.locator(".session-card")

  await cards.nth(0).click()
  await expect(page).toHaveURL(/\/sessions\/e2e-filler-5$/, { timeout: 30_000 })
  await expect(page.getByText(`${FILLER_PREFIX} 6 的内容`, { exact: true })).toBeVisible()

  await cards.nth(2).click()
  await expect(page).toHaveURL(/\/sessions\/e2e-filler-3$/, { timeout: 30_000 })
  await expect(page.getByText(`${FILLER_PREFIX} 4 的内容`, { exact: true })).toBeVisible()
  await expect(page.getByText(`${FILLER_PREFIX} 6 的内容`, { exact: true })).toHaveCount(0)
})

test("连点只落到最后一个会话", async ({ page, navGateway }) => {
  await enter(page, navGateway)

  const cards = page.locator(".session-card")

  await cards.nth(0).click()
  await cards.nth(1).click()
  await cards.nth(3).click()

  await expect(page).toHaveURL(/\/sessions\/e2e-filler-2$/, { timeout: 30_000 })
  await expect(page.getByText(`${FILLER_PREFIX} 3 的内容`, { exact: true })).toBeVisible()
})
