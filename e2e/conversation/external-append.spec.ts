import { join } from "node:path"
import { SessionManager } from "@earendil-works/pi-coding-agent"
import {
  expect,
  seedWorkspace,
  test as base,
  withGateway,
  type ExternalTurnGateway,
} from "../support/fixtures.js"
import { FAUX_MODEL, createReplyRuntime, fauxReply } from "../support/faux-runtime.js"
import {
  APPEND_EXTERNAL_REPLY,
  APPEND_SESSION_ID,
  APPEND_SESSION_NAME,
  appendExternalTurn,
  prebuildAppendSession,
} from "../support/prebuild-session.js"

const NOTICE = "会话在别处有更新，已刷新"
const FIRST = "e2e pig 的第一句"
const SECOND = "e2e pig 的第二句"
/** 真实网关 + 替身供应商：pig 的回合真的经过 pi 写进会话文件。 */
const test = base.extend<{ appendGateway: ExternalTurnGateway }>({
  appendGateway: [
    async ({}, use) => {
      let sessionFile = ""

      await withGateway(
        (sessionDir, workspaceDir) => {
          sessionFile = prebuildAppendSession(sessionDir, workspaceDir, FAUX_MODEL)
        },
        (gateway) => use({ ...gateway, sessionFile }),
        undefined,
        async (temp) => ({ createRuntime: () => createReplyRuntime(join(temp, "agent")) }),
      )
    },
    { scope: "test" },
  ],
})

test("pig 持有会话时被外部追加：提示、显示外部那一轮、草稿还在；再发接在它之后", async ({
  page,
  appendGateway,
}) => {
  test.setTimeout(120_000)
  await page.emulateMedia({ reducedMotion: "reduce" })
  await seedWorkspace(page, appendGateway.workspaceId)
  await page.goto(appendGateway.entryUrl)
  await page
    .locator(".session-card", { has: page.getByText(APPEND_SESSION_NAME, { exact: true }) })
    .click()
  await expect(page).toHaveURL(new RegExp(`/sessions/${APPEND_SESSION_ID}$`))

  const prompt = page.getByRole("textbox", { name: "Prompt" })
  const send = page.locator("button.send")

  await prompt.fill(FIRST)
  await send.click()
  await expect(page.getByText(fauxReply(1), { exact: true })).toBeVisible({ timeout: 30_000 })

  const externalReplyId = appendExternalTurn(appendGateway.sessionFile, FAUX_MODEL)

  await prompt.fill(SECOND)
  await expect(send).toBeEnabled()
  await send.click()
  await expect(page.getByText(NOTICE)).toBeVisible()
  await expect(page.getByText(APPEND_EXTERNAL_REPLY, { exact: true })).toBeVisible()
  await expect(prompt).toHaveText(SECOND)

  await send.click()
  await expect(page.getByText(fauxReply(2), { exact: true })).toBeVisible({ timeout: 30_000 })

  const resent = SessionManager.open(appendGateway.sessionFile)
    .getEntries()
    .find(
      (entry) =>
        entry.type === "message" &&
        entry.message.role === "user" &&
        JSON.stringify(entry.message.content).includes(SECOND),
    )

  expect(resent?.parentId).toBe(externalReplyId)
})
