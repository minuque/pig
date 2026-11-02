import { describe, expect, it } from "vitest"

import { assertVitePortFree, isVitePortFree, waitForHttp } from "../src/main/vite-child.js"

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
