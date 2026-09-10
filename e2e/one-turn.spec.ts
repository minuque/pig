import { checkpoint } from "./checkpoint.js"
import { expect, test } from "./fixtures.js"
import {
  COMPLEX_MARKER,
  COMPLEX_SESSION_ID,
  COMPLEX_SESSION_NAME,
  TABLE_MARKER,
} from "./prebuild-session.js"
import {
  STOP_TURN,
  TURN_PROMPT,
  TURN_TOKEN,
  installTurnBridge,
  streamingAssistant,
} from "./sim-turn.js"

test("一轮工作：复杂历史上发送、流式、中止", async ({ page, complexGateway }) => {
  test.setTimeout(120_000)
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.addInitScript(
    ({ workspaceId }) => {
      localStorage.setItem("pig.localWorkspaces", JSON.stringify([workspaceId]))
      localStorage.setItem("pig.lastCwd", workspaceId)
      localStorage.setItem("npg-theme", "light")
    },
    { workspaceId: complexGateway.workspaceId },
  )
  const bridge = await installTurnBridge(page)
  await page.goto(complexGateway.origin)

  await expect(page.locator("nav.session-list")).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText("正在连接…")).toHaveCount(0)
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
  await prompt.fill(TURN_PROMPT)
  await expect(send).toBeEnabled()
  await send.click()
  await expect(page.locator(".row-user").getByText(TURN_PROMPT, { exact: true })).toBeVisible()
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
