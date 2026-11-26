import { expect, seedWorkspace, test } from "../support/fixtures.js"

test("错误页恢复后回到工作台", async ({ page, gateway }) => {
  await seedWorkspace(page, gateway.workspaceId)

  let block = true

  await page.routeWebSocket("**/api/v1/pi", (socket) => {
    if (block) socket.close()
    else socket.connectToServer()
  })

  await page.goto(gateway.entryUrl)
  await expect(page).toHaveURL(/\/error$/, { timeout: 30_000 })
  await expect(page.locator(".error-title")).toHaveText("无法启动工作台")
  await expect(page.locator(".error-detail")).not.toBeEmpty()

  block = false
  await page.getByRole("button", { name: "重试连接" }).click()

  await expect(page.locator("nav.session-list")).toBeVisible({ timeout: 30_000 })
  await expect(page).toHaveURL(/\/$/)
})
