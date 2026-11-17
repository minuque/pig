import { EventEmitter } from "node:events"
import { mkdir, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"

import { canonicalizePath } from "../../../packages/gateway/src/system/directory.js"
import { createMessageDirectoryPort } from "../src/main/directory-port.js"
import type { ChildMessage, ParentMessage } from "../src/main/gateway-messages.js"
import { connectGateway } from "../src/main/gateway-process.js"

/** 两端都是真实现，中间用 EventEmitter 代替 utilityProcess 的消息通道。 */
async function selectThroughGateway(picked: string | undefined): Promise<string | undefined> {
  const child = Object.assign(new EventEmitter(), {
    postMessage: (message: ParentMessage) => {
      if (message.type === "directory-selected") directory.settle(message)
    },
    kill: () => true,
  })
  const directory = createMessageDirectoryPort(
    (message: ChildMessage) => child.emit("message", message),
    canonicalizePath,
  )
  const connected = connectGateway(child, {
    pickDirectory: async () => picked,
    onUnexpectedExit: () => {},
  })

  child.emit("message", { type: "ready", port: 1, launchToken: "t" })
  await connected
  return directory.port.selectDirectory()
}

describe("选目录经主进程一去一回", () => {
  let tempRoot: string | undefined
  afterEach(async () => {
    if (tempRoot) await rm(tempRoot, { recursive: true, force: true })
    tempRoot = undefined
  })

  it("取消返回 undefined", async () => {
    expect(await selectThroughGateway(undefined)).toBeUndefined()
  })

  it("选中目录后在子进程做 realpath 规范化", async () => {
    tempRoot = await mkdtemp(join(tmpdir(), "pig-electron-dir-"))
    const selected = join(tempRoot, "workspace")
    await mkdir(selected)

    expect(await selectThroughGateway(selected)).toBe(canonicalizePath(await realpath(selected)))
  })
})
