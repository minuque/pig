import { EXTENSION_TITLE, EXTENSION_YES, expect, seedWorkspace, test } from "./fixtures.js"

test("扩展弹出确认框：在界面上点确定，扩展拿到结果并提示", async ({ page, extensionGateway }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await seedWorkspace(page, extensionGateway.workspaceId)
  await page.goto(extensionGateway.entryUrl)

  const field = page.locator(".composer .field, .field").first()
  await expect(field).toBeVisible({ timeout: 30_000 })
  await field.click()
  await page.keyboard.type("/ask")
  await page.keyboard.press("Escape")
  await page.locator("button.send").click()

  const dialog = page.getByRole("alertdialog")
  await expect(dialog.getByText(EXTENSION_TITLE)).toBeVisible({ timeout: 30_000 })
  await dialog.getByRole("button", { name: "确定" }).click()

  await expect(dialog).toHaveCount(0)
  await expect(page.getByText(EXTENSION_YES)).toBeVisible()
})
