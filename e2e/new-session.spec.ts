import { expect, seedWorkspace, test } from "./fixtures.js"
import { installTurnBridge } from "./sim-turn.js"

test("首页发首条 Prompt 建出会话，侧栏立刻多一张卡", async ({ page, gateway }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await seedWorkspace(page, gateway.workspaceId)
  const bridge = await installTurnBridge(page)

  await page.goto(gateway.entryUrl)
  await expect(page.locator("h1.hero-title")).toBeVisible({ timeout: 30_000 })

  const prompt = page.getByRole("textbox", { name: "Prompt" })

  await prompt.fill("新建一个会话")
  await page.locator("button.send").click()

  const sessionId = await bridge.waitForPrompt()

  await expect(page).toHaveURL(new RegExp(`/sessions/${sessionId}$`), { timeout: 30_000 })
  await expect(
    page.locator(".row-user").getByText("新建一个会话", { exact: true }).first(),
  ).toBeVisible()

  // 侧栏按日期分组，默认收起
  await page.locator(".session-section").first().locator(".section-toggle").click()
  await expect(page.locator(".session-card")).toHaveCount(1)
})
