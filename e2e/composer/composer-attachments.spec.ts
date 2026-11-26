import { dragOntoPanel as drag, expect, seedWorkspace, test } from "../support/fixtures.js"
import { COMPLEX_SESSION_ID, COMPLEX_SESSION_NAME } from "../support/prebuild-session.js"
import { installTurnBridge } from "../support/sim-turn.js"

test("附件随 Prompt 发送：逐个 stage 后由 WS prompt 带 batch 提交", async ({
  page,
  complexGateway,
}) => {
  test.setTimeout(120_000)
  await seedWorkspace(page, complexGateway.workspaceId)
  const bridge = await installTurnBridge(page)

  await page.goto(complexGateway.entryUrl)

  const card = page.locator(".session-card", {
    has: page.getByText(COMPLEX_SESSION_NAME, { exact: true }),
  })

  await expect(card).toBeVisible({ timeout: 30_000 })
  await card.click()
  await expect(page).toHaveURL(new RegExp(`/sessions/${COMPLEX_SESSION_ID}$`))
  await drag(page, "drop")
  await expect(page.locator(".attach-tray .chip")).toHaveCount(2)

  const staged = page.waitForResponse((response) => response.url().includes("/attachments/stage"))

  await page.getByRole("textbox", { name: "Prompt" }).fill("附件一轮")
  await page.locator("button.send").click()

  const stage = await staged
  const batch = new URL(stage.url()).searchParams.get("batch")

  expect(stage.status()).toBe(200)
  expect(stage.url()).toContain("name=note.md")
  await expect.poll(() => bridge.promptBatches.length).toBe(1)
  expect(bridge.promptBatches).toEqual([batch])
  await expect(
    page.locator(".row-user").getByText("附件一轮", { exact: true }).first(),
  ).toBeVisible()
  await expect(page.locator(".attach-tray")).toHaveCount(0)
})

test("发送中被中止：不再发 prompt，丢弃批次且保留 chips", async ({ page, complexGateway }) => {
  test.setTimeout(120_000)
  await seedWorkspace(page, complexGateway.workspaceId)
  const bridge = await installTurnBridge(page)
  let releaseStage = () => {}
  const stageGate = new Promise<void>((resolve) => {
    releaseStage = resolve
  })

  await page.route(/\/attachments\/stage/, async (route) => {
    await stageGate
    await route.continue()
  })
  await page.goto(complexGateway.entryUrl)

  const card = page.locator(".session-card", {
    has: page.getByText(COMPLEX_SESSION_NAME, { exact: true }),
  })

  await expect(card).toBeVisible({ timeout: 30_000 })
  await card.click()
  await expect(page).toHaveURL(new RegExp(`/sessions/${COMPLEX_SESSION_ID}$`))
  await drag(page, "drop")
  await expect(page.locator(".attach-tray .chip")).toHaveCount(2)

  const staged = page.waitForRequest((request) => request.url().includes("/attachments/stage"))
  const discarded = page.waitForResponse((response) =>
    response.url().includes("/attachments/discard"),
  )

  await page.getByRole("textbox", { name: "Prompt" }).fill("会被中止的一轮")
  await page.locator("button.send").click()
  const stageRequest = await staged

  await page.keyboard.press("Escape")
  releaseStage()

  const discard = await discarded
  const batch = new URL(stageRequest.url()).searchParams.get("batch")

  expect(discard.status()).toBe(200)
  expect(discard.request().postDataJSON()).toEqual({ batch })
  expect(bridge.promptBatches).toEqual([])
  await expect(page.locator(".attach-tray .chip")).toHaveCount(2)
})

test("单个附件上传失败：报错可重试，其他附件与草稿保留", async ({ page, complexGateway }) => {
  test.setTimeout(120_000)
  await seedWorkspace(page, complexGateway.workspaceId)
  const bridge = await installTurnBridge(page)
  let failOnce = true

  await page.route(/\/attachments\/stage/, async (route) => {
    const name = new URL(route.request().url()).searchParams.get("name")

    if (name === "note.md" && failOnce) {
      failOnce = false
      await route.fulfill({ status: 500, json: { code: "SERVER_ERROR" } })
      return
    }

    await route.continue()
  })
  await page.goto(complexGateway.entryUrl)

  const card = page.locator(".session-card", {
    has: page.getByText(COMPLEX_SESSION_NAME, { exact: true }),
  })

  await expect(card).toBeVisible({ timeout: 30_000 })
  await card.click()
  await expect(page).toHaveURL(new RegExp(`/sessions/${COMPLEX_SESSION_ID}$`))
  await drag(page, "drop")
  await expect(page.locator(".attach-tray .chip")).toHaveCount(2)

  const prompt = page.getByRole("textbox", { name: "Prompt" })
  const note = page.locator(".attach-tray .chip", { hasText: "note.md" })
  const failed = page.waitForResponse(
    (response) => response.url().includes("/attachments/stage") && response.status() === 500,
  )

  await prompt.fill("上传失败的一轮")
  await page.locator("button.send").click()
  await failed

  await expect(note).toHaveAttribute("data-status", "error")
  await expect(note.getByRole("button", { name: "重试" })).toBeVisible()
  await expect(page.locator(".attach-tray .chip")).toHaveCount(2)
  await expect(page.getByRole("button", { name: "移除 shot.png" })).toBeVisible()
  await expect(prompt).toHaveText("上传失败的一轮")
  expect(bridge.promptBatches).toEqual([])

  const retried = page.waitForResponse(
    (response) => response.url().includes("/attachments/stage") && response.status() === 200,
  )

  await note.getByRole("button", { name: "重试" }).click()
  await retried
  await expect(note).toHaveAttribute("data-status", "ready")
  await expect(note.getByRole("button", { name: "重试" })).toHaveCount(0)

  const staged = page.waitForRequest((request) => request.url().includes("/attachments/stage"))

  await page.locator("button.send").click()

  const stage = await staged
  const batch = new URL(stage.url()).searchParams.get("batch")

  await expect.poll(() => bridge.promptBatches.length).toBe(1)
  expect(bridge.promptBatches).toEqual([batch])
  await expect(
    page.locator(".row-user").getByText("上传失败的一轮", { exact: true }).first(),
  ).toBeVisible()
  await expect(page.locator(".attach-tray")).toHaveCount(0)
})
