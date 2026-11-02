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

function append(list: string[], value: string): string[] {
  return list.includes(value) ? list : [...list, value]
}
