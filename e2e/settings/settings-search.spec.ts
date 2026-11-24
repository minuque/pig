import { expect, seedWorkspace, test } from "../support/fixtures.js"

test("设置搜索：方向键选结果、Enter 跳到对应设置，Esc 只清空搜索", async ({ page, gateway }) => {
  await seedWorkspace(page, gateway.workspaceId)
  await page.goto(gateway.entryUrl)
  await expect(page.locator("nav.session-list")).toBeVisible({ timeout: 30_000 })

  await page.locator(".nav-footer").getByRole("button", { name: "设置" }).click()
  const dialog = page.getByRole("dialog")
  const search = dialog.getByRole("combobox", { name: "搜索设置" })

  await search.fill("提示音")
  await expect(dialog.getByRole("option", { name: /完成提示音/ })).toBeVisible()

  await search.press("Escape")
  await expect(search).toHaveValue("")
  await expect(dialog).toBeVisible()

  await search.fill("提示音")
  await search.press("ArrowDown")
  await search.press("Enter")
  await expect(search).toHaveValue("")
  await expect(dialog.locator("#setting-notify-sound")).toBeInViewport()
})
