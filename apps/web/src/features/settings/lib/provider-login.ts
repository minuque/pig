/** 登录事件流的状态归约；seq 单调，旧事件丢弃。 */

import type { LoginEvent, LoginPrompt } from "@/types/provider-type.js"

export interface LoginDeviceCode {
  userCode: string
  verificationUri: string
}

export interface LoginState {
  phase: "idle" | "running" | "done" | "error"
  seq: number
  prompt: LoginPrompt | null
  links: string[]
  deviceCodes: LoginDeviceCode[]
  instruction: string | null
  progress: string | null
  error: string | null
}

export function initialLoginState(): LoginState {
  return {
    phase: "idle",
    seq: 0,
    prompt: null,
    links: [],
    deviceCodes: [],
    instruction: null,
    progress: null,
    error: null,
  }
}

/** 事件流干净结束却未见终态：转成可重试的错误，不再挂着等待授权。 */
export function endLoginStream(state: LoginState, message: string): LoginState {
  if (state.phase !== "running") return state
  return { ...state, phase: "error", prompt: null, progress: null, error: message }
}

export function reduceLoginEvents(state: LoginState, event: LoginEvent): LoginState {
  if (event.seq <= state.seq) return state
  const base: LoginState = { ...state, seq: event.seq, phase: "running" }

  switch (event.type) {
    case "prompt":
      return { ...base, prompt: event.prompt }
    case "auth_url":
      return {
        ...base,
        links: append(base.links, event.url),
        ...(event.instructions ? { instruction: event.instructions } : {}),
      }
    case "device_code":
      return {
        ...base,
        deviceCodes: [
          ...base.deviceCodes,
          { userCode: event.userCode, verificationUri: event.verificationUri },
        ],
      }
    case "info":
      return { ...base, instruction: event.message }
    case "progress":
      return { ...base, progress: event.message }
    case "done":
      return { ...base, phase: "done", prompt: null }
    case "error":
      return { ...base, phase: "error", prompt: null, error: event.message }
  }
}

/** 本次事件新增的验证地址：第一次出现时自动交给系统浏览器打开。 */
export function addedLoginUrl(previous: LoginState, next: LoginState): string | undefined {
  const known = new Set([
    ...previous.links,
    ...previous.deviceCodes.map((code) => code.verificationUri),
  ])
  const candidates = [...next.links, ...next.deviceCodes.map((code) => code.verificationUri)]
  return candidates.find((url) => !known.has(url))
}

function append(list: string[], value: string): string[] {
  return list.includes(value) ? list : [...list, value]
}
