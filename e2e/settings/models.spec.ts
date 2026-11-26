import type { Page } from "@playwright/test"
import { expect, seedWorkspace, test, type E2eGateway } from "../support/fixtures.js"

async function openWorkspace(page: Page, gateway: E2eGateway) {
  await seedWorkspace(page, gateway.workspaceId)
  await page.goto(gateway.entryUrl)
  await expect(page.locator("nav.session-list")).toBeVisible({ timeout: 30_000 })
}

async function openModels(page: Page, gateway: E2eGateway) {
  await openWorkspace(page, gateway)
  await page.locator(".nav-footer").getByRole("button", { name: "设置" }).click()
  await page.locator(".settings-nav").getByRole("button", { name: "模型" }).click()
}

test("填 Key 保存并连接，登出后回到未连接", async ({ page, modelsGateway }) => {
  await openModels(page, modelsGateway)

  await page.locator('.provider-row[data-provider="openai"]').click()
  await expect(page.locator(".provider-detail-title")).toHaveText("OpenAI")
  await expect(page.locator(".provider-badge")).toHaveText("未连接")

  await page.locator(".kvinput input").fill("sk-openai-test")
  await page.getByRole("button", { name: "保存并连接" }).click()

  await expect(page.locator(".provider-badge")).toHaveText("已连接")
  await expect(page.locator(".model-card")).toHaveCount(1)
  await expect(page.locator(".kvinput")).toHaveCount(0)
  await expect(page.locator(".kvvalue.masked")).toBeVisible()
  await expect(page.locator(".btnrow button").first()).toHaveText("登出")
  await expect(page.locator(".btnrow button").last()).toHaveText("测试连接")

  await page.locator(".btnrow").getByRole("button", { name: "登出" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "登出" }).click()

  await expect(page.locator(".provider-badge")).toHaveText("未连接")
  await expect(page.locator(".model-card")).toHaveCount(0)
})

test("测试连接成功显示耗时，失败显示上游原文", async ({ page, modelsGateway }) => {
  await openModels(page, modelsGateway)

  await page.locator('.provider-row[data-provider="anthropic"]').click()
  await page.getByRole("button", { name: "测试连接" }).click()
  await expect(page.locator(".test-result")).toContainText("连接正常")
  await expect(page.locator(".test-result")).toContainText("ms")

  await page.locator(".settings-crumbs").getByRole("button", { name: "供应商" }).click()
  await page.locator('.provider-row[data-provider="deepseek"]').click()
  await page.getByRole("button", { name: "测试连接" }).click()
  await expect(page.locator(".test-result")).toContainText("upstream rejected the key")
  await expect(page.getByRole("button", { name: "测试连接" })).toBeEnabled()
})

test("模型行带图标与开放开关，关闭后不进 Composer 目录", async ({ page, modelsGateway }) => {
  await openModels(page, modelsGateway)
  await page.locator('.provider-row[data-provider="anthropic"]').click()

  await expect(page.locator(".model-row .vendor-mark")).toHaveCount(3)

  const sonnet = page.locator(".model-row").filter({ hasText: "Claude Sonnet 4.5" })
  const toggle = sonnet.getByRole("switch")

  await expect(toggle).toBeChecked()

  const catalog = page.waitForResponse(
    (response) =>
      response.url().includes("/api/v1/platform/models") && response.request().method() === "GET",
  )

  await toggle.click()
  await catalog
  await expect(toggle).not.toBeChecked()
  await expect(page.locator(".model-row")).toHaveCount(3)

  await page.keyboard.press("Escape")
  await expect(page.locator(".settings-dialog")).toBeHidden()

  await page.locator(".selector").click()
  await page.locator(".picker-menu .search input").fill("Claude Sonnet 4.5")
  await expect(page.locator(".picker-menu .model-item")).toHaveCount(0)
})

test("模型参数保存后重开仍在，恢复默认回到模型默认", async ({ page, modelsGateway }) => {
  await openModels(page, modelsGateway)
  await page.locator(".provider-row").filter({ hasText: "Anthropic" }).click()

  const row = page.locator(".model-toggle").filter({ hasText: "Claude Opus 4.7" })
  const maxTokens = page.locator(".field").filter({ hasText: "最大输出" }).locator("input")

  await row.click()
  await expect(maxTokens).toHaveValue("32000")

  const high = page.getByRole("tab", { name: "high", exact: true })

  await maxTokens.fill("8192")
  await high.click()
  await page.getByRole("button", { name: "保存参数" }).click()

  await row.click()
  await row.click()
  await expect(maxTokens).toHaveValue("8192")
  await expect(high).toHaveAttribute("aria-selected", "true")

  await page.getByRole("button", { name: "恢复默认" }).click()
  await expect(maxTokens).toHaveValue("32000")
})

test("刷新模型后新模型出现在详情与 Composer 目录", async ({ page, modelsGateway }) => {
  await openModels(page, modelsGateway)
  await page.locator(".provider-row").filter({ hasText: "Anthropic" }).click()
  await expect(page.locator(".model-card")).toHaveCount(3)

  await page.getByRole("button", { name: "刷新模型" }).click()
  await expect(page.locator(".model-card")).toHaveCount(4)
  await expect(page.locator(".model-card").filter({ hasText: "Claude Sonnet 5" })).toHaveCount(1)

  await page.keyboard.press("Escape")
  await expect(page.locator(".settings-dialog")).toBeHidden()

  await page.locator(".selector").click()
  await page.locator(".picker-menu .search input").fill("sonnet 5")
  await expect(page.locator(".picker-menu .model-item")).toContainText("Claude Sonnet 5")
})
