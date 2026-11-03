import { describe, expect, it } from "vitest"

import {
  assertVitePortFree,
  isVitePortFree,
  viteLaunch,
  waitForHttp,
} from "../src/main/vite-child.js"

describe("viteLaunch", () => {
  it("不依赖启动器注入的 npm_execpath", () => {
    const launch = viteLaunch(
      ["--port", "5555", "--strictPort"],
      {},
      {
        execPath: "G:/electron/electron.exe",
        electron: true,
      },
    )

    expect(launch.command).toBe("G:/electron/electron.exe")
    expect(launch.args[0]).toMatch(/vite[\\/]bin[\\/]vite\.js$/)
    expect(launch.args.slice(1)).toEqual(["--port", "5555", "--strictPort"])
    expect(launch.env.ELECTRON_RUN_AS_NODE).toBe("1")
  })

  it("纯 Node 下不加 ELECTRON_RUN_AS_NODE", () => {
    const launch = viteLaunch([], {}, { execPath: "/usr/bin/node", electron: false })

    expect(launch.env.ELECTRON_RUN_AS_NODE).toBeUndefined()
  })

  it("透传调用方环境", () => {
    const launch = viteLaunch(
      [],
      { GATEWAY_TARGET: "http://127.0.0.1:1" },
      {
        execPath: "/usr/bin/node",
        electron: false,
      },
    )

    expect(launch.env.GATEWAY_TARGET).toBe("http://127.0.0.1:1")
  })
})

describe("waitForHttp", () => {
  it("Vite 已退出就立刻失败，不再空等超时", async () => {
    await expect(
      waitForHttp("http://127.0.0.1:1", 10_000, { exitCode: 1, signalCode: null }),
    ).rejects.toThrow("Vite 提前退出")
  })
})

describe("assertVitePortFree", () => {
  it("端口有监听时报出占用者", () => {
    expect(() => assertVitePortFree(5555, () => [1234])).toThrow("5555")
    expect(() => assertVitePortFree(5555, () => [1234])).toThrow("1234")
  })

  it("端口空闲时放行", () => {
    expect(() => assertVitePortFree(5555, () => [])).not.toThrow()
  })
})

describe("isVitePortFree", () => {
  it("开跑前端口被别人占着就不算自己的", () => {
    expect(isVitePortFree(5555, () => [1234])).toBe(false)
    expect(isVitePortFree(5555, () => [])).toBe(true)
  })
})
