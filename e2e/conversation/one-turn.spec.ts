import { checkpoint } from "../support/checkpoint.js"
import { expect, seedWorkspace, test } from "../support/fixtures.js"
import {
  COMPLEX_MARKER,
  COMPLEX_SESSION_ID,
  COMPLEX_SESSION_NAME,
  TABLE_MARKER,
} from "../support/prebuild-session.js"
import {
  STOP_TURN,
  TURN_PROMPT,
  TURN_TOKEN,
  installTurnBridge,
  streamingAssistant,
} from "../support/sim-turn.js"

test("一轮工作：复杂历史上发送、流式、中止", async ({ page, complexGateway }) => {
  test.setTimeout(120_000)
  await seedWorkspace(page, complexGateway.workspaceId)
  const bridge = await installTurnBridge(page)
  await page.goto(complexGateway.entryUrl)

  await expect(page.locator("nav.session-list")).toBeVisible({ timeout: 30_000 })

  const card = page.locator(".session-card", {
    has: page.getByText(COMPLEX_SESSION_NAME, { exact: true }),
  })

  await expect(card).toBeVisible()
  await card.click()
  await expect(page).toHaveURL(new RegExp(`/sessions/${COMPLEX_SESSION_ID}$`))
  await expect(page.getByText(COMPLEX_MARKER, { exact: true })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText(TABLE_MARKER, { exact: true }).first()).toBeVisible()
  await expect(page.locator(".row-tools").first()).toBeVisible()
  await checkpoint(page, "07-complex-history")

  const prompt = page.getByRole("textbox", { name: "Prompt" })
  const send = page.locator("button.send")
  const sentPrompt = page.locator(".row-user").getByText(TURN_PROMPT, { exact: true }).first()

  await prompt.fill(TURN_PROMPT)
  await expect(send).toBeEnabled()
  await send.click()
  await expect(sentPrompt).toBeVisible()

  const layout = await page.evaluate((marker) => {
    const viewport = document.getElementById("transcript-panel")?.getBoundingClientRect()
    const assistants = Array.from(document.querySelectorAll(".row-assistant p"))
    const prev = assistants.filter((el) => el.textContent?.includes("已写入时间线")).at(-1)
    const users = Array.from(document.querySelectorAll(".row-user"))
    const promptNode = users.filter((el) => el.textContent?.includes(marker)).at(-1)

    if (!viewport || !prev || !promptNode) return null
    return {
      viewport,
      prev: prev.getBoundingClientRect(),
      prompt: promptNode.getBoundingClientRect(),
    }
  }, TURN_PROMPT)

  expect(layout).not.toBeNull()
  expect(layout!.prev.bottom).toBeGreaterThan(layout!.viewport.top)
  expect(layout!.prompt.bottom).toBeLessThanOrEqual(layout!.viewport.bottom)

  const status = page.locator('[data-testid="turn-status"]')

  await expect(status).toBeVisible()

  const sessionId = await bridge.waitForPrompt()
  const snapshot = bridge.snapshots.get(sessionId)

  if (!snapshot) throw new Error("一轮工作缺少 SessionSnapshot")
  bridge.send({
    type: "event",
    event: {
      type: "session_progress",
      sessionId,
      progress: { type: "item_started", item: streamingAssistant(snapshot, TURN_TOKEN) },
    },
  })
  await expect(page.getByText(TURN_TOKEN, { exact: true })).toBeVisible()
  const stop = page.getByRole("button", { name: STOP_TURN, exact: true })
  await expect(stop).toBeVisible()
  await checkpoint(page, "08-turn-streaming")

  await stop.click()
  await expect(stop).toHaveCount(0)
  await expect(send).toBeVisible()
  await expect(page.getByText(COMPLEX_MARKER, { exact: true })).toBeVisible()
  await checkpoint(page, "09-turn-aborted")
})
