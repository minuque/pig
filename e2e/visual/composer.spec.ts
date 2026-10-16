import { expect, seedWorkspace, test } from "../fixtures.js"
import { stabilize } from "./lib/stabilize.js"

// 两层：toHaveCSS 断言精确值（圆角/间距/透明度），toHaveScreenshot 管布局/颜色块/元素增删。
test.describe("composer 视觉", () => {
  test.use({ deviceScaleFactor: 1 })

  test("composer 卡片布局", async ({ page, gateway }) => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    await seedWorkspace(page, gateway.workspaceId)
    await page.goto(gateway.entryUrl)
    await expect(page.locator("nav.session-list")).toBeVisible({ timeout: 30_000 })

    const mask = await stabilize(page, [])
    const card = page.locator(".composer-card")

    await expect(card).toHaveCSS("border-radius", "32px")
    await expect(card).toHaveScreenshot("composer-card.png", { mask, maxDiffPixelRatio: 0 })
  })
})
