import { realpath } from "node:fs/promises"

import type { ChildMessage, DirectorySelected } from "./gateway-messages.js"

export type CanonicalizePath = (path: string) => string

/** 与 Gateway DirectoryPort 对齐；不能从 gateway 源码 import type，tsc emit 会撑破 rootDir。 */
export type DirectoryPort = {
  selectDirectory(): Promise<string | undefined>
  validateDirectory(path: string): Promise<string>
}

/** 子进程一侧：对话框经消息交给主进程弹，选出的原始路径回来后在本进程规范化。 */
export function createMessageDirectoryPort(
  post: (message: ChildMessage) => void,
  canonicalizePath: CanonicalizePath,
): { port: DirectoryPort; settle(message: DirectorySelected): void } {
  const pending = new Map<number, (path: string | undefined) => void>()
  let nextId = 0
  return {
    port: {
      async selectDirectory() {
        const id = ++nextId
        const selected = await new Promise<string | undefined>((resolve) => {
          pending.set(id, resolve)
          post({ type: "select-directory", id })
        })

        if (!selected) return undefined
        return canonicalizePath(await realpath(selected))
      },
      async validateDirectory(path) {
        return canonicalizePath(await realpath(path))
      },
    },
    settle(message) {
      pending.get(message.id)?.(message.path)
      pending.delete(message.id)
    },
  }
}
