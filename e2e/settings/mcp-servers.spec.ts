import { writeFile } from "node:fs/promises"
import { join } from "node:path"
import { expect, seedWorkspace, test } from "../support/fixtures.js"

test("MCP：新增 stdio server，停用后仍在列表，删除后清空", async ({ page, gateway }) => {
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

test("MCP：测试连接列出工具，点击工具可在弹窗查看明细与 Schema", async ({ page, gateway }) => {
  const serverScript = join(gateway.workspaceDir, "mcp-echo.mjs")

  await writeFile(
    serverScript,
    [
      'let buf = ""',
      'process.stdin.setEncoding("utf8")',
      'process.stdin.on("data", (chunk) => {',
      "  buf += chunk",
      "  for (;;) {",
      '    const nl = buf.indexOf("\\n")',
      "    if (nl < 0) break",
      "    const line = buf.slice(0, nl).trim()",
      "    buf = buf.slice(nl + 1)",
      "    if (!line) continue",
      "    const msg = JSON.parse(line)",
      '    if (msg.method === "initialize") {',
      '      process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: { protocolVersion: msg.params?.protocolVersion ?? "2025-11-25", capabilities: { tools: {} }, serverInfo: { name: "echo", version: "1.0.0" } } }) + "\\n")',
      '    } else if (msg.method === "tools/list") {',
      '      process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: { tools: [{ name: "inspect_item", title: "Inspect Item", description: "Inspect item metadata", inputSchema: { type: "object", required: ["itemId"], properties: { itemId: { type: "string", description: "Unique item identifier" } } }, annotations: { readOnlyHint: true } }] } }) + "\\n")',
      "    }",
      "  }",
      "})",
    ].join("\n"),
  )
  await seedWorkspace(page, gateway.workspaceId)
  await page.goto(gateway.entryUrl)
  await expect(page.locator("nav.session-list")).toBeVisible({ timeout: 30_000 })

  await page.locator(".nav-footer").getByRole("button", { name: "设置" }).click()
  await page.locator(".settings-nav").getByRole("button", { name: "MCP" }).click()
  const dialog = page.locator(".settings-dialog")

  await dialog.getByRole("button", { name: "新增" }).click()
  await dialog.getByLabel("名称").fill("echo")
  await dialog.getByLabel("命令").fill(process.execPath.replaceAll("\\", "/"))
  await dialog.getByLabel("参数").fill(serverScript.replaceAll("\\", "/"))
  await dialog.getByRole("button", { name: "保存" }).click()

  await dialog.getByRole("button", { name: "测试连接" }).click()
  const toolButton = dialog.getByRole("button", { name: /inspect_item/ })

  await expect(toolButton).toBeVisible({ timeout: 15_000 })
  await toolButton.click()

  const toolDialog = page.locator(".tool-dialog")

  await expect(toolDialog).toBeVisible()
  await expect(toolDialog.getByText("Inspect Item", { exact: true })).toBeVisible()
  await expect(toolDialog.getByText("Inspect item metadata", { exact: true })).toBeVisible()
  await expect(toolDialog.getByText("只读", { exact: true })).toBeVisible()
  await expect(toolDialog.getByText("itemId", { exact: true })).toBeVisible()
  await expect(toolDialog.getByText("Unique item identifier", { exact: true })).toBeVisible()

  await toolDialog.getByRole("button", { name: "完整 JSON Schema" }).click()
  await expect(toolDialog.locator(".schema-json")).toContainText('"itemId"')

  await page.keyboard.press("Escape")
  await expect(toolDialog).toHaveCount(0)
  await expect(dialog).toBeVisible()
})
