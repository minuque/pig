import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent"
import type { TurnTiming } from "@pig/protocol"

const TIMING_ENTRY = "pig.turn-timing"

type Outcome = Exclude<TurnTiming["outcome"], "running">

type Turn = { startedAt: number; userTimestamp: number; userId?: string; outcome?: Outcome }

export default function turnTiming(pi: ExtensionAPI) {
  let inputAt: number | undefined
  let turn: Turn | undefined
  const persistStart = (ctx: ExtensionContext) => {
    const current = turn

    if (!current || current.userId) return

    const user = ctx.sessionManager
      .getBranch()
      .reverse()
      .find(
        (entry) =>
          entry.type === "message" &&
          entry.message.role === "user" &&
          entry.message.timestamp === current.userTimestamp,
      )

    if (!user) return
    current.userId = user.id
    pi.appendEntry(TIMING_ENTRY, {
      userId: user.id,
      startedAt: current.startedAt,
      outcome: "running",
    } satisfies TurnTiming)
  }

  pi.on("input", (event) => {
    if (!event.streamingBehavior) inputAt = Date.now()
  })

  pi.on("message_end", (event, ctx) => {
    const { message } = event

    if (message.role === "user" && inputAt !== undefined && !turn) {
      turn = { startedAt: inputAt, userTimestamp: message.timestamp }
      inputAt = undefined
      // 外部：pi 先通知扩展再落盘消息，所以条目 id 要等一拍
      setImmediate(() => persistStart(ctx))
    }

    if (message.role === "assistant" && turn && turn.outcome !== "aborted")
      turn.outcome =
        message.stopReason === "aborted"
          ? "aborted"
          : message.stopReason === "error"
            ? "error"
            : "complete"
  })

  const settle = (ctx: ExtensionContext, outcome: (current: Turn) => Outcome) => {
    inputAt = undefined
    persistStart(ctx)
    const current = turn
    turn = undefined

    if (!current?.userId) return
    pi.appendEntry(TIMING_ENTRY, {
      userId: current.userId,
      startedAt: current.startedAt,
      endedAt: Math.max(current.startedAt, Date.now()),
      outcome: outcome(current),
    } satisfies TurnTiming)
  }

  pi.on("agent_settled", (event, ctx) =>
    settle(ctx, (current) => (event.aborted ? "aborted" : (current.outcome ?? "error"))),
  )
  pi.on("session_shutdown", (_event, ctx) => settle(ctx, () => "aborted"))
}
