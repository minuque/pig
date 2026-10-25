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

test("选 accent 后写入 data-accent 并换 --accent-*", async ({ page, gateway }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await seedWorkspace(page, gateway.workspaceId)
  await page.goto(gateway.entryUrl)
  await expect(page.locator("nav.session-list")).toBeVisible({ timeout: 30_000 })

  await page.locator(".footer-settings").click()
  await page.locator(".accent-grid [data-accent='crimson']").click()

  await expect(page.locator("html")).toHaveAttribute("data-accent", "crimson")
  expect(
    await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--accent-9").trim(),
    ),
  ).toBe("#e93d82")

  // 换回默认 indigo，撤掉注入
  await page.locator(".accent-grid [data-accent='indigo']").click()
  await expect(page.locator("html")).not.toHaveAttribute("data-accent", /.+/u)
  expect(
    await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--accent-9").trim(),
    ),
  ).toBe("#3e63dd")
})
