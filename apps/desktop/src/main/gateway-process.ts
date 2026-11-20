import type { ChildMessage, ParentMessage } from "./gateway-messages.js"

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

export function connectGateway(
  child: GatewayChild,
  { pickDirectory, onUnexpectedExit }: GatewayProcessOptions,
): Promise<GatewayProcess> {
  let state: "starting" | "running" | "stopping" | "exited" = "starting"
  const exitPromise = new Promise<void>((resolve) => child.on("exit", () => resolve()))
  return new Promise((resolve, reject) => {
    child.on("message", (message) => {
      if (message.type === "select-directory") {
        void pickDirectory().then(
          (path) => {
            child.postMessage({
              type: "directory-selected",
              id: message.id,
              ...(path ? { path } : {}),
            })
          },
          () => {
            child.postMessage({ type: "directory-failed", id: message.id })
          },
        )
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
