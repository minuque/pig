import { expect, test } from "./fixtures.js"
import { REMOTE_HOST, remotePathOf } from "./remote-fixture.js"

test("远程目录：选主机与目录，@ 搜到远端文件，会话按「主机 / 目录」显示", async ({
  page,
  remoteGateway,
}) => {
  const label = `${REMOTE_HOST} / workspace`
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto(remoteGateway.entryUrl)
  await expect(page.locator("h1.hero-title")).toBeVisible({ timeout: 30_000 })

  await page.locator(".hero-picker").click()
  await page.getByRole("menuitem", { name: "添加远程目录…" }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog.getByRole("combobox", { name: "主机" })).toContainText(REMOTE_HOST)

  // 不存在的目录：对话框留着并提示
  await dialog.getByPlaceholder("/home/me/project").fill("/no/such/dir")
  await dialog.getByRole("button", { name: "添加" }).click()
  await expect(dialog.getByRole("alert")).toBeVisible()

  await dialog.getByPlaceholder("/home/me/project").fill(remotePathOf(remoteGateway.workspaceDir))
  await dialog.getByRole("button", { name: "添加" }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.locator(".hero-picker .hero-name")).toHaveText(label)

  // @ 候选来自远端目录
  const field = page.locator(".composer .field, .field").first()
  await field.click()
  await page.keyboard.type("@remote-only")
  await expect(page.getByRole("option", { name: /remote-only\.ts/ })).toBeVisible()
  await page.keyboard.press("Escape")
  await page.keyboard.press("Control+A")
  await page.keyboard.type("你好")
  await page.locator("button.send").click()

  await page.waitForURL(/\/sessions\/[^/?#]+$/)
  await expect(page.locator(".project-name", { hasText: label }).first()).toBeVisible()
})
