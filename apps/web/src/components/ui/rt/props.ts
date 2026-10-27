/**
 * Radix Themes 的 prop → 类名引擎的精简版。
 * 只支持固定枚举、布尔、字符串三类；不做响应式对象（本项目没有响应式尺寸用法）。
 * 默认值与取值校验照 rt 的规则：不在枚举里的值回落到默认值。
 */

export type PropDef = Readonly<{
  type: "enum" | "boolean" | "string"
  values?: readonly string[]
  default?: string | boolean
  /** 枚举落成 `${className}-${value}`；布尔落成 className 本身 */
  className?: string
  /** 枚举值到 rt 档位的映射：本项目只对外给 s/m/l，rt 收数字档 */
  valueMap?: Readonly<Record<string, string>>
  /** 字符串落成内联自定义属性 */
  customProperty?: string
}>

export type PropDefs = Readonly<Record<string, PropDef>>

export interface Extracted {
  class: string
  style: Record<string, string>
  attrs: Record<string, unknown>
}

/**
 * 把 props 拆成类名、内联变量与剩余属性。
 * omit 里的键只走 data 属性、不落回元素，避免 color / radius 这类被当成原生属性写进 DOM。
 */
export function extractProps(
  props: Record<string, unknown>,
  defs: PropDefs,
  omit: readonly string[] = [],
): Extracted {
  const all: Record<string, PropDef> = Object.assign({}, defs)
  const attrs: Record<string, unknown> = { ...props }
  const classes: string[] = []
  const style: Record<string, string> = {}

  for (const key of omit) delete attrs[key]

  for (const [key, def] of Object.entries(all)) {
    let value = attrs[key]

    if (value === undefined) value = def.default

    if (def.type === "enum" && def.values && !def.values.includes(String(value))) {
      value = def.default
    }

    delete attrs[key]

    if (value === undefined || value === null || value === false || value === "") continue

    if (def.type === "boolean") {
      if (def.className) classes.push(def.className)
      continue
    }

    const text = String(value)

    if (def.className) classes.push(`${def.className}-${def.valueMap?.[text] ?? text}`)

    if (def.customProperty) style[def.customProperty] = text
    else if (!def.className) attrs[key] = value
  }

  return { class: classes.join(" "), style, attrs }
}
