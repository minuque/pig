import { dragOntoPanel as drag, expect, seedWorkspace, test } from "../fixtures.js"
import { stabilize } from "./lib/stabilize.js"

// 两层：toHaveCSS 断言精确值（圆角/间距/透明度），toHaveScreenshot 管布局/颜色块/元素增删。
test.describe("composer 视觉", () => {
  test.use({ deviceScaleFactor: 1 })

  async function enter(page, gateway) {
    await page.emulateMedia({ reducedMotion: "reduce" })
    await seedWorkspace(page, gateway.workspaceId)
    await page.goto(gateway.entryUrl)
    await expect(page.locator("nav.session-list")).toBeVisible({ timeout: 30_000 })
  }

  test("composer 卡片布局", async ({ page, gateway }) => {
    await enter(page, gateway)
    const mask = await stabilize(page, [])
    const card = page.locator(".composer-card")

    await expect(card).toHaveCSS("border-radius", "32px")
    await expect(card).toHaveScreenshot("composer-card.png", { mask, maxDiffPixelRatio: 0 })
  })

  test("附件 chips：圆角与拖放遮罩", async ({ page, gateway }) => {
    await enter(page, gateway)
    const panel = page.locator(".session-panel")
    const card = page.locator(".composer-card")

    await drag(page, "drop")
    const chips = page.locator(".attach-tray .chip")
    await expect(chips).toHaveCount(2)
    const mask = await stabilize(page, [])

    // chips 用 --radius-md（--radius = 8px），遮罩染色走 --drop-* token
    await expect(chips.first()).toHaveCSS("border-radius", "8px")
    await expect(card).toHaveScreenshot("composer-with-chips.png", {
      mask,
      maxDiffPixelRatio: 0,
    })
  })

  test("拖入高亮态", async ({ page, gateway }) => {
    await enter(page, gateway)
    const panel = page.locator(".session-panel")

    await drag(page, "dragenter")
    await expect(panel).toHaveClass(/is-drop-active/)
    await expect(panel.locator(".drop-guide")).toHaveCSS("opacity", "1")
    const mask = await stabilize(page, [])

    await expect(panel).toHaveScreenshot("drop-active.png", { mask, maxDiffPixelRatio: 0 })
    await drag(page, "drop")
  })
})
