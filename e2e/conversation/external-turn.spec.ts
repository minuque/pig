import type { Page } from "@playwright/test"
import { expect, seedWorkspace, test, type ExternalTurnGateway } from "../support/fixtures.js"
import {
  EXTERNAL_PENDING_PROMPT,
  EXTERNAL_REPLY,
  EXTERNAL_SESSION_ID,
  EXTERNAL_SESSION_NAME,
  appendExternalReply,
} from "../support/prebuild-session.js"
import { TURN_PROMPT, TURN_STREAM_ID, installTurnBridge } from "../support/sim-turn.js"

const NOTICE = "这个会话正在别处运行，回合结束后可以继续输入。"
const DRAFT = "e2e 草稿不能丢"
const DONE = "e2e 接管后的回答"
const FOLLOW = { timeout: 10_000 }

async function openExternalSession(page: Page, gateway: ExternalTurnGateway) {
  await seedWorkspace(page, gateway.workspaceId)
}

async function openCard(page: Page, gateway: ExternalTurnGateway) {
  await page.goto(gateway.entryUrl)
  await expect(page.locator("nav.session-list")).toBeVisible({ timeout: 30_000 })
  await page
    .locator(".session-card", { has: page.getByText(EXTERNAL_SESSION_NAME, { exact: true }) })
    .click()
  await expect(page).toHaveURL(new RegExp(`/sessions/${EXTERNAL_SESSION_ID}$`))
  await expect(page.getByText(EXTERNAL_PENDING_PROMPT, { exact: true })).toBeVisible({
    timeout: 30_000,
  })
}

test("外部写入收尾后：新消息跟随出现，说明消失，发送恢复", async ({
  page,
  externalTurnGateway,
}) => {
  await openExternalSession(page, externalTurnGateway)
  await openCard(page, externalTurnGateway)

  const prompt = page.getByRole("textbox", { name: "Prompt" })
  const send = page.locator("button.send")

  await prompt.fill(DRAFT)
  await expect(page.getByText(NOTICE)).toBeVisible()
  await expect(send).toBeDisabled()

  appendExternalReply(externalTurnGateway.sessionFile)

  await expect(page.getByText(EXTERNAL_REPLY, { exact: true })).toBeVisible(FOLLOW)
  await expect(page.getByText(NOTICE)).toHaveCount(0)
  await expect(send).toBeEnabled()
  await expect(prompt).toHaveText(DRAFT)
})

test("接管：确认后说明消失，发一条消息能跑完一个回合", async ({ page, externalTurnGateway }) => {
  test.setTimeout(120_000)
  await openExternalSession(page, externalTurnGateway)
  const bridge = await installTurnBridge(page)

  await openCard(page, externalTurnGateway)
  await page.getByRole("button", { name: "接管", exact: true }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "接管", exact: true }).click()
  await expect(page.getByText(NOTICE)).toHaveCount(0)

  const prompt = page.getByRole("textbox", { name: "Prompt" })
  const send = page.locator("button.send")

  await prompt.fill(TURN_PROMPT)
  await expect(send).toBeEnabled()
  await send.click()

  const sessionId = await bridge.waitForPrompt()
  const snapshot = bridge.snapshots.get(sessionId)

  if (!snapshot) throw new Error("接管后缺少 SessionSnapshot")
  bridge.send({
    type: "event",
    event: {
      type: "session_progress",
      sessionId,
      progress: {
        type: "item_finished",
        item: {
          id: TURN_STREAM_ID,
          role: "assistant",
          content: [{ type: "text", text: DONE }],
          model: snapshot.model,
          timestamp: Date.now(),
          status: "complete",
          stopReason: "stop",
        },
      },
    },
  })
  bridge.send({
    type: "event",
    event: {
      type: "session_snapshot",
      snapshot: { ...snapshot, phase: "idle", revision: snapshot.revision + 2 },
    },
  })
  await expect(page.getByText(DONE, { exact: true })).toBeVisible()
  await expect(page.getByText(NOTICE)).toHaveCount(0)
})
