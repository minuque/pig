import { describe, expect, it } from "vitest"

import {
  addedLoginUrl,
  endLoginStream,
  initialLoginState,
  reduceLoginEvents,
} from "@features/settings/lib/provider-login.js"
import type { LoginEvent } from "@/types/provider-type.js"

const prompt = (seq: number, id: string): LoginEvent => ({
  type: "prompt",
  id,
  prompt: { id, type: "secret", message: "API Key" },
  seq,
})
const authUrl = (seq: number, url: string): LoginEvent => ({ type: "auth_url", url, seq })
const deviceCode = (seq: number, userCode: string): LoginEvent => ({
  type: "device_code",
  userCode,
  verificationUri: "https://auth.example/device",
  seq,
})

describe("reduceLoginEvents", () => {
  it("新 prompt 覆盖待答项", () => {
    const first = reduceLoginEvents(initialLoginState(), prompt(1, "p1"))
    const second = reduceLoginEvents(first, prompt(2, "p2"))

    expect(first.prompt?.id).toBe("p1")
    expect(second.prompt?.id).toBe("p2")
    expect(second.phase).toBe("running")
  })

  it("auth_url 与 device_code 累积", () => {
    const state = [authUrl(1, "https://a"), authUrl(2, "https://b"), deviceCode(3, "ABCD")].reduce(
      reduceLoginEvents,
      initialLoginState(),
    )

    expect(state.links).toEqual(["https://a", "https://b"])
    expect(state.deviceCodes).toEqual([
      { userCode: "ABCD", verificationUri: "https://auth.example/device" },
    ])
  })

  it("done 清空待答项并结束", () => {
    const pending = reduceLoginEvents(initialLoginState(), prompt(1, "p1"))
    const state = reduceLoginEvents(pending, { type: "done", seq: 2 })

    expect(state.phase).toBe("done")
    expect(state.prompt).toBeNull()
  })

  it("error 保留消息并清空待答项", () => {
    const pending = reduceLoginEvents(initialLoginState(), prompt(1, "p1"))
    const state = reduceLoginEvents(pending, { type: "error", message: "拒绝", seq: 2 })

    expect(state.phase).toBe("error")
    expect(state.error).toBe("拒绝")
    expect(state.prompt).toBeNull()
  })

  it("重复或更旧的 seq 原样返回", () => {
    const state = reduceLoginEvents(initialLoginState(), prompt(2, "p2"))

    expect(reduceLoginEvents(state, prompt(2, "old"))).toBe(state)
    expect(reduceLoginEvents(state, prompt(1, "older"))).toBe(state)
  })
})

describe("addedLoginUrl", () => {
  it("新的 auth_url 返回该地址", () => {
    const before = initialLoginState()
    const after = reduceLoginEvents(before, authUrl(1, "https://auth.example/a"))

    expect(addedLoginUrl(before, after)).toBe("https://auth.example/a")
  })

  it("device_code 的验证地址也返回", () => {
    const before = initialLoginState()
    const after = reduceLoginEvents(before, deviceCode(1, "ABCD"))

    expect(addedLoginUrl(before, after)).toBe("https://auth.example/device")
  })

  it("重复事件不重复返回", () => {
    const first = reduceLoginEvents(initialLoginState(), authUrl(1, "https://a"))
    const second = reduceLoginEvents(first, authUrl(2, "https://a"))

    expect(addedLoginUrl(first, second)).toBeUndefined()
  })

  it("prompt 与 progress 不返回地址", () => {
    const before = initialLoginState()
    const after = reduceLoginEvents(before, prompt(1, "p1"))

    expect(addedLoginUrl(before, after)).toBeUndefined()
  })
})

describe("endLoginStream", () => {
  it("流结束但无终态时转为中断错误", () => {
    const running = reduceLoginEvents(initialLoginState(), prompt(1, "p1"))
    const ended = endLoginStream(running, "interrupted")

    expect(ended.phase).toBe("error")
    expect(ended.prompt).toBeNull()
    expect(ended.error).toBeTruthy()
  })

  it("已有终态时保持原状", () => {
    const done = reduceLoginEvents(initialLoginState(), { type: "done", seq: 1 })

    expect(endLoginStream(done, "interrupted")).toBe(done)
  })
})
