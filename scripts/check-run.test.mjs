import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { splitCommandArgs } from "./check-run.mjs"

describe("splitCommandArgs", () => {
  it("文件少时保持一条命令", () => {
    assert.deepEqual(splitCommandArgs(["exec", "prettier"], ["a.ts", "b.ts"], 100), [
      ["exec", "prettier", "a.ts", "b.ts"],
    ])
  })

  it("超过长度上限时拆成多条，文件不重不漏且顺序不变", () => {
    const files = ["apps/web/src/alpha.ts", "apps/web/src/beta.ts", "apps/web/src/gamma.ts"]
    const chunks = splitCommandArgs(["exec", "eslint"], files, 40)

    assert.ok(chunks.length > 1)
    assert.deepEqual(
      chunks.flatMap((chunk) => chunk.slice(2)),
      files,
    )

    for (const chunk of chunks) assert.ok(chunk.join(" ").length <= 40)
  })

  it("单个文件超长也保留在自己的命令里", () => {
    const chunks = splitCommandArgs(["exec"], ["x".repeat(50)], 10)

    assert.deepEqual(chunks, [["exec", "x".repeat(50)]])
  })
})
