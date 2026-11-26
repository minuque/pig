import { describe, expect, it } from "vitest"

import { toolExposureFor } from "@features/settings/lib/mcp-draft.js"
import { extractToolParams, formatByteSize } from "@features/settings/lib/mcp-tool-schema.js"

describe("extractToolParams", () => {
  it("必填参数排在可选前，提取类型、枚举、默认值和数组项类型", () => {
    const params = extractToolParams({
      type: "object",
      required: ["path"],
      properties: {
        recursive: {
          type: "boolean",
          default: false,
          description: "Recurse subdirectories",
        },
        path: {
          type: "string",
          description: "Directory path",
        },
        tags: {
          type: "array",
          items: { type: "string" },
        },
        mode: {
          enum: ["fast", "full"],
          default: "fast",
        },
        target: {
          anyOf: [{ type: "string" }, { type: "number" }],
        },
      },
    })

    expect(params).toEqual([
      {
        name: "path",
        required: true,
        type: "string",
        description: "Directory path",
      },
      {
        name: "recursive",
        required: false,
        type: "boolean",
        description: "Recurse subdirectories",
        defaultValue: "false",
      },
      {
        name: "tags",
        required: false,
        type: "string[]",
      },
      {
        name: "mode",
        required: false,
        type: "enum",
        defaultValue: "fast",
        enumValues: ["fast", "full"],
      },
      {
        name: "target",
        required: false,
        type: "string | number",
      },
    ])
  })

  it("空 schema 或缺少 properties 返回空数组", () => {
    expect(extractToolParams(undefined)).toEqual([])
    expect(extractToolParams({ type: "object" })).toEqual([])
  })
})

describe("toolExposureFor", () => {
  it("按精确名、通配规则、默认暴露顺序求值", () => {
    const server = {
      exposure: "codemode" as const,
      config: {
        toolExposure: {
          ping: "direct",
          "delete_*": "hidden",
        },
      },
    }

    expect(toolExposureFor(server, "ping")).toBe("direct")
    expect(toolExposureFor(server, "delete_file")).toBe("hidden")
    expect(toolExposureFor(server, "read_file")).toBe("codemode")
  })
})

describe("formatByteSize", () => {
  it("按 B / KB / MB 格式化大小", () => {
    expect(formatByteSize(512)).toBe("512 B")
    expect(formatByteSize(1536)).toBe("1.5 KB")
    expect(formatByteSize(2 * 1024 * 1024)).toBe("2 MB")
  })
})
