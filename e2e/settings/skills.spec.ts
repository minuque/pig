import { expect, seedWorkspace, test } from "../support/fixtures.js"

test("Skills：新建后编辑正文，预览看到改动，删除后从列表消失", async ({ page, gateway }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await seedWorkspace(page, gateway.workspaceId)
  await page.goto(gateway.entryUrl)
  await expect(page.locator("nav.session-list")).toBeVisible({ timeout: 30_000 })

  await page.locator(".nav-footer").getByRole("button", { name: "设置" }).click()
  await page.locator(".settings-nav").getByRole("button", { name: "Skills" }).click()
  const dialog = page.locator(".settings-dialog")

  await dialog.getByRole("button", { name: "新建" }).click()
  await dialog.getByLabel("名称").fill("release-notes")
  await dialog.getByLabel("什么时候用").fill("写发版说明时使用")
  await dialog.getByRole("button", { name: "创建并编辑" }).click()

  const editor = dialog.getByRole("textbox", { name: "SKILL.md" })

  await expect(editor).toHaveValue(/name: release-notes/)
  await editor.fill(`${await editor.inputValue()}\n## 检查清单\n`)
  await dialog.getByRole("button", { name: "保存" }).click()

  await expect(dialog.getByRole("heading", { name: "检查清单" })).toBeVisible()

  await dialog.locator(".settings-crumbs").getByRole("button", { name: "Skills" }).click()
  await expect(dialog.locator(".skill-row").filter({ hasText: "release-notes" })).toBeVisible()

  await dialog
    .locator(".skill-row")
    .filter({ hasText: "release-notes" })
    .getByRole("button")
    .first()
    .click()
  await dialog.getByRole("button", { name: "删除" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "删除" }).click()

  await expect(dialog.locator(".skill-row").filter({ hasText: "release-notes" })).toHaveCount(0)
})
