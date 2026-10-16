import type { Locator, Page } from "@playwright/test"

/** 截图前稳定化：等字体、原样返回传入的动态区 mask（仅为让调用方一行拿到）。reducedMotion 由调用方在 goto 前 emulate。 */
export async function stabilize(page: Page, mask: Locator[] = []) {
  await page.evaluate(() => document.fonts.ready)
  return mask
}
