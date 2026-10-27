import { describe, expect, it } from "vitest"
import { extractProps, type PropDefs } from "@components/ui/rt/props.js"
import { RT_SIZE } from "@components/ui/rt/size.js"

const DEFS: PropDefs = {
  size: {
    type: "enum",
    values: ["s", "m", "l"],
    default: "m",
    className: "rt-r-size",
    valueMap: RT_SIZE,
  },
  variant: {
    type: "enum",
    values: ["solid", "soft"],
    default: "solid",
    className: "rt-variant",
  },
  loading: { type: "boolean", className: "rt-loading" },
  label: { type: "string", customProperty: "--label" },
}

describe("extractProps", () => {
  it("s / m / l 落到 rt 的 1 / 2 / 3，不传按 m", () => {
    expect(extractProps({ size: "s" }, DEFS).class).toBe("rt-r-size-1 rt-variant-solid")
    expect(extractProps({ size: "l" }, DEFS).class).toBe("rt-r-size-3 rt-variant-solid")
    expect(extractProps({}, DEFS).class).toBe("rt-r-size-2 rt-variant-solid")
  })

  it("不在枚举里的档位回落到默认档", () => {
    expect(extractProps({ size: "1", variant: "nope" }, DEFS).class).toBe(
      "rt-r-size-2 rt-variant-solid",
    )
  })

  it("omit 里的键只走 data 属性，不落回元素", () => {
    const kept = extractProps({ color: "teal", radius: "full" }, DEFS)

    expect(kept.attrs.color).toBe("teal")
    expect(kept.attrs.radius).toBe("full")

    const omitted = extractProps({ color: "teal", radius: "full" }, DEFS, ["color", "radius"])

    expect(omitted.attrs.color).toBeUndefined()
    expect(omitted.attrs.radius).toBeUndefined()
  })

  it("布尔落类名，字符串落内联变量", () => {
    expect(extractProps({ loading: true }, DEFS).class).toContain("rt-loading")
    expect(extractProps({ loading: false }, DEFS).class).not.toContain("rt-loading")
    expect(extractProps({ label: "42" }, DEFS).style).toEqual({ "--label": "42" })
  })
})
