import { expect, seedWorkspace, test } from "./fixtures.js"

test("模型参数保存后重开仍在，恢复默认回到模型默认", async ({ page, modelsGateway }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await seedWorkspace(page, modelsGateway.workspaceId)
  await page.goto(modelsGateway.entryUrl)
  await expect(page.locator("nav.session-list")).toBeVisible({ timeout: 30_000 })

  await page.locator(".nav-footer").getByRole("button", { name: "设置" }).click()
  await page.locator(".settings-nav").getByRole("button", { name: "模型" }).click()
  await page.locator(".provider-row").filter({ hasText: "Anthropic" }).click()

  const row = page.locator(".model-row").filter({ hasText: "Claude Opus 4.7" })
  const maxTokens = page.locator(".field").filter({ hasText: "最大输出" }).locator("input")

  await row.click()
  await expect(maxTokens).toHaveValue("32000")

  const high = page.getByRole("button", { name: "high", exact: true })

  await maxTokens.fill("8192")
  await high.click()
  await page.getByRole("button", { name: "保存参数" }).click()

  await row.click()
  await row.click()
  await expect(maxTokens).toHaveValue("8192")
  await expect(high).toHaveAttribute("aria-pressed", "true")

  await page.getByRole("button", { name: "恢复默认" }).click()
  await expect(maxTokens).toHaveValue("32000")
})
