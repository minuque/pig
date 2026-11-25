import { expect, seedWorkspace, test } from "../support/fixtures.js"

test("MCP：新增 stdio server，停用后仍在列表，删除后清空", async ({ page, gateway }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await seedWorkspace(page, gateway.workspaceId)
  await page.goto(gateway.entryUrl)
  await expect(page.locator("nav.session-list")).toBeVisible({ timeout: 30_000 })

  await page.locator(".nav-footer").getByRole("button", { name: "设置" }).click()
  await page.locator(".settings-nav").getByRole("button", { name: "MCP" }).click()
  const dialog = page.locator(".settings-dialog")

  await expect(dialog.getByText("还没有 MCP Server。")).toBeVisible()

  await dialog.getByRole("button", { name: "新增" }).click()
  await dialog.getByLabel("名称").fill("files")
  await dialog.getByLabel("命令").fill("npx")
  await dialog.getByLabel("参数").fill("-y server-files .")
  await dialog.getByRole("button", { name: "保存" }).click()

  await expect(dialog.getByRole("heading", { name: "files" })).toBeVisible()
  await expect(dialog.getByText("npx -y server-files .")).toBeVisible()

  await dialog.locator(".settings-crumbs").getByRole("button", { name: "MCP" }).click()
  const row = dialog.locator(".mcp-row").filter({ hasText: "files" })
  const toggle = row.getByRole("switch")

  await expect(toggle).toBeChecked()
  await toggle.click()
  await expect(toggle).not.toBeChecked()

  await page.locator(".settings-nav").getByRole("button", { name: "模型" }).click()
  await page.locator(".settings-nav").getByRole("button", { name: "MCP" }).click()
  await expect(
    dialog.locator(".mcp-row").filter({ hasText: "files" }).getByRole("switch"),
  ).not.toBeChecked()

  await dialog.locator(".mcp-row").filter({ hasText: "files" }).click()
  await dialog.getByRole("button", { name: "删除" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "删除" }).click()

  await expect(dialog.getByText("还没有 MCP Server。")).toBeVisible()
})
