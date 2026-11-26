import { expect, seedWorkspace, test } from "../support/fixtures.js"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { FILLER_PREFIX } from "../support/prebuild-session.js"

async function openArchiveSettings(page: import("@playwright/test").Page) {
  await page.locator(".nav-footer").getByRole("button", { name: "设置" }).click()
  const dialog = page.getByRole("dialog", { name: "设置" })

  await expect(dialog).toBeVisible()
  await dialog.locator(".settings-nav").getByRole("button", { name: /归档/ }).click()
  return dialog
}

async function readArchivesFile(pigHome: string): Promise<Record<string, number>> {
  const text = await readFile(join(pigHome, "session-archives.json"), "utf8")
  const parsed = JSON.parse(text) as { version: number; archives: Record<string, number> }
  return parsed.archives
}

test("侧栏右键归档写入持久化文件，点撤销恢复回侧栏", async ({ page, navGateway }) => {
  await seedWorkspace(page, navGateway.workspaceId)
  await page.goto(navGateway.entryUrl)

  const cards = page.locator('.session-section[data-key="active"] .session-card')

  await expect(cards).toHaveCount(6)
  const target = cards.first()

  await expect(target).toContainText(`${FILLER_PREFIX} 6`)
  await target.click({ button: "right" })
  await page.getByRole("menuitem", { name: "归档" }).click()

  await expect(cards).toHaveCount(5)
  await expect(page.locator('.session-section[data-key="settled"] .section-count')).toHaveText("0")

  await expect
    .poll(async () => Object.keys(await readArchivesFile(navGateway.pigHome)).length)
    .toBe(1)

  const undo = page.getByRole("button", { name: "撤销" })

  await expect(undo).toBeVisible()
  await undo.click()

  await expect(cards).toHaveCount(6)
  await expect(cards.first()).toContainText(`${FILLER_PREFIX} 6`)
  await expect
    .poll(async () => Object.keys(await readArchivesFile(navGateway.pigHome)).length)
    .toBe(0)
})

test("设置归档页支持单条与批量归档、刷新持久化、恢复及删除确认", async ({ page, navGateway }) => {
  await seedWorkspace(page, navGateway.workspaceId)
  await page.goto(navGateway.entryUrl)

  const sidebarCards = page.locator('.session-section[data-key="active"] .session-card')

  await expect(sidebarCards).toHaveCount(6)

  let dialog = await openArchiveSettings(page)
  const rows = dialog.locator(".archive-row")

  await expect(rows).toHaveCount(6)

  const projectTrigger = dialog.locator(".project-select")

  await projectTrigger.click()
  const projectSearch = page.locator('[data-slot="select-input"]')

  await expect(projectSearch).toBeFocused()
  await projectSearch.fill("__no_match__")
  await expect(page.getByText("没有匹配的项目")).toBeVisible()

  await projectSearch.fill("pig-e2e-")
  await expect(page.getByRole("option", { name: "workspace" })).toBeVisible()
  await expect(page.getByRole("option", { name: "全部项目" })).toBeHidden()

  await projectSearch.press("Enter")
  await expect(projectTrigger).toContainText("workspace")
  await expect(rows).toHaveCount(6)

  await projectTrigger.click()
  await expect(projectSearch).toHaveValue("")
  await page.getByRole("option", { name: "全部项目" }).click()
  await expect(projectTrigger).toContainText("全部项目")

  const row6 = rows.filter({ hasText: `${FILLER_PREFIX} 6` })

  await row6.getByRole("button", { name: "归档" }).click()
  await expect(rows).toHaveCount(5)

  await dialog.getByRole("tab", { name: /已归档/ }).click()
  await expect(rows).toHaveCount(1)
  await expect(rows.first()).toContainText(`${FILLER_PREFIX} 6`)

  await page.reload()
  await expect(sidebarCards).toHaveCount(5)

  dialog = await openArchiveSettings(page)
  await dialog.getByRole("tab", { name: /已归档/ }).click()
  await expect(rows).toHaveCount(1)

  await rows
    .filter({ hasText: `${FILLER_PREFIX} 6` })
    .getByRole("button", { name: "恢复" })
    .click()
  await expect(rows).toHaveCount(0)
  await expect(sidebarCards).toHaveCount(6)

  await dialog.getByRole("tab", { name: /可归档/ }).click()
  await expect(rows).toHaveCount(6)

  await rows.filter({ hasText: `${FILLER_PREFIX} 1` }).click()
  await rows.filter({ hasText: `${FILLER_PREFIX} 2` }).click()
  const bulkBar = dialog.locator(".bulk-bar")

  await expect(bulkBar).toContainText("已选 2 项")
  await bulkBar.getByRole("button", { name: "归档所选" }).click()

  await expect(rows).toHaveCount(4)
  await dialog.getByRole("tab", { name: /已归档/ }).click()
  await expect(rows).toHaveCount(2)

  await rows
    .filter({ hasText: `${FILLER_PREFIX} 1` })
    .getByRole("button", { name: "删除会话" })
    .click()
  const confirm = page.getByRole("alertdialog")

  await expect(confirm).toBeVisible()
  await confirm.getByRole("button", { name: "确认删除" }).click()

  await expect(rows).toHaveCount(1)
  await expect(rows.first()).toContainText(`${FILLER_PREFIX} 2`)
  await expect
    .poll(async () => Object.keys(await readArchivesFile(navGateway.pigHome)).length)
    .toBe(1)
  await expect(sidebarCards).toHaveCount(4)
})
