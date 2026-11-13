import { randomUUID } from "node:crypto"
import { createWriteStream, mkdirSync, type WriteStream } from "node:fs"
import { dirname, join } from "node:path"
import { StringDecoder } from "node:string_decoder"

import type { Environment } from "@pig/environment/source"
import type { BashTask } from "@pig/protocol"

import type { TaskConfig } from "./config.ts"
import type { TaskRegistry } from "./registry.ts"

/** 只留末尾若干字符；被截过就从第一个换行之后开始，不从半行起。 */
export function outputTail(text: string, limit: number): string {
  if (text.length <= limit) return text
  const cut = text.slice(-limit)
  const newline = cut.indexOf("\n")
  return newline >= 0 && newline < cut.length - 1 ? cut.slice(newline + 1) : cut
}

/** 完整输出写到日志文件；到上限后记一行说明并停止写入。 */
function createLog(path: string, maxBytes: number) {
  mkdirSync(dirname(path), { recursive: true })
  let stream: WriteStream | undefined = createWriteStream(path)
  let written = 0
  return {
    write(chunk: Buffer) {
      if (!stream) return

      if (written + chunk.length > maxBytes) {
        stream.end(`\n[log limit of ${maxBytes} bytes reached; later output was not saved]\n`)
        stream = undefined
        return
      }

      written += chunk.length
      stream.write(chunk)
    },
    close() {
      stream?.end()
      stream = undefined
    },
  }
}

export interface BashTaskInput {
  sessionId: string
  env: Environment
  cwd: string
  command: string
  description: string
  /** 秒；不给就不限时。 */
  timeout?: number
}

/** 启动一个后台命令并登记；立刻返回，命令的结束由登记表通知会话。 */
export function startBashTask(
  registry: TaskRegistry,
  config: TaskConfig,
  input: BashTaskInput,
): BashTask {
  const id = `bash:${randomUUID().slice(0, 8)}`
  const logPath = join(config.logDir, input.sessionId, `${id.replace(":", "-")}.log`)
  const log = createLog(logPath, config.logMaxBytes)
  const decoder = new StringDecoder("utf8")
  const controller = new AbortController()
  let output = ""
  const task: BashTask = {
    id,
    kind: "bash",
    description: input.description,
    command: input.command,
    status: "running",
    output: "",
    startedAt: Date.now(),
    logPath,
  }

  registry.add(task, () => controller.abort())
  input.env
    .exec(input.command, {
      cwd: input.cwd,
      signal: controller.signal,
      ...(input.timeout ? { timeout: input.timeout } : {}),
      onData: (chunk) => {
        log.write(chunk)
        // 多留一倍再截，避免每块输出都整段重切
        output = (output + decoder.write(chunk)).slice(-config.outputTailChars * 2)
        registry.patch(id, { output: outputTail(output, config.outputTailChars) })
      },
    })
    .then(
      ({ exitCode }) =>
        registry.finish(id, { status: exitCode === 0 ? "completed" : "failed", exitCode }, true),
      (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error)
        const timedOut = /^timeout:/.test(message)
        registry.finish(
          id,
          {
            status: "failed",
            error: timedOut ? `Timed out after ${input.timeout}s and was terminated` : message,
          },
          true,
        )
      },
    )
    .finally(() => log.close())
  return task
}
