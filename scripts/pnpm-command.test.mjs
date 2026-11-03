import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { pnpmCommand } from "./pnpm-command.mjs"

describe("pnpmCommand", () => {
  it("npm_execpath 指向可执行文件时直接启动", () => {
    const command = pnpmCommand(["exec", "eslint"], {
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
    const command = pnpmCommand(["run", "test"], {
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
    assert.deepEqual(pnpmCommand(["check"], { env: {}, platform: "win32" }), {
      command: "pnpm.cmd check",
      args: [],
      options: { shell: true },
    })

    assert.deepEqual(pnpmCommand(["check"], { env: {}, platform: "linux" }), {
      command: "pnpm",
      args: ["check"],
      options: {},
    })
  })

  it("含空白的参数加引号，免被 shell 拆开", () => {
    const command = pnpmCommand(["exec", "eslint", "a b/c.ts"], { env: {}, platform: "win32" })

    assert.equal(command.command, 'pnpm.cmd exec eslint "a b/c.ts"')
  })
})
