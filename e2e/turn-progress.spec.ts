import type {
  AssistantTranscriptItem,
  SessionSnapshot,
  TranscriptItem,
  TranscriptProgress,
} from "@earendil-works/pi-protocol"
import { expect, test } from "./fixtures.js"
import { COMPLEX_SESSION_ID, COMPLEX_SESSION_NAME } from "./prebuild-session.js"
import { installTurnBridge } from "./sim-turn.js"

const PROMPT = "回归验证轮次"
const TEXT_A = "先读文件"
const TEXT_B = "两个工具都完成了"
const HISTORY: TranscriptItem[] = [
  { id: "h-u1", role: "user", content: [{ type: "text", text: "旧问" }], timestamp: 1 },
  {
    id: "h-a1",
    role: "assistant",
    content: [{ type: "text", text: "旧答" }],
    model: { provider: "test", id: "model" },
    timestamp: 2,
    status: "complete",
    stopReason: "stop",
  },
] as TranscriptItem[]

function textBlock(text: string) {
  return { type: "text" as const, text }
}

function toolCallBlock(id: string) {
  return {
    type: "toolCall" as const,
    toolCallId: id,
    toolName: "read",
    input: { path: `${id}.ts` },
  }
}

function assistant(
  snapshot: SessionSnapshot,
  id: string,
  content: AssistantTranscriptItem["content"],
  status: "streaming" | "complete" = "streaming",
): AssistantTranscriptItem {
  const base = { id, role: "assistant" as const, content, model: snapshot.model, timestamp: 10 }
  return status === "streaming" ? { ...base, status } : { ...base, status, stopReason: "stop" }
}

function tool(id: string, status: "running" | "complete"): TranscriptItem {
  return {
    id,
    role: "tool",
    toolCallId: id,
    toolName: "read",
    input: { path: `${id}.ts` },
    content: status === "complete" ? [textBlock("输出")] : [],
    timestamp: 11,
    status,
    isError: false,
  } as TranscriptItem
}

test("一轮工作：工具步骤状态实时、hook-rail 跟随、历史重拉不重复", async ({
  page,
  complexGateway,
}) => {
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
  // 历史页可控：先只给旧回合，回合结束后再把同一条落盘内容喂回来
  let persisted: TranscriptItem[] = HISTORY
  await page.route("**/api/v1/platform/transcript**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ items: persisted, timings: [], hasMore: false }),
    }),
  )
  const bridge = await installTurnBridge(page)
  await page.goto(complexGateway.origin)
  await expect(page.locator("nav.session-list")).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText("正在连接…")).toHaveCount(0)
  await page
    .locator(".session-card", { has: page.getByText(COMPLEX_SESSION_NAME, { exact: true }) })
    .click()
  await expect(page).toHaveURL(new RegExp(`/sessions/${COMPLEX_SESSION_ID}$`))
  await expect(page.getByText("旧答", { exact: true })).toBeVisible({ timeout: 30_000 })

  const prompt = page.getByRole("textbox", { name: "Prompt" })
  await prompt.fill(PROMPT)
  await page.locator("button.send").click()
  const sessionId = await bridge.waitForPrompt()
  const snapshot = bridge.snapshots.get(sessionId)

  if (!snapshot) throw new Error("缺少 SessionSnapshot")

  const emit = (progress: TranscriptProgress) =>
    bridge.send({ type: "event", event: { type: "session_progress", sessionId, progress } })
  // 协议把 item_finished 的条目收窄成终态，夹具只保证形状
  const emitFinished = (item: TranscriptItem) =>
    emit({ type: "item_finished", item } as TranscriptProgress)
  // 生产形状：条目落盘后广播的快照不带全文，只推进 revision
  const emitSnapshot = () =>
    bridge.send({
      type: "event",
      event: {
        type: "session_snapshot",
        snapshot: { ...snapshot, revision: snapshot.revision + 1, transcript: [] },
      },
    })
  const stepOf = (file: string) => page.locator(".row-tools .step").filter({ hasText: file })

  // 助手发起 t1，t1 开始执行
  emit({
    type: "item_started",
    item: assistant(snapshot, "m2", [textBlock(TEXT_A), toolCallBlock("t1")]),
  })
  emit({ type: "item_started", item: tool("t1", "running") })
  await expect(stepOf("t1.ts").locator(".tool-summary")).toHaveClass(/running/)

  // t1 完成到界面收敛
  const finishedAt = Date.now()
  emitFinished(tool("t1", "complete"))
  await expect(stepOf("t1.ts").locator(".tool-summary")).not.toHaveClass(/running/)
  const toolSettleMs = Date.now() - finishedAt

  // 助手发起 t2，t2 开始执行；hook-rail 应跟到最新 running 步骤
  emit({
    type: "item_updated",
    item: assistant(snapshot, "m2", [textBlock(TEXT_A), toolCallBlock("t1"), toolCallBlock("t2")]),
  })
  emit({ type: "item_started", item: tool("t2", "running") })
  await expect(stepOf("t2.ts").locator(".tool-summary")).toHaveClass(/running/)
  await expect(stepOf("t2.ts")).toHaveAttribute("data-active", "true")

  const railCornerY = await page
    .locator(".hook-rail.accent .hook-corner")
    .evaluate((el) => el.getBoundingClientRect().top + el.getBoundingClientRect().height / 2)
  const stepCenterY = await stepOf("t2.ts")
    .locator(".summary")
    .evaluate((el) => el.getBoundingClientRect().top + el.getBoundingClientRect().height / 2)
  const railGap = Math.abs(railCornerY - stepCenterY)

  // 收尾：同一帧里先到工具完成、再到空快照，界面不得回退到旧状态
  emitFinished(tool("t2", "complete"))
  emitFinished(
    assistant(
      snapshot,
      "m2",
      [textBlock(TEXT_A), toolCallBlock("t1"), toolCallBlock("t2")],
      "complete",
    ),
  )
  emitSnapshot()
  emit({ type: "item_started", item: assistant(snapshot, "m3", [textBlock(TEXT_B)]) })
  emitSnapshot()
  emitFinished(assistant(snapshot, "m3", [textBlock(TEXT_B)], "complete"))

  await expect(page.getByText(TEXT_B, { exact: true })).toBeVisible()
  await expect(stepOf("t2.ts").locator(".tool-summary")).not.toHaveClass(/running/)

  // 历史页重拉带回已落盘的同一条回合，消息不得重复
  persisted = [
    ...HISTORY,
    { id: "u-new", role: "user", content: [textBlock(PROMPT)], timestamp: 10 },
    assistant(
      snapshot,
      "p-a1",
      [textBlock(TEXT_A), toolCallBlock("t1"), toolCallBlock("t2")],
      "complete",
    ),
    tool("t1", "complete"),
    tool("t2", "complete"),
    assistant(snapshot, "p-a2", [textBlock(TEXT_B)], "complete"),
  ]
  emitSnapshot()
  await expect(page.locator(".row-user", { hasText: PROMPT })).toHaveCount(1)
  await expect(page.locator(".row-assistant", { hasText: TEXT_B })).toHaveCount(1)
  await expect(stepOf("t1.ts")).toHaveCount(1)
  await expect(stepOf("t2.ts")).toHaveCount(1)

  expect(toolSettleMs).toBeLessThan(500)
  expect(railGap).toBeLessThan(24)
})
