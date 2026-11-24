import { writeFile } from "node:fs/promises"
import { join } from "node:path"
import type { Locator, Page } from "@playwright/test"
import { expect, seedWorkspace, test } from "../support/fixtures.js"
import { COMPLEX_SESSION_ID, COMPLEX_SESSION_NAME } from "../support/prebuild-session.js"
import { installTurnBridge } from "../support/sim-turn.js"

const COMPOSER_MIME = "application/x-pig-composer"

async function openComposer(page: Page, gateway: { entryUrl: string; workspaceId: string }) {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await seedWorkspace(page, gateway.workspaceId)
  await page.goto(gateway.entryUrl)

  const card = page.locator(".session-card", {
    has: page.getByText(COMPLEX_SESSION_NAME, { exact: true }),
  })

  await expect(card).toBeVisible({ timeout: 30_000 })
  await card.click()
  await expect(page).toHaveURL(new RegExp(`/sessions/${COMPLEX_SESSION_ID}$`))
  await expect(page.locator("button.send")).toBeVisible()
}

const field = (page: Page) => page.getByRole("textbox", { name: "Prompt" })

function copyFrom(prompt: Locator): Promise<Record<string, string>> {
  return prompt.evaluate((element, mime) => {
    const data = new DataTransfer()

    element.dispatchEvent(
      new ClipboardEvent("copy", { bubbles: true, cancelable: true, clipboardData: data }),
    )
    return { plain: data.getData("text/plain"), composer: data.getData(mime) }
  }, COMPOSER_MIME)
}

function pasteInto(prompt: Locator, items: Record<string, string>): Promise<void> {
  return prompt.evaluate((element, entries) => {
    const data = new DataTransfer()

    for (const [type, value] of Object.entries(entries)) data.setData(type, value)
    element.dispatchEvent(
      new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: data }),
    )
  }, items)
}

test("中文句中的粗体实时渲染，提交原文", async ({ page, complexGateway }) => {
  test.setTimeout(120_000)
  const bridge = await installTurnBridge(page)

  await openComposer(page, complexGateway)
  const prompt = field(page)

  await prompt.click()
  await prompt.pressSequentially("这是**粗体**呀，那是*斜体*了")
  await expect(prompt.locator("strong")).toHaveText("粗体")
  await expect(prompt.locator("em")).toHaveText("斜体")

  await prompt.press("Control+Enter")
  await expect.poll(() => bridge.prompts.length).toBe(1)
  expect(bridge.prompts[0]).toBe("这是**粗体**呀，那是*斜体*了")
})

test("多反引号行内代码边输入边渲染，内容含反引号也原样提交", async ({ page, complexGateway }) => {
  test.setTimeout(120_000)
  const bridge = await installTurnBridge(page)

  await openComposer(page, complexGateway)
  const prompt = field(page)

  await prompt.click()
  await prompt.pressSequentially("看 ``a`b`` 和 `` `x` `` 了")
  await expect(prompt.locator("code")).toHaveText(["a`b", "`x`"])

  await prompt.press("Control+Enter")
  await expect.poll(() => bridge.prompts.length).toBe(1)
  expect(bridge.prompts[0]).toBe("看 ``a`b`` 和 `` `x` `` 了")
})

test("光标碰到样式时显出 Markdown 标记，离开后收回", async ({ page, complexGateway }) => {
  test.setTimeout(120_000)
  const bridge = await installTurnBridge(page)

  await openComposer(page, complexGateway)
  const prompt = field(page)
  const markers = prompt.locator(".is-source-marker")

  await prompt.click()
  await prompt.pressSequentially("看**粗体**")
  await expect(markers).toHaveText(["**", "**"])
  await expect(prompt.locator("strong")).toHaveText("粗体")

  await prompt.pressSequentially("了")
  await expect(markers).toHaveCount(0)
  await expect(prompt.locator("strong")).toHaveText("粗体")

  await prompt.press("ArrowLeft")
  await expect(markers).toHaveText(["**", "**"])
  await prompt.press("End")
  await expect(markers).toHaveCount(0)

  await prompt.press("Control+Enter")
  await expect.poll(() => bridge.prompts.length).toBe(1)
  expect(bridge.prompts[0]).toBe("看**粗体**了")
})

test("选中文字后敲星号或反引号包成对应标记", async ({ page, complexGateway }) => {
  test.setTimeout(120_000)
  const bridge = await installTurnBridge(page)

  await openComposer(page, complexGateway)
  const prompt = field(page)

  await prompt.click()
  await prompt.pressSequentially("甲 乙")
  await prompt.press("Shift+ArrowLeft")
  await prompt.press("`")
  await prompt.press("End")
  await prompt.pressSequentially(" 丙")
  await expect(prompt.locator("code")).toHaveText("乙")

  await prompt.press("Control+Enter")
  await expect.poll(() => bridge.prompts.length).toBe(1)
  expect(bridge.prompts[0]).toBe("甲 `乙` 丙")
})

test("连续输入合成一步撤销，粘贴单独成步", async ({ page, complexGateway }) => {
  test.setTimeout(120_000)
  await installTurnBridge(page)

  await openComposer(page, complexGateway)
  const prompt = field(page)

  await prompt.click()
  await prompt.pressSequentially("连续输入的一句话")
  await pasteInto(prompt, { "text/plain": "粘贴的" })
  await expect(prompt).toHaveText("连续输入的一句话粘贴的")

  await prompt.press("Control+z")
  await expect(prompt).toHaveText("连续输入的一句话")
  await prompt.press("Control+z")
  await expect(prompt).toHaveText("")
})

test("复制带 chip 的内容粘回仍是 chip，纯文本粘贴的路径与命令也转 chip，代码里不转", async ({
  page,
  complexGateway,
}) => {
  test.setTimeout(120_000)
  await writeFile(join(complexGateway.workspaceDir, "note.md"), "# note")
  await installTurnBridge(page)

  await openComposer(page, complexGateway)
  const prompt = field(page)
  const menu = page.getByRole("listbox", { name: "命令菜单" })
  const chips = prompt.locator("[data-file-mention]")

  await prompt.click()
  await prompt.pressSequentially("看 @note")
  await expect(menu.getByRole("option", { name: /note\.md/ })).toBeVisible()
  await prompt.press("Enter")
  await expect(chips).toHaveCount(1)

  await prompt.press("Control+a")
  const copied = await copyFrom(prompt)

  expect(copied["composer"]).toBe("看 @note.md ")
  await prompt.press("End")
  await pasteInto(prompt, {
    "text/plain": copied["plain"] ?? "",
    [COMPOSER_MIME]: copied["composer"] ?? "",
  })
  await expect(chips).toHaveCount(2)

  await pasteInto(prompt, { "text/plain": copied["plain"] ?? "" })
  await expect(chips).toHaveCount(3)

  await pasteInto(prompt, { "text/plain": "`@note.md`" })
  await expect(chips).toHaveCount(3)
  await expect(prompt.locator("code")).toContainText("@note.md")

  await pasteInto(prompt, { "text/plain": "\n/clear 清空" })
  await expect(prompt.locator("[data-command-chip]")).toHaveText(["clear"])
})

test("列表项里 Tab 缩进、Shift+Tab 退回，提交缩进后的 Markdown", async ({
  page,
  complexGateway,
}) => {
  test.setTimeout(120_000)
  const bridge = await installTurnBridge(page)

  await openComposer(page, complexGateway)
  const prompt = field(page)

  await prompt.click()
  await prompt.pressSequentially("- 甲")
  await prompt.press("Enter")
  await prompt.pressSequentially("乙")
  await prompt.press("Tab")
  await expect(prompt.locator("ul ul > li")).toHaveText(["乙"])

  await prompt.press("Shift+Tab")
  await expect(prompt.locator("ul ul")).toHaveCount(0)
  await expect(prompt.locator("ul > li")).toHaveText(["甲", "乙"])

  await prompt.press("Tab")
  await prompt.pressSequentially("丙")
  await expect(prompt.locator("ul ul > li")).toHaveText(["乙丙"])

  await prompt.press("Control+Enter")
  await expect.poll(() => bridge.prompts.length).toBe(1)
  expect(bridge.prompts[0]).toBe("- 甲\n  - 乙丙")
})

test("命令浮板内联贴在输入卡上方，底部伸入状态条与输入卡背后且 hero 视口不向下翻转", async ({
  page,
  complexGateway,
}) => {
  test.setTimeout(120_000)
  await writeFile(join(complexGateway.workspaceDir, "note.md"), "# note")
  await installTurnBridge(page)

  await page.setViewportSize({ width: 1280, height: 700 })
  await page.emulateMedia({ reducedMotion: "reduce" })
  await seedWorkspace(page, complexGateway.workspaceId)
  await page.goto(complexGateway.entryUrl)

  const sessionCard = page.locator(".session-card", {
    has: page.getByText(COMPLEX_SESSION_NAME, { exact: true }),
  })

  await expect(sessionCard).toBeVisible({ timeout: 30_000 })
  await expect(page.locator(".composer-bar.is-hero")).toBeVisible()

  const prompt = field(page)
  const menuPanel = page.locator(".composer-plates .command-menu")
  const menuList = page.getByRole("listbox", { name: "命令菜单" })
  const composerCard = page.locator(".composer-card")

  await prompt.click()
  await prompt.pressSequentially("/")
  await expect(menuList.getByRole("option", { name: "/clear" })).toBeVisible()
  await expect(menuPanel).not.toHaveAttribute("popover")
  expect(await menuPanel.evaluate((el) => el.matches(":popover-open"))).toBe(false)

  const heroBoxes = await page.evaluate(() => {
    const menu = document.querySelector(".composer-plates .command-menu")?.getBoundingClientRect()
    const card = document.querySelector(".composer-card")?.getBoundingClientRect()
    return menu && card ? { menu, card } : null
  })

  expect(heroBoxes).not.toBeNull()
  expect(heroBoxes!.menu.top).toBeLessThan(heroBoxes!.card.top)
  expect(heroBoxes!.menu.bottom).toBeGreaterThan(heroBoxes!.card.top)
  expect(heroBoxes!.menu.bottom).toBeLessThan(heroBoxes!.card.bottom)

  await sessionCard.click()
  await expect(page).toHaveURL(new RegExp(`/sessions/${COMPLEX_SESSION_ID}$`))
  await expect(page.locator("button.send")).toBeVisible()

  await prompt.click()
  await prompt.pressSequentially("/")
  await expect(menuList.getByRole("option", { name: "/compact" })).toBeVisible()
  await expect(menuPanel).not.toHaveAttribute("popover")
  expect(await menuPanel.evaluate((el) => el.matches(":popover-open"))).toBe(false)

  const idleHit = await page.evaluate(() => {
    const menu = document.querySelector(".composer-plates .command-menu")
    const card = document.querySelector(".composer-card")

    if (!menu || !card) return null
    const menuRect = menu.getBoundingClientRect()
    const cardRect = card.getBoundingClientRect()
    const centerX = cardRect.left + cardRect.width / 2
    const overlapHit = document.elementFromPoint(centerX, cardRect.top + 8)
    const aboveHit = document.elementFromPoint(centerX, cardRect.top - 10)
    return {
      menuBottom: menuRect.bottom,
      cardTop: cardRect.top,
      overlapInsideCard: Boolean(overlapHit && card.contains(overlapHit)),
      overlapInsideMenu: Boolean(overlapHit && menu.contains(overlapHit)),
      aboveInsideMenu: Boolean(aboveHit && menu.contains(aboveHit)),
    }
  })

  expect(idleHit).not.toBeNull()
  expect(idleHit!.menuBottom).toBeGreaterThan(idleHit!.cardTop + 8)
  expect(idleHit!.overlapInsideCard).toBe(true)
  expect(idleHit!.overlapInsideMenu).toBe(false)
  expect(idleHit!.aboveInsideMenu).toBe(true)

  await prompt.press("Escape")
  await expect(menuPanel).toHaveCount(0)
  await prompt.pressSequentially("co")
  await expect(menuPanel).toHaveCount(0)
  await prompt.press("Control+Space")
  await expect(menuList.getByRole("option", { name: "/compact" })).toBeVisible()

  await page.locator(".workbench-header").click()
  await expect(menuPanel).toHaveCount(0)

  await prompt.click()
  await prompt.press("Control+a")
  await prompt.press("Backspace")
  await prompt.pressSequentially("前 后")
  await prompt.press("ArrowLeft")
  await prompt.pressSequentially("@note")
  const noteOption = menuList.getByRole("option", { name: /note\.md/ })
  await expect(noteOption).toBeVisible()
  await noteOption.click()
  await expect(menuPanel).toHaveCount(0)
  await expect(prompt).toBeFocused()
  await expect(prompt.locator("[data-file-mention]")).toHaveCount(1)
  await prompt.press("Control+a")
  expect((await copyFrom(prompt))["composer"]).toBe("前 @note.md 后")
  await prompt.press("Backspace")
  await prompt.pressSequentially("触发状态浮板")
  await prompt.press("Control+Enter")
  const turnStatus = page.getByTestId("turn-status")
  await expect(turnStatus).toBeVisible({ timeout: 30_000 })

  await prompt.click()
  await prompt.pressSequentially("/")
  await expect(menuList.getByRole("option", { name: "/compact" })).toBeVisible()
  await expect(page.locator(".composer-plates.has-menu")).toBeVisible()

  const stackedHit = await page.evaluate(() => {
    const menu = document.querySelector(".composer-plates .command-menu")
    const status = document.querySelector('[data-testid="turn-status"]')
    const card = document.querySelector(".composer-card")

    if (!menu || !status || !card) return null
    const menuRect = menu.getBoundingClientRect()
    const statusRect = status.getBoundingClientRect()
    const cardRect = card.getBoundingClientRect()
    const style = getComputedStyle(status)
    const centerX = cardRect.left + cardRect.width / 2
    const statusTopHit = document.elementFromPoint(centerX, statusRect.top + 6)
    const cardTopHit = document.elementFromPoint(centerX, cardRect.top + 6)
    return {
      radiusTopLeft: style.borderTopLeftRadius,
      radiusTopRight: style.borderTopRightRadius,
      menuBottom: menuRect.bottom,
      statusTop: statusRect.top,
      statusBottom: statusRect.bottom,
      cardTop: cardRect.top,
      statusHitInsideStatus: Boolean(statusTopHit && status.contains(statusTopHit)),
      statusHitInsideMenu: Boolean(statusTopHit && menu.contains(statusTopHit)),
      cardHitInsideCard: Boolean(cardTopHit && card.contains(cardTopHit)),
      cardHitInsideStatus: Boolean(cardTopHit && status.contains(cardTopHit)),
      cardHitInsideMenu: Boolean(cardTopHit && menu.contains(cardTopHit)),
    }
  })

  expect(stackedHit).not.toBeNull()
  expect(stackedHit!.radiusTopLeft).toBe("0px")
  expect(stackedHit!.radiusTopRight).toBe("0px")
  expect(stackedHit!.menuBottom).toBeGreaterThan(stackedHit!.statusTop + 6)
  expect(stackedHit!.statusBottom).toBeGreaterThan(stackedHit!.cardTop + 6)
  expect(stackedHit!.statusHitInsideStatus).toBe(true)
  expect(stackedHit!.statusHitInsideMenu).toBe(false)
  expect(stackedHit!.cardHitInsideCard).toBe(true)
  expect(stackedHit!.cardHitInsideStatus).toBe(false)
  expect(stackedHit!.cardHitInsideMenu).toBe(false)
  await expect(composerCard).toBeVisible()
})
