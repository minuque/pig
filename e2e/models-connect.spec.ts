import { expect, seedWorkspace, test } from "./fixtures.js"

test("填 Key 保存并连接，登出后回到未连接", async ({ page, modelsGateway }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await seedWorkspace(page, modelsGateway.workspaceId)
  await page.goto(modelsGateway.entryUrl)
  await expect(page.locator("nav.session-list")).toBeVisible({ timeout: 30_000 })

  await page.locator(".nav-footer").getByRole("button", { name: "设置" }).click()
  await page.locator(".settings-nav").getByRole("button", { name: "模型" }).click()

  await page.locator(".provider-row").filter({ hasText: "OpenAI" }).click()
  await expect(page.locator(".provider-detail-title")).toHaveText("OpenAI")
  await expect(page.locator(".provider-badge")).toHaveText("未连接")

  await page.locator(".kvinput").fill("sk-openai-test")
  await page.getByRole("button", { name: "保存并连接" }).click()

  await expect(page.locator(".provider-badge")).toHaveText("已连接")
  await expect(page.locator(".model-card")).toHaveCount(1)

  await page.locator(".btnrow").getByRole("button", { name: "登出" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "登出" }).click()

  await expect(page.locator(".provider-badge")).toHaveText("未连接")
  await expect(page.locator(".model-card")).toHaveCount(0)
})

test("测试连接成功显示耗时，失败显示上游原文", async ({ page, modelsGateway }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await seedWorkspace(page, modelsGateway.workspaceId)
  await page.goto(modelsGateway.entryUrl)
  await expect(page.locator("nav.session-list")).toBeVisible({ timeout: 30_000 })

  await page.locator(".nav-footer").getByRole("button", { name: "设置" }).click()
  await page.locator(".settings-nav").getByRole("button", { name: "模型" }).click()

  await page.locator(".provider-row").filter({ hasText: "Anthropic" }).click()
  await page.getByRole("button", { name: "测试连接" }).click()
  await expect(page.locator(".test-result")).toContainText("连接正常")
  await expect(page.locator(".test-result")).toContainText("ms")

  await page.locator(".provider-back").click()
  await page.locator(".provider-row").filter({ hasText: "DeepSeek" }).click()
  await page.getByRole("button", { name: "测试连接" }).click()
  await expect(page.locator(".test-result")).toContainText("upstream rejected the key")
  await expect(page.getByRole("button", { name: "测试连接" })).toBeEnabled()
})
