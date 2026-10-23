import { expect, seedWorkspace, test } from "./fixtures.js"

test("网关连不上时进错误页，重试按钮在", async ({ page, gateway }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await seedWorkspace(page, gateway.workspaceId)
  // 握手后立刻断开，connect() 会以失败收场
  await page.routeWebSocket("**/api/v1/pi", (socket) => socket.close())

  await page.goto(gateway.entryUrl)

  await expect(page).toHaveURL(/\/error$/, { timeout: 30_000 })
  await expect(page.locator(".error-title")).toHaveText("无法启动工作台")
  await expect(page.locator(".error-detail")).not.toBeEmpty()
  await expect(page.getByRole("button", { name: "重试连接" })).toBeVisible()
})

test("错误页恢复后回到工作台", async ({ page, gateway }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await seedWorkspace(page, gateway.workspaceId)

  let block = true

  await page.routeWebSocket("**/api/v1/pi", (socket) => {
    if (block) socket.close()
    else socket.connectToServer()
  })

  await page.goto(gateway.entryUrl)
  await expect(page).toHaveURL(/\/error$/, { timeout: 30_000 })

  block = false
  await page.getByRole("button", { name: "重试连接" }).click()

  await expect(page.locator("nav.session-list")).toBeVisible({ timeout: 30_000 })
  await expect(page).toHaveURL(/\/$/)
})
