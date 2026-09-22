import { describe, expect, it } from "vitest"
import { parseCodeFenceInfo } from "@features/transcript-view/lib/code-fence.js"
import { siteFaviconSrc } from "@features/transcript-view/lib/site-favicon.js"
import {
  describeLinkChip,
  linkChipLabel,
  splitLinkText,
} from "@features/transcript-view/lib/link-chip.js"

describe("describeLinkChip", () => {
  it("把 GitHub 仓库、PR 和提交收成短标签", () => {
    expect(describeLinkChip("https://github.com/Emanuele-web04/synara")).toEqual({
      label: "Emanuele-web04/synara",
      isGitHub: true,
    })
    expect(describeLinkChip("https://github.com/o/r/pull/155")).toEqual({
      label: "o/r#155",
      isGitHub: true,
    })
    expect(describeLinkChip("https://github.com/o/r/commit/abcdef1234567890")).toEqual({
      label: "o/r@abcdef1",
      isGitHub: true,
    })
    expect(describeLinkChip("https://github.com/o/r/releases/tag/v0.9.1")).toEqual({
      label: "github.com/o/r/releases/tag/v0.9.1",
      isGitHub: true,
    })
    expect(describeLinkChip("https://github.com/o/r/tree/main").isGitHub).toBe(true)
    expect(describeLinkChip("https://example.com/docs").isGitHub).toBe(false)
  })

  it("手写链接文字保留原文，裸地址用短标签", () => {
    expect(linkChipLabel("https://github.com/o/r", "https://github.com/o/r")).toBe("o/r")
    expect(linkChipLabel("https://github.com/o/r", "仓库")).toBe("仓库")
  })

  it("从句子里切开地址，句号留在外面", () => {
    expect(splitLinkText("看 https://github.com/a/b 一下.")).toEqual([
      { kind: "text", text: "看 " },
      { kind: "link", text: "https://github.com/a/b" },
      { kind: "text", text: " 一下." },
    ])
    expect(splitLinkText("见 https://example.com/docs.")).toEqual([
      { kind: "text", text: "见 " },
      { kind: "link", text: "https://example.com/docs" },
      { kind: "text", text: "." },
    ])
  })
})

describe("siteFaviconSrc", () => {
  it("用链接自己的主机取 favicon", () => {
    expect(siteFaviconSrc("https://github.com/minuque/pi-cc-extensions/pull/24")).toBe(
      "https://github.com/favicon.ico",
    )
    expect(siteFaviconSrc("https://www.example.com/a")).toBe("https://www.example.com/favicon.ico")
    expect(siteFaviconSrc("notaurl")).toBeNull()
  })
})

describe("parseCodeFenceInfo", () => {
  it("识别行号路径和普通语言", () => {
    expect(parseCodeFenceInfo("12:40:src/App.vue")).toMatchObject({
      language: "vue",
      isFileReference: true,
      fileName: "App.vue",
      directory: "src",
      lineRange: "12-40",
    })
    expect(parseCodeFenceInfo("typescript")).toMatchObject({
      language: "typescript",
      isFileReference: false,
    })
    expect(parseCodeFenceInfo("12:12:a.ts").lineRange).toBe("12")
  })
})
