import assert from "node:assert/strict"
import { resolve } from "node:path"
import { describe, it } from "node:test"

import { loadFlows, validateFlows } from "./flows.mjs"

const root = resolve(import.meta.dirname, "../..")
const flowWith = (ref) => [{ id: "t", title: "t", steps: [{ from: "a", to: "b", text: "x", ref }] }]

describe("validateFlows", () => {
  it("文件不存在时报错", () => {
    assert.equal(validateFlows(root, flowWith("packages/gateway/src/nope.ts#X")).length, 1)
  })

  it("文件在但导出不在时报错", () => {
    const ref = "packages/gateway/src/pi/service.ts#NoSuchExport"
    assert.equal(validateFlows(root, flowWith(ref)).length, 1)
  })

  it("类成员不在时报错，在时通过", () => {
    const base = "packages/gateway/src/pi/service.ts#PiHostService"
    assert.equal(validateFlows(root, flowWith(`${base}.noSuchMethod`)).length, 1)
    assert.deepEqual(validateFlows(root, flowWith(`${base}.prepareWorkspace`)), [])
  })

  it("仓库里的数据流全部引用有效", async () => {
    assert.deepEqual(validateFlows(root, await loadFlows(root)), [])
  })
})
