import { expect, seedWorkspace, test } from "./fixtures.js"

async function openWorkspace(
  page: import("@playwright/test").Page,
  gateway: { entryUrl: string; workspaceId: string },
) {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await seedWorkspace(page, gateway.workspaceId)
  await page.goto(gateway.entryUrl)
  await expect(page.locator("nav.session-list")).toBeVisible({ timeout: 30_000 })
}

async function openModels(
  page: import("@playwright/test").Page,
  gateway: { entryUrl: string; workspaceId: string },
) {
  await openWorkspace(page, gateway)
  await page.locator(".nav-footer").getByRole("button", { name: "设置" }).click()
  await page.locator(".settings-nav").getByRole("button", { name: "模型" }).click()
}

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

test("Composer 空态按钮直达模型设置页", async ({ page, emptyModelsGateway }) => {
  await openWorkspace(page, emptyModelsGateway)

  await expect(page.locator(".selector-name")).toHaveText("—")
  await page.locator(".selector").click()
  await page.getByRole("button", { name: "配置模型" }).click()

  await expect(page.locator(".settings-dialog")).toBeVisible()
  await expect(page.locator(".settings-nav .nav-item[aria-current='page']")).toHaveText("模型")
})
