import type { Page } from "@playwright/test"
import { expect, seedWorkspace, test, type E2eGateway } from "../fixtures.js"
import { stabilize } from "./lib/stabilize.js"

test.describe("sidebar 视觉", () => {
  test.use({ deviceScaleFactor: 1 })

  async function enter(page: Page, gateway: E2eGateway) {
    await page.emulateMedia({ reducedMotion: "reduce" })
    await seedWorkspace(page, gateway.workspaceId)
    // 两个归档、一个延后、四个留在收件箱，四段同屏可比
    await page.addInitScript(() => {
      localStorage.setItem(
        "pig.sidebarSettledSessions",
        JSON.stringify(["e2e-filler-1", "e2e-filler-2"]),
      )
      localStorage.setItem(
        "pig.sidebarSnoozedSessions",
        JSON.stringify({ "e2e-filler-3": Date.now() + 24 * 60 * 60 * 1000 }),
      )
    })
    await page.goto(gateway.entryUrl)
    await expect(page.locator("nav.session-list")).toBeVisible({ timeout: 30_000 })
  }

  test("收件箱与架子", async ({ page, navGateway }) => {
    await enter(page, navGateway)

    const nav = page.locator(".session-nav")
    const mask = await stabilize(page, [])

    await expect(nav).toHaveScreenshot("sidebar-inbox.png", { mask })

    await page.locator('.session-section[data-key="snoozed"] .section-toggle').click()
    await page.locator('.session-section[data-key="settled"] .section-toggle').click()
    await expect(page.locator('.session-section[data-key="settled"] .session-card')).toHaveCount(2)

    await expect(nav).toHaveScreenshot("sidebar-shelves.png", { mask })
  })
})
