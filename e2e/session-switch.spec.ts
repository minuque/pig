import type { Page } from "@playwright/test"
import { expect, seedWorkspace, test, type E2eGateway } from "./fixtures.js"
import { FILLER_PREFIX } from "./prebuild-session.js"

async function enter(page: Page, gateway: E2eGateway) {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await seedWorkspace(page, gateway.workspaceId)
  await page.goto(gateway.entryUrl)
  await expect(page.locator("nav.session-list")).toBeVisible({ timeout: 30_000 })
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

/** 30 轮的长历史，够滚出好几屏。 */
function longHistory() {
  return Array.from({ length: 30 }, (_, index) => [
    {
      id: `lu${index}`,
      role: "user",
      content: [{ type: "text", text: `长会话问题 ${index}` }],
      timestamp: index * 10,
    },
    {
      id: `la${index}`,
      role: "assistant",
      content: [{ type: "text", text: `长会话回答 ${index}\n\n${"一段较长的正文。".repeat(40)}` }],
      model: { provider: "test", id: "model" },
      timestamp: index * 10 + 1,
      status: "complete",
      stopReason: "stop",
    },
  ]).flat()
}

test("切走再切回：停在离开时的位置，不跳到底部", async ({ page, navGateway }) => {
  await page.route("**/api/v1/platform/transcript?**", (route) => {
    const id = new URL(route.request().url()).searchParams.get("sessionId")

    if (id !== "e2e-filler-5") return route.fallback()
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ items: longHistory(), timings: [], hasMore: false }),
    })
  })
  await enter(page, navGateway)
  const cards = page.locator(".session-card")
  const panel = page.locator("#transcript-panel")

  await cards.nth(0).click()
  await expect(page.getByText("长会话回答 29")).toBeVisible({ timeout: 30_000 })
  await panel.evaluate((el) => {
    el.scrollTop = 600
    el.dispatchEvent(new WheelEvent("wheel", { deltaY: -120, bubbles: true }))
    el.dispatchEvent(new Event("scroll"))
  })
  await expect.poll(() => panel.evaluate((el) => Math.round(el.scrollTop))).toBe(600)

  await cards.nth(2).click()
  await expect(page).toHaveURL(/\/sessions\/e2e-filler-3$/, { timeout: 30_000 })
  await cards.nth(0).click()
  await expect(page).toHaveURL(/\/sessions\/e2e-filler-5$/, { timeout: 30_000 })
  await expect(page.getByText("长会话回答 29")).toBeAttached()
  await expect.poll(() => panel.evaluate((el) => Math.round(el.scrollTop))).toBe(600)
})
