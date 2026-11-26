import type { Page } from "@playwright/test"
import { expect, seedWorkspace, test } from "../support/fixtures.js"
import { COMPLEX_SESSION_ID, COMPLEX_SESSION_NAME } from "../support/prebuild-session.js"
import { installTurnBridge } from "../support/sim-turn.js"

async function openSession(page: Page, gateway: { entryUrl: string; workspaceId: string }) {
  await seedWorkspace(page, gateway.workspaceId)
  await page.goto(gateway.entryUrl)

  const card = page.locator(".session-card", {
    has: page.getByText(COMPLEX_SESSION_NAME, { exact: true }),
  })

  await expect(card).toBeVisible({ timeout: 30_000 })
  await card.click()
  await expect(page).toHaveURL(new RegExp(`/sessions/${COMPLEX_SESSION_ID}$`))
}

test("running 时 Enter 入队，轮次结束自动发送队首", async ({ page, complexGateway }) => {
  test.setTimeout(120_000)
  await installTurnBridge(page)
  await openSession(page, complexGateway)

  const prompt = page.getByRole("textbox", { name: "Prompt" })

  await prompt.fill("第一轮")
  await page.locator("button.send").click()
  await expect(page.getByRole("button", { name: "停止当前 Turn" })).toBeVisible({
    timeout: 30_000,
  })

  await prompt.press("Enter")
  await expect(page.getByRole("button", { name: "停止当前 Turn" })).toBeVisible()

  await prompt.fill("排队第二条")
  await prompt.press("Enter")
  const queue = page.getByRole("list", { name: "待发队列" })

  await expect(queue).toBeVisible()
  await expect(queue).toContainText("排队第二条")
  await expect(prompt).toHaveText("")

  await page.keyboard.press("Escape")
  await expect(
    page.locator(".row-user").getByText("排队第二条", { exact: true }).first(),
  ).toBeVisible({ timeout: 30_000 })
  await expect(queue).toHaveCount(0)
})
