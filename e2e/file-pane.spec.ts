import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { checkpoint } from "./checkpoint.js"
import { expect, seedWorkspace, test } from "./fixtures.js"
import { COMPLEX_MARKER, COMPLEX_SESSION_ID, COMPLEX_SESSION_NAME } from "./prebuild-session.js"

const SOURCE = "export const fromWorkspace = 42\n"

test("点工具行里的文件名，Files 面板打开这个文件并标出读过的行", async ({
  page,
  complexGateway,
}) => {
  test.setTimeout(90_000)
  await mkdir(join(complexGateway.workspaceDir, "src"), { recursive: true })
  await writeFile(join(complexGateway.workspaceDir, "src", "example.ts"), SOURCE)
  await seedWorkspace(page, complexGateway.workspaceId)
  await page.goto(complexGateway.entryUrl)

  await page
    .locator(".session-card", { has: page.getByText(COMPLEX_SESSION_NAME, { exact: true }) })
    .click()
  await expect(page).toHaveURL(new RegExp(`/sessions/${COMPLEX_SESSION_ID}$`))
  await expect(page.getByText(COMPLEX_MARKER, { exact: true })).toBeVisible({ timeout: 30_000 })

  const tools = page.locator(".row-tools").last()
  const target = tools.locator(".tool-row-target.is-openable", { hasText: "example.ts" })

  if (!(await target.isVisible())) await tools.locator("button").first().click()
  await target.click()

  const pane = page.getByRole("region", { name: "文件" })

  await expect(pane).toBeVisible()
  await expect(pane.getByRole("tab", { name: "example.ts" })).toHaveAttribute(
    "aria-selected",
    "true",
  )
  await expect(pane.locator(".file-code-line[data-hl]").first()).toContainText(
    "export const fromWorkspace = 42",
  )
  // 树里展开到这个文件并标为当前
  await expect(
    pane.locator('.file-tree-row[data-active][data-path="src/example.ts"]'),
  ).toBeVisible()
  await checkpoint(page, "file-pane-open")

  // 头部按钮收起面板，再打开时标签还在
  const toggle = page.getByRole("button", { name: "开关文件面板" })

  await toggle.click()
  await expect(pane).toHaveCount(0)
  await toggle.click()
  await expect(
    page.getByRole("region", { name: "文件" }).getByRole("tab", { name: "example.ts" }),
  ).toBeVisible()
})
