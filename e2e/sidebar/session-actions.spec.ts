import type { Page } from "@playwright/test"
import { expect, seedWorkspace, test, type E2eGateway } from "../support/fixtures.js"
import { FILLER_PREFIX } from "../support/prebuild-session.js"

async function enter(page: Page, gateway: E2eGateway) {
  await seedWorkspace(page, gateway.workspaceId)
  await page.goto(gateway.entryUrl)
  await expect(page.locator("nav.session-list")).toBeVisible({ timeout: 30_000 })
  await expect(page.locator(".session-card").first()).toBeVisible()
}

function longHistory() {
  return Array.from({ length: 30 }, (_, index) => [
    {
      id: `lu${index}`,
      role: "user",
      content: [{ type: "text", text: `长会话问题 ${index}` }],
      timestamp: index * 10,
    },
    {
      id: `la${index}`,
      role: "assistant",
      content: [{ type: "text", text: `长会话回答 ${index}\n\n${"一段较长的正文。".repeat(40)}` }],
      model: { provider: "test", id: "model" },
      timestamp: index * 10 + 1,
      status: "complete",
      stopReason: "stop",
    },
  ]).flat()
}

test("选目录走真实链路，落到本地偏好", async ({ page, navGateway }) => {
  await page.goto(navGateway.entryUrl)

  await expect(page.locator("h1.hero-title")).toBeVisible({ timeout: 30_000 })
  await expect(page.locator(".hero-picker .hero-name")).toHaveText("workspace")

  expect(await page.evaluate(() => localStorage.getItem("pig.localWorkspaces"))).toBeNull()

  await page.locator(".hero-picker").click()
  await page.getByRole("menuitem", { name: "添加本地目录" }).click()

  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("pig.localWorkspaces")))
    .not.toBeNull()

  const stored = await page.evaluate(() => localStorage.getItem("pig.localWorkspaces"))

  expect(JSON.parse(stored ?? "[]")).toEqual([navGateway.workspaceId])
  expect(await page.evaluate(() => localStorage.getItem("pig.lastCwd"))).toBe(
    navGateway.workspaceId,
  )
})

test("改名后侧栏标签跟着变", async ({ page, navGateway }) => {
  await enter(page, navGateway)

  const first = page.locator(".session-card").first()
  await expect(first.locator(".title")).toHaveText(`${FILLER_PREFIX} 6`)

  await first.click({ button: "right" })
  await page.getByRole("menuitem", { name: "重命名" }).click()

  const input = page.locator(".rename-input")
  await expect(input).toBeVisible()
  await input.fill("改过的名字")
  await input.press("Enter")

  await expect(page.locator(".session-card").first().locator(".title")).toHaveText("改过的名字")
  await expect(page.locator(".session-card").first()).toHaveAttribute(
    "href",
    "/sessions/e2e-filler-5",
  )
})

test("删除会话后从侧栏消失", async ({ page, navGateway }) => {
  await enter(page, navGateway)

  await expect(page.locator(".session-card")).toHaveCount(6)
  await page.locator(".session-card").first().click({ button: "right" })
  await page.getByRole("menuitem", { name: "删除会话" }).click()

  const dialog = page.getByRole("alertdialog")
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText(`${FILLER_PREFIX} 6`)

  await dialog.getByRole("button", { name: "删除会话" }).click()

  await expect(
    page.locator(".session-card", { has: page.getByText(`${FILLER_PREFIX} 6`, { exact: true }) }),
  ).toHaveCount(0)
  await expect(page.locator(".session-card")).toHaveCount(5)
  await expect(page.locator(".session-card").last().locator(".title")).toHaveText(
    `${FILLER_PREFIX} 1`,
  )
})

test("切走再切回：停在离开时的位置，不跳到底部", async ({ page, navGateway }) => {
  await page.route("**/api/v1/platform/transcript?**", (route) => {
    const id = new URL(route.request().url()).searchParams.get("sessionId")

    if (id !== "e2e-filler-5") return route.fallback()
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ items: longHistory(), timings: [], hasMore: false }),
    })
  })
  await enter(page, navGateway)
  const cards = page.locator(".session-card")
  const panel = page.locator("#transcript-panel")

  await cards.nth(0).click()
  await expect(page.getByText("长会话回答 29")).toBeVisible({ timeout: 30_000 })
  await panel.evaluate((el) => {
    el.scrollTop = 600
    el.dispatchEvent(new WheelEvent("wheel", { deltaY: -120, bubbles: true }))
    el.dispatchEvent(new Event("scroll"))
  })
  await expect.poll(() => panel.evaluate((el) => Math.round(el.scrollTop))).toBe(600)

  await cards.nth(2).click()
  await expect(page).toHaveURL(/\/sessions\/e2e-filler-3$/, { timeout: 30_000 })
  await expect(page.getByText(`${FILLER_PREFIX} 4 的内容`, { exact: true })).toBeVisible()
  await expect(page.getByText("长会话回答 29")).toHaveCount(0)
  await cards.nth(0).click()
  await expect(page).toHaveURL(/\/sessions\/e2e-filler-5$/, { timeout: 30_000 })
  await expect(page.getByText("长会话回答 29")).toBeAttached()
  await expect.poll(() => panel.evaluate((el) => Math.round(el.scrollTop))).toBe(600)
})
