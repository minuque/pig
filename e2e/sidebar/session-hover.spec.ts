import type { Page } from "@playwright/test"
import { expect, seedWorkspace, test, type E2eGateway } from "../support/fixtures.js"
import { FILLER_PREFIX } from "../support/prebuild-session.js"

async function enter(page: Page, gateway: E2eGateway) {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await seedWorkspace(page, gateway.workspaceId)
  await page.goto(gateway.entryUrl)
  await expect(page.locator("nav.session-list")).toBeVisible({ timeout: 30_000 })
}

const card = (page: Page, n: number) =>
  page
    .locator('.session-section[data-key="active"] .session-card', {
      hasText: `${FILLER_PREFIX} ${n}`,
    })
    .first()
const hoverCard = (page: Page) => page.locator('[data-slot="hover-card-content"][data-open]')

async function expectStaysClosed(page: Page) {
  await page.waitForTimeout(600)
  await expect(hoverCard(page)).toHaveCount(0)
}

test("滚轮划过侧栏后指针停在卡片上不弹详情，移动指针才恢复", async ({ page, navGateway }) => {
  await enter(page, navGateway)

  await card(page, 2).hover()
  await expect(hoverCard(page)).toBeVisible()

  await page.mouse.wheel(0, 240)
  await expectStaysClosed(page)

  await card(page, 4).hover()
  await expect(hoverCard(page)).toBeVisible()
})

test("侧栏会话卡悬停弹出详情；点击、右键与拖动侧栏宽度时不弹出", async ({ page, navGateway }) => {
  await enter(page, navGateway)

  await card(page, 2).hover()
  await expect(hoverCard(page)).toBeVisible()
  await page.mouse.move(800, 400)
  await expect(hoverCard(page)).toHaveCount(0)

  await card(page, 3).click()
  await expect(page).toHaveURL(/\/sessions\/e2e-filler-2$/)
  await expectStaysClosed(page)

  await page.mouse.move(800, 400)
  await card(page, 4).click({ button: "right" })
  await expect(page.getByRole("menu")).toBeVisible()
  await expectStaysClosed(page)
  await page.keyboard.press("Escape")
  await expect(page.getByRole("menu")).toHaveCount(0)
  await expectStaysClosed(page)

  await page.mouse.move(800, 400)
  const resizer = page.locator(".resizer")
  const box = (await resizer.boundingBox())!
  const cardBox = (await card(page, 2).boundingBox())!
  const y = Math.round(cardBox.y + cardBox.height / 2)

  await page.mouse.move(box.x - 4, y)
  await expect(resizer).toHaveAttribute("data-hovering", "")
  await page.mouse.down()
  await page.mouse.move(box.x - 120, y, { steps: 12 })
  await expect(resizer).toHaveAttribute("data-dragging", "")
  await expect(hoverCard(page)).toHaveCount(0)
  await page.mouse.up()
  await expectStaysClosed(page)
})
