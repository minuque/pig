import { describe, expect, it } from "vitest"
import { linkChipLabel, linkSite, shortUrlLabel } from "@features/transcript-view/lib/link-chip.js"

describe("常用站点的链接显示成简短标签", () => {
  it.each([
    ["https://github.com/vuejs/core", "vuejs/core"],
    ["https://github.com/vuejs/core/pull/123", "vuejs/core#123"],
    ["https://github.com/vuejs/core/pull/123/files", "vuejs/core#123"],
    ["https://github.com/vuejs/core/issues/45", "vuejs/core#45"],
    ["https://github.com/vuejs/core/commit/0123456789abcdef", "vuejs/core@0123456"],
    [
      "https://github.com/vuejs/core/blob/main/packages/vue/src/index.ts",
      "vuejs/core · main/packages/vue/src/index.ts",
    ],
    [
      "https://github.com/minuque/pig/tree/refactor/design-system-align",
      "minuque/pig · refactor/design-system-align",
    ],
    ["https://github.com/vuejs/core/releases", "vuejs/core · releases"],
    ["https://github.com/vuejs", "github.com/vuejs"],
    ["https://www.npmjs.com/package/vue", "vue"],
    ["https://www.npmjs.com/package/@vue/runtime-core", "@vue/runtime-core"],
    ["https://huggingface.co/Qwen/Qwen3-8B", "Qwen/Qwen3-8B"],
    ["https://example.com/docs/", "example.com/docs"],
  ])("%s → %s", (url, label) => {
    expect(shortUrlLabel(url)).toBe(label)
  })

  it("链接文字是网址本身才简化，自定义文字原样保留", () => {
    const url = "https://github.com/vuejs/core/pull/123"
    expect(linkChipLabel(url, url)).toBe("vuejs/core#123")
    expect(linkChipLabel(url, "修复 PR")).toBe("修复 PR")
  })
})

describe("按域名识别站点图标", () => {
  it.each([
    ["https://github.com/a/b", "github"],
    ["https://gist.github.com/a/1", "github"],
    ["https://raw.githubusercontent.com/a/b/main/x", "github"],
    ["https://huggingface.co/a/b", "huggingface"],
    ["https://docs.anthropic.com/x", "anthropic"],
    ["https://platform.openai.com/docs", "openai"],
    ["https://example.com", undefined],
  ])("%s → %s", (url, site) => {
    expect(linkSite(url)).toBe(site)
  })
})
