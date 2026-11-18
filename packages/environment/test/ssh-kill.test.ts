import { execFile, spawn } from "node:child_process"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { promisify } from "node:util"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { remoteCommand, remoteKill } from "../src/ssh.js"

const run = promisify(execFile)
let root: string

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "pig-ssh-kill-"))
})

afterEach(() => rm(root, { recursive: true, force: true }))

const alive = (pid: number) => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

// 远端是 POSIX shell：用本机 sh 代替 SSH 服务端跑同一段脚本
describe.skipIf(process.platform === "win32")("远程命令：停止后远端进程一个不留", () => {
  it("正常结束：输出与退出码照实返回", async () => {
    const pidFile = join(root, "pid")
    const child = spawn("sh", ["-c", remoteCommand(root, "echo out; exit 3", pidFile)])
    let out = ""
    child.stdout.on("data", (chunk: Buffer) => (out += chunk.toString()))
    const code = await new Promise((resolve) => child.on("close", resolve))

    expect(out).toBe("out\n")
    expect(code).toBe(3)
  })

  it("停止：命令起的子进程也被杀掉", async () => {
    const pidFile = join(root, "pid")
    const grandchildFile = join(root, "grandchild")
    const child = spawn("sh", [
      "-c",
      remoteCommand(root, `sleep 300 & echo $! > ${grandchildFile}; wait`, pidFile),
    ])
    const closed = new Promise((resolve) => child.on("close", resolve))

    await expect.poll(() => readFile(grandchildFile, "utf8").catch(() => "")).not.toBe("")
    await expect.poll(() => readFile(pidFile, "utf8").catch(() => "")).not.toBe("")
    const grandchild = Number(await readFile(grandchildFile, "utf8"))

    await run("sh", ["-c", remoteKill(pidFile)])
    await closed

    await expect.poll(() => alive(grandchild)).toBe(false)
  })
})
