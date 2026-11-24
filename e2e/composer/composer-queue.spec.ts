import type { Page } from "@playwright/test"
import { expect, seedWorkspace, test } from "../support/fixtures.js"
import { COMPLEX_SESSION_ID, COMPLEX_SESSION_NAME } from "../support/prebuild-session.js"
import { installTurnBridge } from "../support/sim-turn.js"

async function openSession(page: Page, gateway: { entryUrl: string; workspaceId: string }) {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await seedWorkspace(page, gateway.workspaceId)
  await page.goto(gateway.entryUrl)

  const card = page.locator(".session-card", {
    has: page.getByText(COMPLEX_SESSION_NAME, { exact: true }),
  })

  await expect(card).toBeVisible({ timeout: 30_000 })
  await card.click()
  await expect(page).toHaveURL(new RegExp(`/sessions/${COMPLEX_SESSION_ID}$`))
}

async function startTurn(page: Page) {
  await page.getByRole("textbox", { name: "Prompt" }).fill("预热一轮")
  await page.locator("button.send").click()
  await expect(page.getByRole("button", { name: "停止当前 Turn" })).toBeVisible({
    timeout: 30_000,
  })
}

async function enqueue(page: Page, texts: readonly string[]) {
  const prompt = page.getByRole("textbox", { name: "Prompt" })

  for (const text of texts) {
    await prompt.fill(text)
    await prompt.press("Enter")
  }
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

test("队列编辑：草稿原位保留，Enter 保存、Escape 取消", async ({ page, complexGateway }) => {
  test.setTimeout(120_000)
  await installTurnBridge(page)
  await openSession(page, complexGateway)
  await startTurn(page)

  const prompt = page.getByRole("textbox", { name: "Prompt" })
  const queue = page.getByRole("list", { name: "待发队列" })
  const editing = queue.locator(".row.is-editing")

  await enqueue(page, ["排队第二条"])
  await expect(queue.locator(".row")).toHaveCount(1)

  await prompt.fill("未发送草稿")
  await page.getByRole("button", { name: "编辑", exact: true }).click()
  await expect(editing).toHaveCount(1)
  await expect(editing).toContainText("排队第二条")
  await expect(prompt).toHaveText("排队第二条")

  await prompt.fill("排队第二条改过")
  await prompt.press("Enter")
  await expect(editing).toHaveCount(0)
  await expect(queue).toContainText("排队第二条改过")
  await expect(prompt).toHaveText("未发送草稿")

  await page.getByRole("button", { name: "编辑", exact: true }).click()
  await expect(editing).toHaveCount(1)
  await prompt.fill("这次不要了")
  await prompt.press("Escape")
  await expect(editing).toHaveCount(0)
  await expect(queue).toContainText("排队第二条改过")
  await expect(queue).not.toContainText("这次不要了")
  await expect(prompt).toHaveText("未发送草稿")
  await expect(page.locator('[data-testid="turn-status"]')).toBeVisible()
})

test("队列排序：拖拽手柄与键盘抓取都能换位", async ({ page, complexGateway }) => {
  test.setTimeout(120_000)
  await installTurnBridge(page)
  await openSession(page, complexGateway)
  await startTurn(page)

  const queue = page.getByRole("list", { name: "待发队列" })
  const rows = queue.locator(".row")

  await enqueue(page, ["第一条排队", "第二条排队"])
  await expect(rows).toHaveCount(2)

  await rows
    .nth(1)
    .locator(".row-grip")
    .dragTo(rows.nth(0), { targetPosition: { x: 100, y: 4 } })
  await expect(rows.nth(0)).toContainText("第二条排队")
  await expect(rows.nth(1)).toContainText("第一条排队")

  const grip = rows.nth(1).locator(".row-grip")
  await grip.focus()
  await page.keyboard.press("Space")
  await expect(grip).toHaveAttribute("aria-pressed", "true")
  await page.keyboard.press("ArrowUp")
  await page.keyboard.press("Space")
  await expect(rows.nth(0)).toContainText("第一条排队")
  await expect(rows.nth(1)).toContainText("第二条排队")
})

test("队列超过 3 条：展开与收起", async ({ page, complexGateway }) => {
  test.setTimeout(120_000)
  await installTurnBridge(page)
  await openSession(page, complexGateway)
  await startTurn(page)

  const queue = page.getByRole("list", { name: "待发队列" })
  const rows = queue.locator(".row")

  await enqueue(page, ["排队一", "排队二", "排队三", "排队四"])

  const expand = page.getByRole("button", { name: "展开其余 1 条" })

  await expect(rows).toHaveCount(3)
  await expect(rows.nth(2)).toContainText("排队三")
  await expect(expand).toHaveAttribute("aria-expanded", "false")

  await expand.click()
  await expect(rows).toHaveCount(4)
  await expect(rows.nth(3)).toContainText("排队四")

  await page.getByRole("button", { name: "收起队列" }).click()
  await expect(rows).toHaveCount(3)
  await expect(expand).toHaveAttribute("aria-expanded", "false")
})
