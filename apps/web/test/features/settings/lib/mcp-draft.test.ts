import { describe, expect, it } from "vitest"

import { configFromDraft, draftFromConfig, searchText } from "@features/settings/lib/mcp-draft.js"

describe("mcp draft", () => {
  it("编辑再保存不丢表单不管的字段，参数里带空格的保持原样", () => {
    const config = {
      command: "npx",
      args: ["-y", "server", "C:/My Files"],
      env: { TOKEN: "${TOKEN}" },
      toolExposure: { "delete_*": "hidden" },
    }

    expect(configFromDraft(draftFromConfig("fs", config), config)).toEqual(config)
  })

  it("编辑 HTTP server 时保留表单不管的 OAuth 字段", () => {
    const config = {
      url: "https://example.com/mcp",
      oauth: { clientName: "pig", clientId: "abc", clientRegistration: "dcr" },
    }

    expect(configFromDraft(draftFromConfig("docs", config), config)).toEqual(config)
  })

  it("新建 HTTP server 只写填了的字段，空的键值行丢掉", () => {
    const draft = draftFromConfig("docs", {})

    draft.transport = "http"
    draft.url = "https://example.com/mcp"
    draft.headers = [
      { key: "Authorization", value: "Bearer ${DOCS}" },
      { key: "", value: "" },
    ]
    draft.exposure = "direct"

    expect(configFromDraft(draft)).toEqual({
      url: "https://example.com/mcp",
      headers: { Authorization: "Bearer ${DOCS}" },
      exposure: "direct",
    })
  })

  it("切换传输方式时去掉另一种的字段", () => {
    const config = { command: "npx", args: ["fs"], cwd: "." }
    const draft = draftFromConfig("fs", config)

    draft.transport = "http"
    draft.url = "https://x/mcp"

    expect(configFromDraft(draft, config)).toEqual({ url: "https://x/mcp" })
  })
})

describe("MCP 搜索", () => {
  it("有说明的 server 也能按命令或 URL 搜到", () => {
    const text = searchText({ description: "文件系统", command: "npx", args: ["-y", "fs"] })

    expect(text).toContain("文件系统")
    expect(text).toContain("npx -y fs")
    expect(searchText({ description: "远程", url: "https://x.dev/mcp" })).toContain("x.dev")
  })
})
