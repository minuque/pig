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

  const toggle = settled.locator(".section-toggle")
  await toggle.click()
  await expect(toggle).toHaveAttribute("aria-expanded", "true")
  await expect(settled.locator(".session-card")).toContainText(`${FILLER_PREFIX} 6`)

  await toggle.click()
  await expect(toggle).toHaveAttribute("aria-expanded", "false")
  await expect(settled.locator(".session-card")).toHaveCount(0)
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

test("键盘拖拽会话进出置顶区与排序：空格拿起、方向键移动、空格放下", async ({
  page,
  navGateway,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await seedWorkspace(page, navGateway.workspaceId)
  await page.addInitScript(() => {
    localStorage.setItem("pig.sidebarPinnedSessions", JSON.stringify(["e2e-filler-5"]))
  })
  await page.goto(navGateway.entryUrl)
  await expect(page.locator("nav.session-list")).toBeVisible({ timeout: 30_000 })

  const pinned = page.locator('.session-section[data-key="pinned"]')
  await expect(pinned.locator(".session-card")).toHaveCount(1)

  const target = section(page).locator(".session-card", { hasText: "批量会话 4" }).first()
  await target.focus()
  await page.keyboard.press("Space")
  await expect(section(page).locator(".session-row[data-grabbed]")).toContainText("批量会话 4")

  await page.keyboard.press("ArrowLeft")
  await expect(pinned.locator(".session-row[data-grabbed]")).toContainText("批量会话 4")
  await page.keyboard.press("Space")

  await expect(pinned.locator(".session-card")).toHaveCount(2)
  await expect(pinned.locator(".session-row[data-grabbed]")).toHaveCount(0)

  const lastPinned = pinned.locator(".session-card").last()
  const movedTitle = (await lastPinned.locator(".title").innerText()).trim()
  await lastPinned.focus()
  await page.keyboard.press("Space")
  await expect(pinned.locator(".session-row[data-grabbed]")).toContainText(movedTitle)

  await page.keyboard.press("ArrowUp")
  await page.keyboard.press("Space")
  await expect(pinned.locator(".session-card").first()).toContainText(movedTitle)
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

test("会话拖出侧栏落到会话面板插入引用 chip，提交渲染为气泡 chip；落到面板外取消", async ({
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
  await dragCardTo(page, source, { x: composer!.x + composer!.width / 2, y: 12 })
  await expect(page.locator(".drag-ghost")).toHaveCount(0)
  await expect(prompt.locator(".chip")).toHaveCount(0)
  await expect(page.locator(".workbench-pane")).toHaveCount(1)
  await expect(section(page).locator(".session-card").first()).toContainText(`${FILLER_PREFIX} 6`)

  await dragCardTo(page, source, { x: composer!.x + composer!.width / 2, y: composer!.y - 40 })
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
  await expect(page.locator('.row-user .chip[data-context-kind="session"]').last()).toHaveText(
    `${FILLER_PREFIX} 6`,
  )
})
