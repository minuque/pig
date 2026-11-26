import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
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

test("Skills：附属文件排在路径下方，点击可在弹窗预览", async ({ page, gateway }) => {
  const skillDir = join(gateway.workspaceDir, ".pi", "skills", "with-assets")

  await mkdir(join(skillDir, "scripts"), { recursive: true })
  await mkdir(join(skillDir, "references"), { recursive: true })
  await writeFile(
    join(skillDir, "SKILL.md"),
    "---\nname: with-assets\ndescription: skill with supporting files\n---\n\n# Asset Demo\n",
  )
  await writeFile(join(skillDir, "scripts", "check.sh"), "#!/bin/sh\necho asset-ok\n")
  await writeFile(join(skillDir, "references", "guide.md"), "# Guide Title\n\nAsset body\n")

  await page.emulateMedia({ reducedMotion: "reduce" })
  await seedWorkspace(page, gateway.workspaceId)
  await page.goto(gateway.entryUrl)
  await expect(page.locator("nav.session-list")).toBeVisible({ timeout: 30_000 })

  await Promise.all([
    page.waitForResponse(
      (res) => res.url().includes("/api/v1/platform/select-directory") && res.ok(),
    ),
    page.getByRole("button", { name: "添加目录" }).click(),
  ])

  await page.locator(".nav-footer").getByRole("button", { name: "设置" }).click()
  await page.locator(".settings-nav").getByRole("button", { name: "Skills" }).click()
  const dialog = page.locator(".settings-dialog")

  await dialog.getByRole("button", { name: "作用域" }).click()
  await page.getByRole("menuitemradio", { name: "workspace" }).click()
  await dialog
    .locator(".skill-row")
    .filter({ hasText: "with-assets" })
    .getByRole("button")
    .first()
    .click()

  const meta = dialog.locator(".detail-meta")
  const preview = dialog.locator(".skill-preview")
  const chip = meta.getByRole("button", { name: "scripts/check.sh" })

  await expect(chip).toBeVisible()
  const chipBox = await chip.boundingBox()
  const previewBox = await preview.boundingBox()

  expect(chipBox!.y).toBeLessThan(previewBox!.y)

  await chip.click()
  const assetDialog = page.locator(".asset-dialog")

  await expect(assetDialog).toBeVisible()
  await expect(assetDialog.getByText("echo asset-ok")).toBeVisible()

  await page.keyboard.press("Escape")
  await expect(assetDialog).toHaveCount(0)
  await expect(dialog).toBeVisible()

  await meta.getByRole("button", { name: "references/guide.md" }).click()
  await expect(assetDialog.getByRole("heading", { name: "Guide Title" })).toBeVisible()
})
