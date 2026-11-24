import { readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import type { Page } from "@playwright/test"
import { expect, seedWorkspace, test } from "../support/fixtures.js"

const preferencesPath = (pigHome: string) => join(pigHome, "preferences.json")

async function readPreferences(pigHome: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(preferencesPath(pigHome), "utf8")) as Record<string, unknown>
}

function readShellState(page: Page) {
  return page.evaluate(() => ({
    dark: document.documentElement.classList.contains("dark"),
    lang: document.documentElement.lang,
    storedLocale: localStorage.getItem("pig.locale"),
    storedTheme: localStorage.getItem("npg-theme"),
  }))
}

test("偏好落盘、新客户端自动恢复、外部改写实时热更新", async ({ page, browser, gateway }) => {
  await seedWorkspace(page, gateway.workspaceId)
  await page.goto(gateway.entryUrl)
  await expect(page.locator("nav.session-list")).toBeVisible({ timeout: 30_000 })

  await page.locator(".nav-footer").getByRole("button", { name: "设置" }).click()
  await page.locator(".settings-nav").getByRole("button", { name: "外观" }).click()
  await page.getByRole("radio", { name: "深色" }).click()

  await page.locator(".settings-nav").getByRole("button", { name: "通用" }).click()
  await page.locator("#setting-language").getByRole("combobox").click()
  await page.getByRole("option", { name: "English" }).click()

  await expect(async () => {
    const saved = await readPreferences(gateway.pigHome)

    expect(saved).toMatchObject({ theme: "dark", locale: "en" })
  }).toPass({ timeout: 20_000 })

  const fresh = await browser.newContext()
  const restored = await fresh.newPage()

  await restored.goto(gateway.entryUrl)
  await expect(restored.locator("nav.session-list")).toBeVisible({ timeout: 30_000 })

  await expect(async () => {
    const state = await readShellState(restored)

    expect(state.dark).toBe(true)
    expect(state.lang).toBe("en")
    expect(state.storedLocale).toBe("en")
    expect(state.storedTheme).toBe("dark")
  }).toPass({ timeout: 20_000 })

  const saved = await readPreferences(gateway.pigHome)

  await writeFile(
    preferencesPath(gateway.pigHome),
    `${JSON.stringify({ ...saved, theme: "light", locale: "zh-CN" }, null, 2)}\n`,
  )

  await expect(async () => {
    const state = await readShellState(restored)

    expect(state.dark).toBe(false)
    expect(state.lang).toBe("zh-CN")
    expect(state.storedLocale).toBe("zh-CN")
  }).toPass({ timeout: 20_000 })

  await fresh.close()
})
