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

type DialogCloseTrace = {
  backdrop: number[]
  content: number[]
}

type TraceWindow = Window & {
  __dialogCloseTrace?: Promise<DialogCloseTrace>
}

test("深色模式下关闭设置弹窗时遮罩与内容单调淡出不回闪", async ({ page, gateway }) => {
  await seedWorkspace(page, gateway.workspaceId)
  await page.goto(gateway.entryUrl)
  await expect(page.locator("nav.session-list")).toBeVisible({ timeout: 30_000 })

  await page.locator(".nav-footer").getByRole("button", { name: "设置" }).click()
  await page.locator(".settings-nav").getByRole("button", { name: "外观" }).click()
  await page.getByRole("radio", { name: "深色" }).click()

  await expect(async () => {
    const settled = await page.evaluate(() => {
      const dark = document.documentElement.classList.contains("dark")
      const backdrop = document.querySelector('[data-slot="dialog-backdrop"]')
      const content = document.querySelector('[data-slot="dialog-content"]')

      if (!dark || !backdrop || !content) return false

      if (
        backdrop.hasAttribute("data-starting-style") ||
        content.hasAttribute("data-starting-style")
      )
        return false
      return getComputedStyle(backdrop).opacity === "1" && getComputedStyle(content).opacity === "1"
    })

    expect(settled).toBe(true)
  }).toPass()

  await page.evaluate(() => {
    const w = window as TraceWindow
    const backdrop = document.querySelector('[data-slot="dialog-backdrop"]')
    const content = document.querySelector('[data-slot="dialog-content"]')
    const visible = (el: Element | null) =>
      el !== null && el.isConnected && getComputedStyle(el).display !== "none"

    w.__dialogCloseTrace = new Promise<DialogCloseTrace>((resolve) => {
      const trace: DialogCloseTrace = { backdrop: [], content: [] }
      const deadline = performance.now() + 1500

      function sample() {
        const hasBackdrop = visible(backdrop)
        const hasContent = visible(content)

        if (hasBackdrop && backdrop) trace.backdrop.push(Number(getComputedStyle(backdrop).opacity))

        if (hasContent && content) trace.content.push(Number(getComputedStyle(content).opacity))

        if ((!hasBackdrop && !hasContent) || performance.now() >= deadline) {
          resolve(trace)
          return
        }

        requestAnimationFrame(sample)
      }

      requestAnimationFrame(sample)
    })
  })

  await page.keyboard.press("Escape")
  await expect(page.locator(".settings-dialog")).toBeHidden()

  const trace = await page.evaluate(() => (window as TraceWindow).__dialogCloseTrace!)
  expect(trace.backdrop.length).toBeGreaterThanOrEqual(2)
  expect(trace.content.length).toBeGreaterThanOrEqual(2)
  expect(trace.backdrop.at(-1)!).toBeLessThan(0.9)
  expect(trace.content.at(-1)!).toBeLessThan(0.9)

  for (const series of [trace.backdrop, trace.content]) {
    for (let i = 1; i < series.length; i += 1) {
      expect(series[i]!).toBeLessThanOrEqual(series[i - 1]! + 0.001)
    }
  }
})

test("字体选择器支持顶部搜索过滤、空态提示、回车选中并在重开时清空", async ({ page, gateway }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "queryLocalFonts", {
      configurable: true,
      value: async () => [
        { family: "Fira Code" },
        { family: "Inter" },
        { family: "JetBrains Mono" },
        { family: "Roboto" },
      ],
    })
  })

  await seedWorkspace(page, gateway.workspaceId)
  await page.goto(gateway.entryUrl)
  await expect(page.locator("nav.session-list")).toBeVisible({ timeout: 30_000 })

  await page.locator(".nav-footer").getByRole("button", { name: "设置" }).click()
  const dialog = page.locator(".settings-dialog")

  await dialog.locator(".settings-nav").getByRole("button", { name: "外观" }).click()

  const trigger = dialog.locator("#setting-ui-font").getByRole("combobox", { name: "界面字体" })

  await trigger.click()

  const search = page.locator('[data-slot="select-input"]')

  await expect(search).toBeVisible()
  await expect(search).toBeFocused()
  await expect(page.getByRole("option", { name: "JetBrains Mono" })).toBeVisible()

  await search.fill("zzzz")
  await expect(page.getByText("没有匹配的字体")).toBeVisible()

  await search.fill("jet")
  await expect(page.getByRole("option", { name: "JetBrains Mono" })).toBeVisible()
  await expect(page.getByRole("option", { name: "Roboto" })).toBeHidden()

  await search.press("Enter")
  await expect(trigger).toContainText("JetBrains Mono")
  await expect(search).toBeHidden()

  await trigger.click()
  await expect(search).toBeVisible()
  await expect(search).toHaveValue("")
  await expect(page.getByRole("option", { name: "Roboto" })).toBeVisible()

  await search.press("Escape")
  await expect(search).toBeHidden()
  await expect(dialog).toBeVisible()
})
