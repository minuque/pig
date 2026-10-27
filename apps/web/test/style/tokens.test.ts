import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const SRC = fileURLToPath(new URL("../../src", import.meta.url))

/** 递归收集样式与组件源码。 */
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)

    if (statSync(path).isDirectory()) return walk(path)
    return /\.(css|vue|ts)$/.test(name) ? [path] : []
  })
}

/** 正则第一个捕获组的内容，逐个返回。 */
function captures(text: string, pattern: RegExp): string[] {
  return [...text.matchAll(pattern)].flatMap((match) => (match[1] ? [match[1]] : []))
}

/**
 * 这些前缀的变量不归本项目定义：Radix Themes 提供 accent 与 gray 色板系列，
 * Reka UI 提供 --reka- 系列，其余是浏览器或运行期写入的。
 */
const EXTERNAL = [
  "--accent-",
  "--gray-",
  "--space-",
  "--font-size-",
  "--line-height-",
  "--radius-",
  "--shadow-",
  "--scaling",
  "--default-",
  "--cursor-",
  "--strong-",
  "--em-",
  "--quote-",
  "--code-",
  "--heading-",
  "--tab-",
  "--letter-spacing-",
  "--inset-",
  "--base-card-",
  "--dialog-content-",
  "--backdrop-",
  "--color-",
  "--panel-",
  "--focus-color",
  "--slider-",
  "--switch-",
  "--checkbox-",
  "--radio-",
  "--scrollarea-",
  "--select-",
  "--popper-",
  "--tooltip-",
  "--dropdown-menu-",
  "--context-menu-",
  "--hover-card-",
  "--popover-",
  "--separator-",
  "--text-field-",
  "--progress-",
  "--blockquote-",
  "--kbd-",
  "--reka-",
]

describe("CSS 变量引用", () => {
  it("用到的变量都有定义，或由 rt / reka / 运行期提供", () => {
    const files = walk(SRC)
    const defined = new Set<string>()
    const used = new Map<string, string[]>()

    for (const file of files) {
      const text = readFileSync(file, "utf8")

      // 声明处与运行期写入都算定义：:style 对象的键带引号，setProperty 直接传字符串。
      for (const name of captures(text, /(--[a-zA-Z0-9-]+)\s*:/g)) defined.add(name)

      for (const name of captures(text, /["'](--[a-zA-Z0-9-]+)["']\s*:/g)) defined.add(name)

      for (const name of captures(text, /setProperty\(\s*["'](--[a-zA-Z0-9-]+)["']/g)) {
        defined.add(name)
      }

      for (const name of captures(text, /var\(\s*(--[a-zA-Z0-9-]+)/g)) {
        used.set(name, [...(used.get(name) ?? []), file])
      }
    }

    const missing = [...used.keys()]
      .filter((name) => !defined.has(name))
      .filter((name) => !EXTERNAL.some((prefix) => name.startsWith(prefix)))
      .sort()

    expect(missing, `未定义的变量：${missing.join("、")}`).toEqual([])
  })
})
