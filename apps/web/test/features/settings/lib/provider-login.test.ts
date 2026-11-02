import { describe, expect, it } from "vitest"

import { initialLoginState, reduceLoginEvents } from "@features/settings/lib/provider-login.js"
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
