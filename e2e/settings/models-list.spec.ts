import { expect, seedWorkspace, test } from "../support/fixtures.js"

test("模型行带图标与开放开关，关闭后不进 Composer 目录", async ({ page, modelsGateway }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await seedWorkspace(page, modelsGateway.workspaceId)
  await page.goto(modelsGateway.entryUrl)
  await expect(page.locator("nav.session-list")).toBeVisible({ timeout: 30_000 })

  await page.locator(".nav-footer").getByRole("button", { name: "设置" }).click()
  await page.locator(".settings-nav").getByRole("button", { name: "模型" }).click()
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
