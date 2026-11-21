import { test, type Page } from "@playwright/test"

export async function checkpoint(page: Page, name: string) {
  const body = await page.screenshot({ animations: "disabled" })
  await test.info().attach(name, { body, contentType: "image/png" })
}
