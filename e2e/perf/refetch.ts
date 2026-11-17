/** 4.1：真实网关 + 真实界面跑一个替身回合，数整回合里历史接口被重拉几次、多少字节。 */
import { SessionManager } from "@earendil-works/pi-coding-agent"
import { expect, type Page, type Response } from "@playwright/test"
import type { ServerMessage } from "@pig/protocol"

import { FAUX_MODEL, writeFauxNotes, type FauxScript } from "../support/faux-runtime.js"
import type { BenchSession } from "./harness.js"
import { WORKBENCH_TIMEOUT_MS, composerInput, waitForWorkbench } from "./measure.js"
import { LONG_SESSION_NAME, sessionIdOf, sessionPrompt, sessionTurns } from "./seed.js"

const TRANSCRIPT_PATH = "/api/v1/platform/transcript"
/** 回合结束后界面可能还在补拉；这么久没有新请求就算收尾。 */
const QUIET_MS = 500

/** 每轮从长会话种子分叉一份，不改动其他场景用的种子。 */
function forkLongSession(sessionDir: string, workspaceDir: string, round: number) {
  const source = SessionManager.findById(workspaceDir, sessionIdOf(LONG_SESSION_NAME), sessionDir)

  if (!source) throw new Error("找不到长会话种子")

  const fork = SessionManager.forkFrom(source, workspaceDir, sessionDir, {
    id: `bench-refetch-${round}`,
  })

  fork.appendModelChange(FAUX_MODEL.provider, FAUX_MODEL.id)
  const id = fork.getSessionId()

  if (!SessionManager.findById(workspaceDir, id, sessionDir)) throw new Error("分叉会话未落盘")
  return id
}

/** 等收到本会话进入回合、再回到空闲的快照。 */
function watchTurn(page: Page, sessionId: string) {
  let running = false
  let finish: () => void = () => undefined
  const done = new Promise<void>((resolve) => (finish = resolve))

  page.on("websocket", (socket) =>
    socket.on("framereceived", ({ payload }) => {
      const message = JSON.parse(String(payload)) as ServerMessage

      if (message.type !== "event" || message.event.type !== "session_snapshot") return
      const { snapshot } = message.event

      if (snapshot.id !== sessionId) return

      if (snapshot.phase === "turn") running = true
      else if (running && snapshot.phase === "idle") finish()
    }),
  )
  return done
}

async function quiet(inflight: Set<Promise<void>>, lastAt: () => number) {
  for (;;) {
    await Promise.all(inflight)
    const wait = lastAt() + QUIET_MS - performance.now()

    if (wait <= 0 && inflight.size === 0) return
    await new Promise((resolve) => setTimeout(resolve, Math.max(wait, 16)))
  }
}

export type RefetchContext = {
  sessionDir: string
  workspaceDir: string
  script: FauxScript
  /** 把替身供应商挂进网关的 runtime。 */
  install(): void
}

/** 挂供应商、补剧本要读的文件；放到界面场景之后，免得模型列表与文件树影响前面的数。 */
export function prepareRefetch(context: RefetchContext) {
  context.install()
  return writeFauxNotes(context.workspaceDir)
}

export async function measureRefetch(
  session: BenchSession,
  context: RefetchContext,
  round: number,
) {
  const { page } = session
  const sessionId = forkLongSession(context.sessionDir, context.workspaceDir, round)
  const turnEnded = watchTurn(page, sessionId)
  const inflight = new Set<Promise<void>>()
  let counting = false
  let count = 0
  let bytes = 0
  let lastAt = 0
  const onResponse = (response: Response) => {
    const url = new URL(response.url())

    if (!counting || url.pathname !== TRANSCRIPT_PATH) return

    if (url.searchParams.get("sessionId") !== sessionId) return
    count += 1
    lastAt = performance.now()

    const body = response.body().then((buffer) => {
      bytes += buffer.byteLength
      lastAt = performance.now()
    })

    inflight.add(body)
    // 失败留给 quiet 里的 Promise.all 抛出；这里只负责移出集合
    void body.then(
      () => inflight.delete(body),
      () => inflight.delete(body),
    )
  }

  page.on("response", onResponse)

  await page.goto(session.origin)
  await waitForWorkbench(page)
  await page.goto(new URL(`/sessions/${sessionId}`, session.origin).href)
  await expect(
    page.getByText(sessionPrompt(LONG_SESSION_NAME, sessionTurns(LONG_SESSION_NAME)), {
      exact: true,
    }),
  ).toBeVisible({ timeout: WORKBENCH_TIMEOUT_MS })

  const send = page.locator("button.send")
  await composerInput(page).fill("读笔记")
  await expect(send).toBeEnabled()
  context.script.queue(1)
  counting = true
  lastAt = performance.now()
  await send.click()
  let timer: NodeJS.Timeout | undefined

  try {
    await Promise.race([
      turnEnded,
      new Promise((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error("重拉场景的回合没有结束")), WORKBENCH_TIMEOUT_MS)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }

  try {
    await quiet(inflight, () => lastAt)
  } finally {
    // 关页前摘掉：之后的补拉不计入，也不会在页面关闭后读响应体
    page.off("response", onResponse)
  }

  return { count, bytes }
}
