import type { Page } from "@playwright/test"
import { expect, test } from "./fixtures.js"
import { COMPLEX_SESSION_ID, COMPLEX_SESSION_NAME } from "./prebuild-session.js"
import { installTurnBridge } from "./sim-turn.js"

async function seedWorkspace(page: Page, workspaceId: string) {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.addInitScript(
    ({ id }) => {
      localStorage.setItem("pig.localWorkspaces", JSON.stringify([id]))
      localStorage.setItem("pig.lastCwd", id)
      localStorage.setItem("npg-theme", "light")
    },
    { id: workspaceId },
  )
}

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

  // 第一条 prompt 让会话进入 turn
  await prompt.fill("第一轮")
  await page.locator("button.send").click()
  await expect(page.getByRole("button", { name: "停止当前 Turn" })).toBeVisible({
    timeout: 30_000,
  })

  // running + 空白：Enter 不打断，按钮保持停止态
  await prompt.press("Enter")
  await expect(page.getByRole("button", { name: "停止当前 Turn" })).toBeVisible()
  await expect(page.locator(".queue-panel")).toHaveCount(0)

  // running + 文本：Enter 入队而不是打断
  await prompt.fill("排队第二条")
  await prompt.press("Enter")
  const queue = page.getByRole("list", { name: "待发队列" })

  await expect(queue).toBeVisible()
  await expect(queue).toContainText("排队第二条")
  await expect(prompt).toHaveValue("")

  // 中止当前轮 → idle 自动泵队首，排队文本成为新的用户消息
  await page.keyboard.press("Escape")
  await expect(
    page.locator(".row-user").getByText("排队第二条", { exact: true }).first(),
  ).toBeVisible({ timeout: 30_000 })
  await expect(queue).toHaveCount(0)
})

test("队列编辑：消息搬回输入框，队列清空", async ({ page, complexGateway }) => {
  test.setTimeout(120_000)
  await installTurnBridge(page)
  await openSession(page, complexGateway)

  const prompt = page.getByRole("textbox", { name: "Prompt" })

  await prompt.fill("第一轮")
  await page.locator("button.send").click()
  await expect(page.getByRole("button", { name: "停止当前 Turn" })).toBeVisible({
    timeout: 30_000,
  })

  await prompt.fill("排队第二条")
  await prompt.press("Enter")
  const queue = page.getByRole("list", { name: "待发队列" })

  await expect(queue).toBeVisible()

  await page.getByRole("button", { name: "编辑", exact: true }).click()
  await expect(queue).toHaveCount(0)
  await expect(prompt).toHaveValue("排队第二条")
})

test("队列拖拽排序：拖到队首换位", async ({ page, complexGateway }) => {
  test.setTimeout(120_000)
  await installTurnBridge(page)
  await openSession(page, complexGateway)

  const prompt = page.getByRole("textbox", { name: "Prompt" })

  await prompt.fill("预热一轮")
  await page.locator("button.send").click()
  await expect(page.getByRole("button", { name: "停止当前 Turn" })).toBeVisible({
    timeout: 30_000,
  })

  await prompt.fill("第一条排队")
  await prompt.press("Enter")
  await prompt.fill("第二条排队")
  await prompt.press("Enter")

  const queue = page.getByRole("list", { name: "待发队列" })
  const rows = queue.locator(".row")

  await expect(rows).toHaveCount(2)

  // 第二条拖到第一条上方（目标行中点之上）
  await rows.nth(1).dragTo(rows.nth(0), { targetPosition: { x: 100, y: 4 } })
  await expect(rows.nth(0)).toContainText("第二条排队")
  await expect(rows.nth(1)).toContainText("第一条排队")
})
