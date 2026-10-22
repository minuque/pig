import type { Page } from "@playwright/test"
import { expect, seedWorkspace, test, type E2eGateway } from "../fixtures.js"
import { stabilize } from "./lib/stabilize.js"

test.describe("sidebar 视觉", () => {
  test.use({ deviceScaleFactor: 1 })

  async function enter(page: Page, gateway: E2eGateway) {
    await page.emulateMedia({ reducedMotion: "reduce" })
    await seedWorkspace(page, gateway.workspaceId)
    await page.goto(gateway.entryUrl)
    await expect(page.locator("nav.session-list")).toBeVisible({ timeout: 30_000 })
  }

  test("分组收起与展开两态", async ({ page, navGateway }) => {
    await enter(page, navGateway)

    const nav = page.locator(".session-nav")
    const mask = await stabilize(page, [])

    await expect(nav).toHaveScreenshot("sidebar-collapsed.png", { mask })

    await page.locator(".session-section").first().locator(".section-toggle").click()
    await expect(page.locator(".session-card").first()).toBeVisible()

    await expect(nav).toHaveScreenshot("sidebar-expanded.png", { mask })
  })
})
