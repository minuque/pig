import type { TranscriptItem } from "@pig/protocol"
import { expect, seedWorkspace, test } from "./fixtures.js"
import { COMPLEX_SESSION_ID, COMPLEX_SESSION_NAME } from "./prebuild-session.js"

const TURNS = 8
const PREVIEW = "输出开头"
const FULL = `${PREVIEW}……完整输出的结尾`

/** 八轮问答，最后一轮带一条被截断的工具输出。 */
function history(): TranscriptItem[] {
  const items: TranscriptItem[] = []

  for (let turn = 1; turn <= TURNS; turn += 1) {
    items.push({
      id: `u${turn}`,
      role: "user",
      content: [{ type: "text", text: `第 ${turn} 个问题` }],
      timestamp: turn * 10,
    })
    items.push({
      id: `a${turn}`,
      role: "assistant",
      content: [
        { type: "text", text: `第 ${turn} 个回答` },
        ...(turn === TURNS
          ? [
              {
                type: "toolCall" as const,
                toolCallId: "big",
                toolName: "bash",
                input: { command: "ls" },
              },
            ]
          : []),
      ],
      model: { provider: "test", id: "model" },
      timestamp: turn * 10 + 1,
      status: "complete",
      stopReason: turn === TURNS ? "toolUse" : "stop",
    })
  }

  items.push({
    id: "big",
    role: "tool",
    toolCallId: "big",
    toolName: "bash",
    input: { command: "ls" },
    content: [{ type: "text", text: PREVIEW }],
    timestamp: TURNS * 10 + 2,
    status: "complete",
    isError: false,
    truncated: true,
  })
  return items
}

test("打开会话一次显示全部历史；展开被截断的工具输出时取回完整内容", async ({
  page,
  complexGateway,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await seedWorkspace(page, complexGateway.workspaceId)
  const fetched: string[] = []

  await page.route("**/api/v1/platform/transcript/item**", (route) => {
    const id = new URL(route.request().url()).searchParams.get("id") ?? ""
    fetched.push(id)
    const item = { ...history().at(-1), content: [{ type: "text", text: FULL }], truncated: false }
    return route.fulfill({ contentType: "application/json", body: JSON.stringify({ item }) })
  })
  await page.route("**/api/v1/platform/transcript?**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ items: history(), timings: [], hasMore: false }),
    }),
  )

  await page.goto(complexGateway.entryUrl)
  await expect(page.locator("nav.session-list")).toBeVisible({ timeout: 30_000 })
  await page
    .locator(".session-card", { has: page.getByText(COMPLEX_SESSION_NAME, { exact: true }) })
    .click()
  await expect(page).toHaveURL(new RegExp(`/sessions/${COMPLEX_SESSION_ID}$`))
  await expect(page.getByText(`第 ${TURNS} 个回答`, { exact: true })).toBeVisible({
    timeout: 30_000,
  })
  await expect(page.getByText("第 1 个问题", { exact: true })).toBeAttached()
  await expect(page.locator(".older-button")).toHaveCount(0)
  expect(fetched).toEqual([])

  await page.locator(".row-tools .tool-run-summary").last().click()
  await page.locator(".tool-row-trigger").last().click()
  await expect(page.getByText(FULL)).toBeVisible()
  expect(fetched).toEqual(["big"])
})
