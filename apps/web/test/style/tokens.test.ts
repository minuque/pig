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
/** 由外部代码读取或运行期拼接的变量：Solar 图标库读 --solar-*，composer-flip 拼 --duration-dock-*。 */
const EXTERNAL_READERS = ["--solar-", "--duration-dock-"]

/** 扫一遍源码：定义处（含运行期写入）与 var() 引用处。 */
function scan() {
  const defined = new Set<string>()
  const used = new Map<string, string[]>()

  for (const file of walk(SRC)) {
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

  return { defined, used }
}

describe("CSS 变量引用", () => {
  it("用到的变量都有定义，或由 rt / reka / 运行期提供", () => {
    const { defined, used } = scan()
    const missing = [...used.keys()]
      .filter((name) => !defined.has(name))
      .filter((name) => !EXTERNAL.some((prefix) => name.startsWith(prefix)))
      .sort()

    expect(missing, `未定义的变量：${missing.join("、")}`).toEqual([])
  })

  it("app.css 定义的 token 都有引用，外部读取的除外", () => {
    const { used } = scan()
    const appCss = readFileSync(join(SRC, "style/app.css"), "utf8")
    const defined = [...new Set(captures(appCss, /^\s*(--[a-zA-Z0-9-]+)\s*:/gm))]
    const unused = defined
      .filter((name) => !EXTERNAL_READERS.some((prefix) => name.startsWith(prefix)))
      .filter((name) => !used.has(name))
      .sort()

    expect(unused, `无人引用的变量：${unused.join("、")}`).toEqual([])
  })
})
