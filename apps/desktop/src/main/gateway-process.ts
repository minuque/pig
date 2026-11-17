import type { ChildMessage, ParentMessage } from "./gateway-messages.js"

/** utilityProcess 里本模块用到的部分；单测用假的。 */
export type GatewayChild = {
  postMessage(message: ParentMessage): void
  on(event: "message", listener: (message: ChildMessage) => void): unknown
  on(event: "exit", listener: (code: number) => void): unknown
  kill(): boolean
}

export type GatewayProcess = {
  port: number
  launchToken: string
  stop(): Promise<void>
}

export type GatewayProcessOptions = {
  pickDirectory(): Promise<string | undefined>
  onUnexpectedExit(code: number): void
}

/** 等子进程 ready；之后代主进程弹选目录对话框，并把意外退出报给调用方。 */
export function connectGateway(
  child: GatewayChild,
  { pickDirectory, onUnexpectedExit }: GatewayProcessOptions,
): Promise<GatewayProcess> {
  let state: "starting" | "running" | "stopping" | "exited" = "starting"
  const exitPromise = new Promise<void>((resolve) => child.on("exit", () => resolve()))
  return new Promise((resolve, reject) => {
    child.on("message", (message) => {
      if (message.type === "select-directory") {
        void pickDirectory().then((path) => {
          child.postMessage({
            type: "directory-selected",
            id: message.id,
            ...(path ? { path } : {}),
          })
        })
      } else if (message.type === "ready" && state === "starting") {
        state = "running"
        resolve({
          port: message.port,
          launchToken: message.launchToken,
          stop() {
            if (state === "running") {
              state = "stopping"
              child.postMessage({ type: "stop" })
            }

            return exitPromise
          },
        })
      } else if (message.type === "failed" && state === "starting") {
        state = "stopping"
        child.kill()
        reject(new Error(message.message))
      }
    })
    child.on("exit", (code) => {
      const previous = state
      state = "exited"

      if (previous === "starting") reject(new Error(`网关进程启动前退出（退出码 ${code}）`))
      else if (previous === "running") onUnexpectedExit(code)
    })
  })
}
