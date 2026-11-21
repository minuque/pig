import { describe, expect, it } from "vitest"

import {
  canonicalizeWorkspacePath,
  INLINE_IMAGE_MIME_PATTERN,
  isPreviewLinkMessage,
  MAX_BATCH_ITEMS,
  MAX_FILE_BYTES,
  MAX_IMAGE_BYTES,
  PREVIEW_LINK_MESSAGE_TYPE,
} from "../src/index.js"

describe("canonicalizeWorkspacePath", () => {
  it("统一分隔符、去掉末尾斜杠并将 Windows 盘符路径转为小写", () => {
    expect(canonicalizeWorkspacePath("C:\\Projects\\Demo\\")).toBe("c:/projects/demo")
    expect(canonicalizeWorkspacePath("/Projects/Demo/")).toBe("/Projects/Demo")
    expect(canonicalizeWorkspacePath("/Projects/Demo/", { caseInsensitive: true })).toBe(
      "/projects/demo",
    )
  })

  it("根路径保留尾斜杠，空串返回空串", () => {
    expect(canonicalizeWorkspacePath("C:\\")).toBe("c:/")
    expect(canonicalizeWorkspacePath("/")).toBe("/")
    expect(canonicalizeWorkspacePath("")).toBe("")
  })

  it("远程 ssh workspace 仅在主机根保留尾斜杠", () => {
    expect(canonicalizeWorkspacePath("ssh://devbox/")).toBe("ssh://devbox/")
    expect(canonicalizeWorkspacePath("ssh://devbox")).toBe("ssh://devbox/")
    expect(canonicalizeWorkspacePath("ssh://devbox/srv/app/")).toBe("ssh://devbox/srv/app")
  })
})

describe("isPreviewLinkMessage", () => {
  it("接受合法的 http/https 预览外链消息", () => {
    expect(
      isPreviewLinkMessage({ type: PREVIEW_LINK_MESSAGE_TYPE, href: "https://example.com/a" }),
    ).toBe(true)
    expect(
      isPreviewLinkMessage({ type: PREVIEW_LINK_MESSAGE_TYPE, href: "HTTP://localhost:3000" }),
    ).toBe(true)
  })

  it("拒绝非法结构、其他类型或非 http(s) 协议", () => {
    expect(isPreviewLinkMessage(null)).toBe(false)
    expect(isPreviewLinkMessage("https://example.com")).toBe(false)
    expect(isPreviewLinkMessage({ type: "other", href: "https://example.com" })).toBe(false)
    expect(isPreviewLinkMessage({ type: PREVIEW_LINK_MESSAGE_TYPE, href: 123 })).toBe(false)
    expect(
      isPreviewLinkMessage({ type: PREVIEW_LINK_MESSAGE_TYPE, href: "javascript:alert(1)" }),
    ).toBe(false)
    expect(
      isPreviewLinkMessage({ type: PREVIEW_LINK_MESSAGE_TYPE, href: "data:text/html,hi" }),
    ).toBe(false)
  })
})

describe("attachment constraints", () => {
  it("保持协议层附件上限与内联位图匹配规则", () => {
    expect(MAX_BATCH_ITEMS).toBe(8)
    expect(MAX_IMAGE_BYTES).toBe(3 * 1024 * 1024)
    expect(MAX_FILE_BYTES).toBe(25 * 1024 * 1024)
    expect(INLINE_IMAGE_MIME_PATTERN.test("image/png")).toBe(true)
    expect(INLINE_IMAGE_MIME_PATTERN.test("image/JPEG")).toBe(true)
    expect(INLINE_IMAGE_MIME_PATTERN.test("image/gif")).toBe(true)
    expect(INLINE_IMAGE_MIME_PATTERN.test("image/webp")).toBe(true)
    expect(INLINE_IMAGE_MIME_PATTERN.test("image/svg+xml")).toBe(false)
    expect(INLINE_IMAGE_MIME_PATTERN.test("image/bmp")).toBe(false)
    expect(INLINE_IMAGE_MIME_PATTERN.test("image/heic")).toBe(false)
  })
})
