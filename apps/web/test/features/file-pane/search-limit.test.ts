import { describe, expect, it } from "vitest"
import { searchLimitNotice } from "@features/file-pane/lib/search-limit.js"

describe("搜索没搜全时的提示", () => {
  it("没截断就不提示", () => {
    expect(searchLimitNotice([], 3)).toBeUndefined()
  })

  it("只是命中太多：提示只显示了前几条，继续输入缩小范围", () => {
    expect(searchLimitNotice(["result-limit"], 241)).toEqual({
      key: "files.limitResults",
      count: 241,
    })
  })

  it("候选文件太多：提示只搜了项目的一部分", () => {
    expect(searchLimitNotice(["candidate-limit", "result-limit"], 9)).toEqual({
      key: "files.limitPartial",
    })
  })

  it("超时、文件过大等其他原因：提示结果不完整", () => {
    expect(searchLimitNotice(["deadline"], 4)).toEqual({ key: "files.limitIncomplete" })
    expect(searchLimitNotice(["content-file-limit", "result-limit"], 4)).toEqual({
      key: "files.limitIncomplete",
    })
  })
})
