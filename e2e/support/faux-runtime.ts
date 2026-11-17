/** 基准用的 pi-ai 替身供应商：每回合读两次工作区文件，再按每秒 100 token 吐 400 token。 */
import { ModelRuntime } from "@earendil-works/pi-coding-agent"
import { writeFile } from "node:fs/promises"
import { join } from "node:path"

import {
  fauxAssistantMessage,
  fauxProvider,
  fauxText,
  fauxToolCall,
  type FauxResponseFactory,
} from "../../packages/gateway/node_modules/@earendil-works/pi-ai/dist/providers/faux.js"

export const FAUX_MODEL = { provider: "faux", id: "faux-1" } as const
/** 剧本里工具读的文件，调用方要先写进会话的工作目录。 */
const FAUX_READ_FILE = "notes.md"
const TOOL_ROUNDS = 2
const REPLY_TOKENS = 400
const TOKENS_PER_SECOND = 100
/** 替身按 4 字符一 token 计；每块 4 token，即每 40ms 一块。 */
const CHUNK_TOKENS = 4
const REPLY = "并行会话基准的回复正文。".repeat(REPLY_TOKENS).slice(0, REPLY_TOKENS * 4)
/** 按本回合已有的工具结果数决定下一步，多个会话并发取同一队列也不会串。 */
const step: FauxResponseFactory = (context) => {
  const roles = context.messages.map((message) => message.role)
  const done = roles.slice(roles.lastIndexOf("user") + 1).filter((role) => role === "toolResult")

  if (done.length < TOOL_ROUNDS)
    return fauxAssistantMessage(fauxToolCall("read", { path: FAUX_READ_FILE }), {
      stopReason: "toolUse",
    })
  return fauxAssistantMessage(fauxText(REPLY))
}

export type FauxScript = {
  provider: ReturnType<typeof fauxProvider>["provider"]
  /** 替身的应答队列是全局 FIFO：每次发 prompt 前按回合数补足步数。 */
  queue(turns: number): void
}

export function createFauxScript(): FauxScript {
  const faux = fauxProvider({
    api: "faux",
    provider: FAUX_MODEL.provider,
    models: [{ id: FAUX_MODEL.id, name: "Bench Faux" }],
    tokensPerSecond: TOKENS_PER_SECOND,
    // 固定块大小，流速与帧数每次一致
    tokenSize: { min: CHUNK_TOKENS, max: CHUNK_TOKENS },
  })
  return {
    provider: faux.provider,
    queue: (turns) =>
      faux.appendResponses(Array.from({ length: turns * (TOOL_ROUNDS + 1) }, () => step)),
  }
}

export function writeFauxNotes(workspaceDir: string) {
  return writeFile(
    join(workspaceDir, FAUX_READ_FILE),
    "# 基准笔记\n\n替身模型的工具会读这个文件。\n",
  )
}

/** 替身第 n 次回答的正文；e2e 用它认出哪一轮跑完了。 */
export const fauxReply = (n: number) => `e2e 替身第 ${n} 次回答`

/** e2e 用：替身供应商不流速、直接回一句，回合真的经过网关与 pi。 */
export async function createReplyRuntime(agentDir: string): Promise<ModelRuntime> {
  const faux = fauxProvider({
    api: "faux",
    provider: FAUX_MODEL.provider,
    models: [{ id: FAUX_MODEL.id, name: "E2e Faux" }],
  })
  const reply: FauxResponseFactory = (_context, _options, state) =>
    fauxAssistantMessage(fauxText(fauxReply(state.callCount)))
  const runtime = await ModelRuntime.create({
    allowModelNetwork: false,
    authPath: join(agentDir, "auth.json"),
    modelsPath: join(agentDir, "models.json"),
  })

  faux.setResponses(Array.from({ length: 4 }, () => reply))
  runtime.registerNativeProvider(faux.provider)
  return runtime
}

/** 与网关缺省 runtime 同参：读 PI_CODING_AGENT_DIR 下的 models.json，不联网。 */
export function createBenchRuntime(): Promise<ModelRuntime> {
  return ModelRuntime.create({ allowModelNetwork: false })
}
