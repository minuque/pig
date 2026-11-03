import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { buildCommand } from "./run.mjs"

describe("buildCommand", () => {
  it("npm_execpath 指向可执行文件时直接启动", () => {
    const command = buildCommand("pnpm", ["exec", "eslint"], {
      env: { npm_execpath: "/usr/local/bin/pnpm" },
      platform: "linux",
    })

    assert.deepEqual(command, {
      command: "/usr/local/bin/pnpm",
      args: ["exec", "eslint"],
      options: {},
    })
  })

  it("npm_execpath 是 JS 入口时经 process.execPath 启动", () => {
    const command = buildCommand("pnpm", ["run", "test"], {
      env: { npm_execpath: "/usr/local/lib/pnpm.cjs" },
      platform: "linux",
    })

    assert.deepEqual(command, {
      command: process.execPath,
      args: ["/usr/local/lib/pnpm.cjs", "run", "test"],
      options: {},
    })
  })

  it("没有 npm_execpath 时回落到 PATH，Windows 上拼命令行交给 shell", () => {
    assert.deepEqual(buildCommand("pnpm", ["check"], { env: {}, platform: "win32" }), {
      command: "pnpm.cmd check",
      args: [],
      options: { shell: true },
    })

    assert.deepEqual(buildCommand("pnpm", ["check"], { env: {}, platform: "linux" }), {
      command: "pnpm",
      args: ["check"],
      options: {},
    })
  })

  it("Windows 上的 .cmd 包装改走 shell，参数带空白时加引号", () => {
    assert.deepEqual(buildCommand("npm.cmd", ["pack", "a b"], { platform: "win32" }), {
      command: 'npm.cmd pack "a b"',
      args: [],
      options: { shell: true },
    })
  })

  it("普通命令原样透传，Windows 上也不额外挂 shell", () => {
    assert.deepEqual(buildCommand(process.execPath, ["-v"], { platform: "win32" }), {
      command: process.execPath,
      args: ["-v"],
      options: {},
    })
  })
})
