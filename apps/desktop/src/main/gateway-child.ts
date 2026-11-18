/** utilityProcess 入口：在独立进程里跑 gateway，经 parentPort 与主进程通信。 */
import { resolve } from "node:path"
import { parseArgs } from "node:util"

import { createMessageDirectoryPort, type DirectoryPort } from "./directory-port.js"
import type { ChildMessage, ParentMessage } from "./gateway-messages.js"

type GatewayInstance = {
  start(): Promise<number>
  stop(): Promise<void>
  launchToken: string
}

type GatewayModule = {
  default: new (options: {
    platformPort: DirectoryPort
    webRoot?: string
    sessionDir?: string
    cwd?: string
  }) => GatewayInstance
  canonicalizePath: (path: string) => string
}

const { values } = parseArgs({
  options: { "web-root": { type: "string" }, packaged: { type: "boolean" } },
})
const parentPort = process.parentPort
let gateway: GatewayInstance | undefined
let directory: ReturnType<typeof createMessageDirectoryPort> | undefined

function post(message: ChildMessage): void {
  parentPort.postMessage(message)
}

function envDir(name: "PIG_SESSION_DIR" | "PIG_CWD"): string | undefined {
  const value = process.env[name]
  return value ? resolve(value) : undefined
}

async function loadGatewayModule(isPackaged: boolean): Promise<GatewayModule> {
  if (isPackaged) {
    // 非字面量，避免 tsc emit 把 gateway 源码拉进 rootDir
    const spec = "@pig/gateway"
    return (await import(spec)) as GatewayModule
  }

  // exports 指向 dist，开发时可能没有
  const url = new URL("../../../../packages/gateway/src/index.js", import.meta.url).href
  return (await import(url)) as GatewayModule
}

async function stop(): Promise<void> {
  try {
    await gateway?.stop()
  } finally {
    process.exit(0)
  }
}

parentPort.on("message", ({ data }: { data: ParentMessage }) => {
  if (data.type === "directory-selected") directory?.settle(data)
  else void stop()
})

try {
  const gatewayMod = await loadGatewayModule(values.packaged === true)
  directory = createMessageDirectoryPort(post, gatewayMod.canonicalizePath)
  const webRoot = values["web-root"]
  const sessionDir = envDir("PIG_SESSION_DIR")
  const cwd = envDir("PIG_CWD")
  gateway = new gatewayMod.default({
    platformPort: directory.port,
    ...(webRoot ? { webRoot } : {}),
    ...(sessionDir ? { sessionDir } : {}),
    ...(cwd ? { cwd } : {}),
  })
  const port = await gateway.start()
  post({ type: "ready", port, launchToken: gateway.launchToken })
} catch (error) {
  // 不在这里退出：立刻 exit 可能丢掉这条消息，由主进程收到后结束本进程
  post({ type: "failed", message: error instanceof Error ? error.message : String(error) })
}
