import type { Page } from "@playwright/test"
import { expect, seedWorkspace, test } from "../support/fixtures.js"

async function readThemeSnapshot(page: Page) {
  return page.evaluate(() => {
    const html = document.documentElement
    const rootStyle = getComputedStyle(html)
    return {
      htmlDark: html.classList.contains("dark"),
      htmlLight: html.classList.contains("light"),
      computedBg: rootStyle.getPropertyValue("--bg").trim().toLowerCase(),
      computedAccent: rootStyle.getPropertyValue("--accent-solid").trim().toLowerCase(),
    }
  })
}

test("深浅模式切换立即生效", async ({ page, gateway }) => {
  await seedWorkspace(page, gateway.workspaceId)
  await page.goto(gateway.entryUrl)
  await expect(page.locator("nav.session-list")).toBeVisible({ timeout: 30_000 })

  await page.locator(".nav-footer").getByRole("button", { name: "设置" }).click()
  await page.locator(".settings-nav").getByRole("button", { name: "外观" }).click()

  await page.getByRole("radio", { name: "深色" }).click()
  await expect(async () => {
    const snap = await readThemeSnapshot(page)
    expect(snap.htmlDark).toBe(true)
    expect(snap.computedBg).toBe("#101012")
    expect(snap.computedAccent).toBe("#5e6ad2")
  }).toPass()

  await page.getByRole("radio", { name: "浅色" }).click()
  await expect(async () => {
    const snap = await readThemeSnapshot(page)
    expect(snap.htmlDark).toBe(false)
    expect(snap.computedBg).toBe("#fff")
  }).toPass()

  await page.keyboard.press("Escape")
  await expect(page.locator(".settings-dialog")).toBeHidden()

  await page.locator(".nav-footer .footer-profile").click()
  await page.getByRole("menuitem", { name: /外观/ }).click()
  await expect(async () => {
    const snap = await readThemeSnapshot(page)
    expect(snap.htmlDark).toBe(true)
    expect(snap.htmlLight).toBe(false)
    expect(snap.computedBg).toBe("#101012")
  }).toPass()
})
