import type { Page } from "@playwright/test"
import { expect, seedWorkspace, test, type E2eGateway } from "./fixtures.js"
import { FILLER_PREFIX } from "./prebuild-session.js"

async function enter(page: Page, gateway: E2eGateway) {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await seedWorkspace(page, gateway.workspaceId)
  await page.goto(gateway.entryUrl)
  await expect(page.locator("nav.session-list")).toBeVisible({ timeout: 30_000 })
  await page.locator(".session-section").first().locator(".section-toggle").click()
  await expect(page.locator(".session-card").first()).toBeVisible()
}

test("改名后侧栏标签跟着变", async ({ page, navGateway }) => {
  await enter(page, navGateway)

  const first = page.locator(".session-card").first()
  await expect(first.locator(".title")).toHaveText(`${FILLER_PREFIX} 6`)

  // 更多按钮靠 hover 才可点
  await first.hover()
  await first.getByRole("button", { name: "更多" }).click()
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

  await expect(page.locator(".session-card")).toHaveCount(5)
  await page.locator(".session-card").first().hover()
  await page.locator(".session-card").first().getByRole("button", { name: "更多" }).click()
  await page.getByRole("menuitem", { name: "删除会话" }).click()

  const dialog = page.getByRole("alertdialog")
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText(`${FILLER_PREFIX} 6`)

  await dialog.getByRole("button", { name: "删除会话" }).click()

  // 删掉最新一条后，原来排在第二页的「批量会话 1」顶上来，可见数仍是 5
  await expect(
    page.locator(".session-card", { has: page.getByText(`${FILLER_PREFIX} 6`, { exact: true }) }),
  ).toHaveCount(0)
  await expect(page.locator(".session-card")).toHaveCount(5)
  await expect(page.locator(".session-card").last().locator(".title")).toHaveText(
    `${FILLER_PREFIX} 1`,
  )
})
