import { expect, seedWorkspace, test } from "../support/fixtures.js"
import { STOP_TURN, installTurnBridge } from "../support/sim-turn.js"

test("分屏：在右侧打开会话，两侧各自发送，关闭右侧", async ({ page, navGateway }) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 1680, height: 900 })
  await seedWorkspace(page, navGateway.workspaceId)
  await installTurnBridge(page)
  await page.goto(navGateway.entryUrl)

  const cards = page.locator(".session-card")
  await expect(cards.nth(1)).toBeVisible({ timeout: 30_000 })
  const leftHref = (await cards.nth(0).getAttribute("href"))!
  const rightHref = (await cards.nth(1).getAttribute("href"))!

  await cards.nth(0).click()
  await expect(page).toHaveURL(new RegExp(`${leftHref}$`))

  await cards.nth(1).click({ button: "right" })
  await page.getByRole("menuitem", { name: "在右侧打开" }).click()

  const left = page.locator('.workbench-pane[data-side="left"]')
  const right = page.locator('.workbench-pane[data-side="right"]')
  await expect(right).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`${rightHref}$`))

  const leftBox = (await left.boundingBox())!
  const rightBox = (await right.boundingBox())!
  expect(leftBox.x + leftBox.width).toBeLessThanOrEqual(rightBox.x + 1)

  for (const [pane, text] of [
    [left, "左侧的消息"],
    [right, "右侧的消息"],
  ] as const) {
    await pane.getByRole("textbox", { name: "Prompt" }).fill(text)
    await pane.locator("button.send").click()
    await expect(pane.locator(".row-user").getByText(text, { exact: true })).toBeVisible()
  }

  await expect(left.locator(".row-user").getByText("右侧的消息", { exact: true })).toHaveCount(0)
  await expect(right.locator(".row-user").getByText("左侧的消息", { exact: true })).toHaveCount(0)

  await right.getByRole("button", { name: "关闭这一侧" }).click()
  await expect(right).toHaveCount(0)
  await expect(page).toHaveURL(new RegExp(`${leftHref}$`))
})

test("分屏：删除另一侧开着的空闲会话，那一侧回到新会话页", async ({ page, navGateway }) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 1680, height: 900 })
  await seedWorkspace(page, navGateway.workspaceId)
  await installTurnBridge(page)
  await page.goto(navGateway.entryUrl)

  const cards = page.locator(".session-card")
  await expect(cards.nth(1)).toBeVisible({ timeout: 30_000 })
  const leftHref = (await cards.nth(0).getAttribute("href"))!
  const rightHref = (await cards.nth(1).getAttribute("href"))!

  await cards.nth(0).click()
  await expect(page).toHaveURL(new RegExp(`${leftHref}$`))
  await cards.nth(1).click({ button: "right" })
  await page.getByRole("menuitem", { name: "在右侧打开" }).click()

  const left = page.locator('.workbench-pane[data-side="left"]')
  const right = page.locator('.workbench-pane[data-side="right"]')

  await right.getByRole("textbox", { name: "Prompt" }).fill("右侧的消息")
  await right.locator("button.send").click()
  const stop = right.getByRole("button", { name: STOP_TURN, exact: true })
  await stop.click()
  await expect(stop).toHaveCount(0)

  await left.getByRole("textbox", { name: "Prompt" }).click()
  await expect(page).toHaveURL(new RegExp(`${leftHref}$`))
  const target = page.locator(`.session-card[href="${rightHref}"]`)
  await target.click({ button: "right" })
  await page.getByRole("menuitem", { name: "删除会话" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "删除会话" }).click()

  await expect(target).toHaveCount(0)
  await expect(right.locator("h1.hero-title")).toBeVisible()
  await expect(page.getByText("会话仍在运行，请先停止再删除。")).toHaveCount(0)
  await expect(page).toHaveURL(new RegExp(`${leftHref}$`))
})
