import { describe, expect, it } from "vitest"
import { parseBuiltinCommand } from "@features/session/lib/builtin-command.js"

describe("输入框里的内置命令不当消息发给模型", () => {
  it("/compact 后面的文字作为压缩要保留的重点，/reload 只认单独一条", () => {
    expect(parseBuiltinCommand("/compact")).toEqual({ name: "compact" })
    expect(parseBuiltinCommand("/compact  只保留接口设计 ")).toEqual({
      name: "compact",
      instructions: "只保留接口设计",
    })
    expect(parseBuiltinCommand("/reload")).toEqual({ name: "reload" })
    expect(parseBuiltinCommand("/reload 一下")).toBeUndefined()
    expect(parseBuiltinCommand("/compactor")).toBeUndefined()
    expect(parseBuiltinCommand("帮我 /compact")).toBeUndefined()
  })
})
