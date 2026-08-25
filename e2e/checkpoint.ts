import { test, type Page } from "@playwright/test";

/** 把当前页作为命名截图挂到本次测试，供 playwright-report 使用。 */
export async function checkpoint(page: Page, name: string) {
  const body = await page.screenshot({ animations: "disabled" });
  await test.info().attach(name, { body, contentType: "image/png" });
}
