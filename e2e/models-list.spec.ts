import { expect, seedWorkspace, test } from "./fixtures.js"

test("模型 tab 按连接状态分组，右侧只给已连接模型数", async ({ page, modelsGateway }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await seedWorkspace(page, modelsGateway.workspaceId)
  await page.goto(modelsGateway.entryUrl)
  await expect(page.locator("nav.session-list")).toBeVisible({ timeout: 30_000 })

  await page.locator(".nav-footer").getByRole("button", { name: "设置" }).click()
  await page.locator(".settings-nav").getByRole("button", { name: "模型" }).click()

  const groups = page.locator(".provider-group-title")
  await expect(groups).toHaveText(["已连接", "内置", "自定义"])

  const connected = page.locator(".provider-row").filter({ hasText: "Anthropic" })
  await expect(connected.locator(".provider-count")).toHaveText("3 个")

  const openai = page.locator(".provider-row").filter({ hasText: "OpenAI" })
  await expect(openai.locator(".provider-count")).toHaveCount(0)

  const custom = page.locator(".provider-row").filter({ hasText: "本地 Ollama" })
  await expect(custom).toBeVisible()

  await page.locator(".provider-search input").fill("deep")
  await expect(page.locator(".provider-row")).toHaveCount(1)
  await expect(page.locator(".provider-row")).toContainText("DeepSeek")
  await page.locator(".provider-search input").fill("")

  await connected.click()
  await expect(page.locator(".provider-detail-title")).toHaveText("Anthropic")
  await expect(page.locator(".provider-badge")).toHaveText("已连接")
  await expect(page.locator(".model-card")).toHaveCount(3)

  await page.locator(".provider-back").click()
  await expect(groups).toHaveText(["已连接", "内置", "自定义"])
})
