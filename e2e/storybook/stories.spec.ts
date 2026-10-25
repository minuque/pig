import type { Page } from "@playwright/test"
import { expect, test } from "@playwright/test"

/** 静态故事：渲染完就定住，适合做像素基线。弹层类故事需要交互才出现，不在此列。 */
const STORIES = [
  "ui-button--default",
  "ui-button--outline",
  "ui-button--destructive",
  "ui-button--disabled",
  "ui-button--icon",
  "ui-callout--surface",
  "ui-callout--soft",
  "ui-callout--outline",
  "ui-callout--large",
  "ui-callout--destructive",
  "ui-callout--dismissible",
  "ui-switch--on",
  "ui-switch--off",
  "ui-switch--disabled",
  "ui-slider--value",
  "ui-slider--disabled",
  "ui-spinner--default",
  "ui-spinner--large",
]

async function openStory(page: Page, id: string) {
  await page.goto(`/iframe.html?id=${id}&viewMode=story`)
  await page.locator("#storybook-root > *").first().waitFor({ state: "visible" })
  await page.evaluate(() => document.fonts.ready)
}

test.describe("基础组件视觉基线", () => {
  for (const id of STORIES) {
    test(id, async ({ page }) => {
      await openStory(page, id)
      await expect(page.locator("#storybook-root")).toHaveScreenshot(`${id}.png`, {
        animations: "disabled",
      })
    })
  }
})
