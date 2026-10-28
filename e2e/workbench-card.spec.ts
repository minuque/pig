import type { Locator, Page } from "@playwright/test"

import { expect, seedWorkspace, test } from "./fixtures.js"

function rgb(value: string): [number, number, number] {
  const match = value.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/)

  if (!match) throw new Error(`无法解析颜色：${value}`)
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

/** 相对亮度：比较卡片面与窗口底谁更亮，不绑定具体色值。 */
function luminance(color: string): number {
  const [r = 0, g = 0, b = 0] = rgb(color).map((channel) => {
    const value = channel / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

async function surfaces(page: Page): Promise<{ card: string; shell: string }> {
  return page.evaluate(() => {
    const read = (selector: string) =>
      getComputedStyle(document.querySelector(selector) as HTMLElement).backgroundColor
    return { card: read(".workbench-card"), shell: read(".shell") }
  })
}

async function box(locator: Locator) {
  const rect = await locator.boundingBox()

  if (!rect) throw new Error("取不到卡片位置")
  return rect
}

test("workbench 卡片浮在窗口底上，收起侧栏仍留边", async ({ page, navGateway }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await seedWorkspace(page, navGateway.workspaceId)
  await page.goto(navGateway.entryUrl)
  await expect(page.locator("h1.hero-title")).toBeVisible({ timeout: 30_000 })

  const card = page.locator(".workbench-card")

  await expect(card).toBeVisible()
  await expect(card.locator(".workbench-header")).toBeVisible()

  const expanded = await box(card)

  expect(Math.round(expanded.y)).toBe(8)
  expect(Math.round(1280 - expanded.x - expanded.width)).toBe(8)
  expect(Math.round(800 - expanded.y - expanded.height)).toBe(8)
  expect(
    parseFloat(await card.evaluate((element) => getComputedStyle(element).borderTopLeftRadius)),
  ).toBeGreaterThan(0)

  const light = await surfaces(page)

  expect(luminance(light.card)).toBeGreaterThan(luminance(light.shell))

  // 收起侧栏后左缝保留，卡片不回到满窗
  await page.locator(".nav-collapse").click()

  await expect.poll(async () => Math.round((await box(card)).x)).toBe(8)

  const collapsed = await box(card)

  expect(Math.round(collapsed.y)).toBe(8)
  expect(Math.round(1280 - collapsed.x - collapsed.width)).toBe(8)
  expect(Math.round(800 - collapsed.y - collapsed.height)).toBe(8)
})

test("深色下卡片同样比窗口底亮一档", async ({ page, navGateway }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.addInitScript(
    ({ id }) => {
      localStorage.setItem("pig.localWorkspaces", JSON.stringify([id]))
      localStorage.setItem("pig.lastCwd", id)
      localStorage.setItem("npg-theme", "dark")
    },
    { id: navGateway.workspaceId },
  )
  await page.goto(navGateway.entryUrl)
  await expect(page.locator(".workbench-card")).toBeVisible({ timeout: 30_000 })

  const dark = await surfaces(page)

  expect(luminance(dark.shell)).toBeLessThan(0.02)
  expect(luminance(dark.card)).toBeGreaterThan(luminance(dark.shell))
})

test("窄屏抽屉模式卡片满宽满高", async ({ page, navGateway }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await seedWorkspace(page, navGateway.workspaceId)
  await page.setViewportSize({ width: 800, height: 760 })
  await page.goto(navGateway.entryUrl)
  await expect(page.locator("h1.hero-title")).toBeVisible({ timeout: 30_000 })

  const card = page.locator(".workbench-card")

  await expect(card).toBeVisible()

  const rect = await box(card)

  expect(Math.round(rect.x)).toBe(0)
  expect(Math.round(rect.y)).toBe(0)
  expect(Math.round(rect.width)).toBe(800)
  expect(Math.round(rect.height)).toBe(760)

  const style = await card.evaluate((element) => {
    const computed = getComputedStyle(element)
    return { radius: computed.borderTopLeftRadius, border: computed.borderTopWidth }
  })

  expect(parseFloat(style.radius)).toBe(0)
  expect(parseFloat(style.border)).toBe(0)
})
