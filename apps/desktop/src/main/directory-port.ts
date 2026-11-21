import { realpath } from "node:fs/promises"

import type { ChildMessage, DirectorySelected } from "./gateway-messages.js"

export type CanonicalizePath = (path: string) => string

export type DirectoryPort = {
  selectDirectory(): Promise<string | undefined>
  validateDirectory(path: string): Promise<string>
}

export function createMessageDirectoryPort(
  post: (message: ChildMessage) => void,
  canonicalizePath: CanonicalizePath,
): { port: DirectoryPort; settle(message: DirectorySelected): void } {
  const pending = new Map<
    number,
    { resolve(path: string | undefined): void; reject(error: Error): void }
  >()
  let nextId = 0
  return {
    port: {
      async selectDirectory() {
        const id = ++nextId
        const selected = await new Promise<string | undefined>((resolve, reject) => {
          pending.set(id, { resolve, reject })
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
      const entry = pending.get(message.id)

      if (!entry) return
      pending.delete(message.id)

      if (message.error !== undefined) entry.reject(new Error(message.error))
      else entry.resolve(message.path)
    },
  }
}
