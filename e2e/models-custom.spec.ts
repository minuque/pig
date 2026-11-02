import { expect, seedWorkspace, test } from "./fixtures.js"

test("新增自定义供应商，刷新后仍在，编辑后删除", async ({ page, modelsGateway }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await seedWorkspace(page, modelsGateway.workspaceId)
  await page.goto(modelsGateway.entryUrl)
  await expect(page.locator("nav.session-list")).toBeVisible({ timeout: 30_000 })

  await page.locator(".nav-footer").getByRole("button", { name: "设置" }).click()
  await page.locator(".settings-nav").getByRole("button", { name: "模型" }).click()

  await page.getByRole("button", { name: "添加" }).click()
  await page.getByLabel(/供应商 ID/).fill("myapi")
  await page.getByLabel(/Base URL/).fill("https://api.example/v1")
  await page.getByRole("button", { name: "添加模型" }).click()
  await page.getByLabel(/模型 ID/).fill("my-model")
  await page.getByLabel(/上下文/).fill("64000")
  await page.getByRole("button", { name: "保存" }).click()

  await expect(page.locator(".provider-detail-title")).toHaveText("myapi")

  await page.locator(".provider-back").click()

  const customGroup = page
    .locator(".provider-group")
    .filter({ has: page.locator(".provider-group-title", { hasText: "自定义" }) })

  await expect(customGroup.locator(".provider-row").filter({ hasText: "myapi" })).toBeVisible()

  await page.reload()
  await expect(page.locator("nav.session-list")).toBeVisible({ timeout: 30_000 })
  await page.locator(".nav-footer").getByRole("button", { name: "设置" }).click()
  await page.locator(".settings-nav").getByRole("button", { name: "模型" }).click()

  const row = page.locator(".provider-row").filter({ hasText: "myapi" })

  await expect(row).toBeVisible()
  await row.click()
  await page.getByLabel(/显示名称/).fill("我的接口")
  await page.getByRole("button", { name: "保存" }).click()
  await expect(page.locator(".provider-detail-title")).toHaveText("我的接口")

  await page.locator(".provider-back").click()
  await page.locator(".provider-row").filter({ hasText: "我的接口" }).click()
  await page.getByRole("button", { name: "删除供应商" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "删除供应商" }).click()

  await expect(page.locator(".provider-row").filter({ hasText: "我的接口" })).toHaveCount(0)
})
