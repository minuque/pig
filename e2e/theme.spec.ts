import { expect, seedWorkspace, test } from "./fixtures.js"

function successVar(page: import("@playwright/test").Page) {
  return page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--success").trim(),
  )
}

test("切深色后 html 挂 dark，状态色跟着换一份", async ({ page, gateway }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await seedWorkspace(page, gateway.workspaceId)
  await page.goto(gateway.entryUrl)
  await expect(page.locator("nav.session-list")).toBeVisible({ timeout: 30_000 })

  const light = await successVar(page)

  expect(light).toBe("#15803d")

  await page.locator(".footer-settings").click()
  await page.locator(".scheme-cards").getByRole("radio", { name: "深色" }).click()

  await expect(page.locator("html")).toHaveClass(/dark/)
  expect(await successVar(page)).toBe("#34d399")
})

test("切主题注入主题变量并写入 data-theme-id", async ({ page, gateway }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await seedWorkspace(page, gateway.workspaceId)
  await page.goto(gateway.entryUrl)
  await expect(page.locator("nav.session-list")).toBeVisible({ timeout: 30_000 })

  await page.locator(".footer-settings").click()

  const pick = page
    .locator(".theme-grid .theme-card", { has: page.locator(".theme-name", { hasText: "GitHub" }) })
    .locator(".theme-pick")

  await pick.click()

  await expect(page.locator("html")).toHaveAttribute("data-theme-id", "github")
  // 装了主题后语义层读注入变量，解析出来是 GitHub 的绿
  expect(await successVar(page)).toBe("#1a7f37")

  const injected = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--app-theme-success").trim(),
  )

  expect(injected).toBe("#1a7f37")

  // 换回默认主题，撤掉注入
  await page.locator(".theme-grid .theme-card").first().locator(".theme-pick").click()
  await expect(page.locator("html")).not.toHaveAttribute("data-theme-id", "github")
})
