import { expect, seedWorkspace, test } from "./fixtures.js"
import { installTurnBridge } from "./sim-turn.js"

test("首页发首条 Prompt 建出会话，侧栏立刻多一张卡", async ({ page, gateway }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await seedWorkspace(page, gateway.workspaceId)
  const bridge = await installTurnBridge(page)

  await page.goto(gateway.entryUrl)
  await expect(page.locator("h1.hero-title")).toBeVisible({ timeout: 30_000 })
  await expect(page.locator(".startup-gate")).not.toHaveAttribute("inert")
  await expect(page.locator(".selector-name")).not.toHaveText("—")

  const prompt = page.getByRole("textbox", { name: "Prompt" })
  const send = page.locator("button.send")

  await prompt.fill("新建一个会话")
  await expect(send).toBeEnabled()
  await send.click()

  const sessionId = await bridge.waitForPrompt()

  await expect(page).toHaveURL(new RegExp(`/sessions/${sessionId}$`), { timeout: 30_000 })
  await expect(
    page.locator(".row-user").getByText("新建一个会话", { exact: true }).first(),
  ).toBeVisible()

  // 收件箱默认展开，新建的会话直接出现在列表里
  await expect(page.locator(".session-card")).toHaveCount(1)
})

test("会话在跑时点新建会话，侧栏仍显示工作中，切回还在跑", async ({ page, gateway }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await seedWorkspace(page, gateway.workspaceId)
  const bridge = await installTurnBridge(page)

  await page.goto(gateway.entryUrl)
  await expect(page.locator(".startup-gate")).not.toHaveAttribute("inert", { timeout: 30_000 })
  await expect(page.locator(".selector-name")).not.toHaveText("—")
  await page.getByRole("textbox", { name: "Prompt" }).fill("并行的第一个会话")
  await page.locator("button.send").click()
  const sessionId = await bridge.waitForPrompt()
  await expect(page).toHaveURL(new RegExp(`/sessions/${sessionId}$`), { timeout: 30_000 })
  await expect(page.locator('[data-testid="turn-status"]')).toBeVisible()

  await page.locator(".nav-head").getByRole("button", { name: "新建会话", exact: true }).click()
  await expect(page).not.toHaveURL(/\/sessions\//)
  const card = page.locator('.session-section[data-key="working"] .session-card')
  await expect(card.locator(".working-status")).toBeVisible()

  await card.click()
  await expect(page).toHaveURL(new RegExp(`/sessions/${sessionId}$`))
  await expect(page.locator('[data-testid="turn-status"]')).toBeVisible()
})
