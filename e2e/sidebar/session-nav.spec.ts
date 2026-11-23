import type { Locator, Page } from "@playwright/test"
import { expect, seedWorkspace, test, type E2eGateway } from "../support/fixtures.js"
import { FILLER_PREFIX } from "../support/prebuild-session.js"
import { installTurnBridge } from "../support/sim-turn.js"

async function enter(page: Page, gateway: E2eGateway) {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await seedWorkspace(page, gateway.workspaceId)
  await page.goto(gateway.entryUrl)
  await expect(page.locator("nav.session-list")).toBeVisible({ timeout: 30_000 })
}

const section = (page: Page) => page.locator('.session-section[data-key="active"]')

test("行尾标记完成按钮把会话收进已完成段", async ({ page, navGateway }) => {
  await enter(page, navGateway)

  const first = section(page).locator(".session-card").first()
  await expect(first).toContainText(`${FILLER_PREFIX} 6`)
  await first.hover()
  await first.getByRole("button", { name: "标记完成" }).click()

  await expect(section(page).locator(".session-card")).toHaveCount(5)
  const settled = page.locator('.session-section[data-key="settled"]')
  await expect(settled.locator(".section-count")).toHaveText("1")

  await settled.locator(".section-toggle").click()
  await expect(settled.locator(".session-card")).toContainText(`${FILLER_PREFIX} 6`)
})

test("搜索弹层过滤并跳到选中会话", async ({ page, navGateway }) => {
  await enter(page, navGateway)

  await page.locator(".nav-head").getByRole("button", { name: "搜索" }).click()

  const dialog = page.getByRole("dialog", { name: "搜索" })
  await expect(dialog).toBeVisible()

  const input = dialog.getByPlaceholder("搜索会话和项目")
  await input.fill("批量会话 3")
  await expect(dialog.getByRole("option")).toHaveCount(1)
  await expect(dialog.getByRole("option")).toContainText(`${FILLER_PREFIX} 3`)

  await input.fill("没有这个会话")
  await expect(dialog.getByRole("option")).toHaveCount(0)
  await expect(dialog.getByText("没有匹配的会话")).toBeVisible()

  await input.fill("批量会话 2")
  await dialog.getByRole("option").first().click()
  await expect(page).toHaveURL(/\/sessions\/e2e-filler-1$/)
  await expect(dialog).toHaveCount(0)

  await page.locator(".nav-head").getByRole("button", { name: "搜索" }).click()
  await input.fill("批量会话 3")
  await input.press("Enter")
  await expect(page).toHaveURL(/\/sessions\/e2e-filler-2$/)
})

async function dragCardTo(page: Page, from: Locator, point: { x: number; y: number }) {
  const start = await from.boundingBox()

  expect(start).not.toBeNull()
  await page.mouse.move(start!.x + start!.width / 2, start!.y + start!.height / 2)
  await page.mouse.down()
  await page.mouse.move(point.x, point.y, { steps: 12 })
  await expect(page.locator(".drag-ghost")).toBeVisible()
  await page.mouse.up()
}

async function dragCard(page: Page, from: Locator, to: Locator, at: "center" | "below" = "center") {
  const start = await from.boundingBox()
  const end = await to.boundingBox()

  expect(start).not.toBeNull()
  expect(end).not.toBeNull()
  await page.mouse.move(start!.x + start!.width / 2, start!.y + start!.height / 2)
  await page.mouse.down()
  const y = at === "below" ? end!.y + end!.height + 20 : end!.y + end!.height / 2
  await page.mouse.move(end!.x + end!.width / 2, y, { steps: 12 })
  await page.mouse.up()
}

test("拖拽会话进出置顶区：拖进置顶、拖出取消置顶", async ({ page, navGateway }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await seedWorkspace(page, navGateway.workspaceId)
  await page.addInitScript(() => {
    localStorage.setItem("pig.sidebarPinnedSessions", JSON.stringify(["e2e-filler-5"]))
  })
  await page.goto(navGateway.entryUrl)
  await expect(page.locator("nav.session-list")).toBeVisible({ timeout: 30_000 })

  const pinned = page.locator('.session-section[data-key="pinned"]')
  await expect(pinned.locator(".session-card")).toHaveCount(1)

  const source = page.locator(".session-card", { hasText: "批量会话 4" }).first()
  await dragCard(page, source, pinned.locator(".session-card").last(), "below")
  await expect(pinned.locator(".session-card")).toHaveCount(2)
  await expect(pinned.locator(".session-card").last()).toContainText("批量会话 4")

  await dragCard(
    page,
    pinned.locator(".session-card").last(),
    section(page).locator(".session-card").first(),
    "below",
  )
  await expect(pinned.locator(".session-card")).toHaveCount(1)
  await expect(pinned.locator(".session-card").first()).toContainText("批量会话 6")
})

test("按住行尾标记完成按钮往下扫，扫过的会话一起标记完成", async ({ page, navGateway }) => {
  await enter(page, navGateway)

  const cards = section(page).locator(".session-card")
  await cards.first().hover()
  const button = await cards.first().getByRole("button", { name: "标记完成" }).boundingBox()
  const third = await cards.nth(2).boundingBox()

  expect(button).not.toBeNull()
  expect(third).not.toBeNull()
  await page.mouse.move(button!.x + button!.width / 2, button!.y + button!.height / 2)
  await page.mouse.down()
  await page.mouse.move(button!.x + button!.width / 2, third!.y + third!.height / 2, { steps: 8 })
  await page.mouse.up()

  await expect(cards).toHaveCount(3)
  await expect(page.locator('.session-section[data-key="settled"] .section-count')).toHaveText("3")
})

test("会话拖出侧栏落到输入卡成为会话引用 chip，提交原文带引用；落到别处取消", async ({
  page,
  navGateway,
}) => {
  const bridge = await installTurnBridge(page)

  await enter(page, navGateway)
  await section(page)
    .locator(".session-card", { hasText: `${FILLER_PREFIX} 1` })
    .click()
  await expect(page).toHaveURL(/\/sessions\/e2e-filler-0$/)

  const prompt = page.getByRole("textbox", { name: "Prompt" })
  const source = section(page).locator(".session-card", { hasText: `${FILLER_PREFIX} 6` })
  const composer = await page.locator(".composer-card").boundingBox()

  expect(composer).not.toBeNull()
  await dragCardTo(page, source, { x: composer!.x + composer!.width / 2, y: composer!.y - 40 })
  await expect(page.locator(".drag-ghost")).toHaveCount(0)
  await expect(prompt.locator(".chip")).toHaveCount(0)
  await expect(section(page).locator(".session-card").first()).toContainText(`${FILLER_PREFIX} 6`)

  await dragCard(page, source, prompt)
  await expect(prompt.locator('.chip[data-context-kind="session"]')).toHaveText(
    `${FILLER_PREFIX} 6`,
  )
  await expect(section(page).locator(".session-card")).toHaveCount(6)
  await expect(page.locator(".attach-tray .chip")).toHaveCount(0)

  await prompt.press("Control+Enter")
  await expect.poll(() => bridge.prompts.length).toBe(1)
  expect(bridge.prompts[0]?.trim()).toBe(
    `[${FILLER_PREFIX} 6](pig-context://v1/session/e2e-filler-5)`,
  )
})
