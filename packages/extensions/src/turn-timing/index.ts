import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent"
import { TURN_TIMING_ENTRY as TIMING_ENTRY, type TurnTiming } from "@pig/protocol"

type Outcome = Exclude<TurnTiming["outcome"], "running">

type Turn = { startedAt: number; userTimestamp: number; userId?: string; outcome?: Outcome }

/** 回合计时：从收到用户输入到回合完全结束，先写一条 running，结束再写终态。 */
export default function turnTiming(pi: ExtensionAPI) {
  let inputAt: number | undefined
  let turn: Turn | undefined
  /** 用户消息落盘后才有条目 id；找到就写 running。 */
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
    // 运行中的 steer 与 followUp 并进当前回合
    if (!event.streamingBehavior) inputAt = Date.now()
  })

  pi.on("message_end", (event, ctx) => {
    const { message } = event

    if (message.role === "user" && inputAt !== undefined && !turn) {
      turn = { startedAt: inputAt, userTimestamp: message.timestamp }
      inputAt = undefined
      // pi 先通知扩展再落盘这条消息
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

  // 没等到助手消息就结束，是 prompt 在模型应答前抛了错
  pi.on("agent_settled", (event, ctx) =>
    settle(ctx, (current) => (event.aborted ? "aborted" : (current.outcome ?? "error"))),
  )
  // 回合中途关会话：dispose 会中止回合并让 ctx 失效，之后的 agent_settled 写不进去
  pi.on("session_shutdown", (_event, ctx) => settle(ctx, () => "aborted"))
}
