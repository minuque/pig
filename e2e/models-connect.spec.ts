import { expect, seedWorkspace, test } from "./fixtures.js"

test("填 Key 保存并连接，登出后回到未连接", async ({ page, modelsGateway }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await seedWorkspace(page, modelsGateway.workspaceId)
  await page.goto(modelsGateway.entryUrl)
  await expect(page.locator("nav.session-list")).toBeVisible({ timeout: 30_000 })

  await page.locator(".nav-footer").getByRole("button", { name: "设置" }).click()
  await page.locator(".settings-nav").getByRole("button", { name: "模型" }).click()

  await page.locator('.provider-row[data-provider="openai"]').click()
  await expect(page.locator(".provider-detail-title")).toHaveText("OpenAI")
  await expect(page.locator(".provider-badge")).toHaveText("未连接")

  await page.locator(".kvinput").fill("sk-openai-test")
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

test("OAuth 登录自动打开授权页", async ({ page, modelsGateway }) => {
  await page.addInitScript(() => {
    const opened: string[] = []

    ;(window as unknown as { __opened: string[] }).__opened = opened
    window.open = ((url?: string | URL) => {
      opened.push(String(url))
      return null
    }) as typeof window.open
  })

  await page.emulateMedia({ reducedMotion: "reduce" })
  await seedWorkspace(page, modelsGateway.workspaceId)
  await page.goto(modelsGateway.entryUrl)
  await expect(page.locator("nav.session-list")).toBeVisible({ timeout: 30_000 })

  await page.locator(".nav-footer").getByRole("button", { name: "设置" }).click()
  await page.locator(".settings-nav").getByRole("button", { name: "模型" }).click()

  await page.locator('.provider-row[data-provider="openai"]').click()
  await page.getByRole("button", { name: "订阅登录" }).click()
  await page.getByRole("button", { name: "开始登录" }).click()

  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __opened: string[] }).__opened))
    .toContain("https://auth.example/authorize")
})

test("测试连接成功显示耗时，失败显示上游原文", async ({ page, modelsGateway }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await seedWorkspace(page, modelsGateway.workspaceId)
  await page.goto(modelsGateway.entryUrl)
  await expect(page.locator("nav.session-list")).toBeVisible({ timeout: 30_000 })

  await page.locator(".nav-footer").getByRole("button", { name: "设置" }).click()
  await page.locator(".settings-nav").getByRole("button", { name: "模型" }).click()

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
