/**
 * 验证 apps/web/src/style/app.css 的 token 与 DESIGN.md 官方导出一致。
 * 用法: pnpm check:design-tokens（根目录）
 * 数据源: designmd export DESIGN.md --format css-tailwind（根 devDependency @google/design.md）
 * DESIGN.md 不存在时跳过。
 *
 * app.css 里度量用派生写法（var(--text-sm)、calc(var(--radius) - 4px)、calc(var(--spacing) * 4)），
 * 而 DESIGN.md 只能写字面长度。所以比较前先把两边都解析成像素再比。
 *
 * 已知刻意差异（不视为不一致）:
 *  - --font-<role>: SystemUI / GeistMono → 专有/角色字体名, 工作台用 --font-sans / --font-mono
 *  - --font-weight-<role>                → 值与 Tailwind 默认一致, 通用 4 档 --font-weight-* 已覆盖
 */
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const appCss = resolve(root, "apps/web/src/style/app.css")
const designMd = resolve(root, "DESIGN.md")
const twTheme = resolve(root, "apps/web/node_modules/tailwindcss/theme.css")

if (!existsSync(designMd)) {
  console.log("✓ DESIGN.md 尚未生成，跳过 token 校验")
  process.exit(0)
}

const official = execFileSync(
  process.execPath,
  [
    resolve(root, "node_modules/@google/design.md/dist/index.js"),
    "export",
    "DESIGN.md",
    "--format",
    "css-tailwind",
  ],
  { cwd: root, encoding: "utf8" },
)

/** 解析 CSS 变量, 取首次出现 */
function parseVars(css) {
  const out = new Map()

  for (const m of css.matchAll(/^\s*(--[\w-]+):\s*([^;]+);/gm)) {
    if (!out.has(m[1])) out.set(m[1], m[2].trim().replace(/^"|"$/g, ""))
  }

  return out
}

const cssText = readFileSync(appCss, "utf8")
const officialVars = parseVars(official)
const curVars = parseVars(cssText)
/* Tailwind 默认主题垫底，让 var(--text-sm)、var(--spacing) 这类引用能解析 */
const resolveVars = new Map([...parseVars(readFileSync(twTheme, "utf8")), ...curVars])
const REM_PX = 16

function toPx(value) {
  const m = /^(-?[\d.]+)(px|rem|em)?$/.exec(String(value).trim())

  if (!m) return null
  const n = Number.parseFloat(m[1])
  return m[2] === "rem" || m[2] === "em" ? n * REM_PX : n
}

function evalCalc(expr) {
  const m = /^(.+?)\s*([*/+-])\s*(.+)$/.exec(expr.trim())

  if (!m) return null
  const a = toPx(m[1])
  const b = toPx(m[3])

  if (a === null || b === null) return null

  if (m[2] === "*") return a * b

  if (m[2] === "/") return b === 0 ? null : a / b
  return m[2] === "+" ? a + b : a - b
}

/** 把 var() / calc() 解析开；长度归一成像素，其余回退字符串 */
function resolveValue(value, depth = 0) {
  if (depth > 12) return String(value).trim()
  const v = String(value).trim()
  const asVar = /^var\((--[\w-]+)(?:\s*,\s*([^)]+))?\)$/.exec(v)

  if (asVar) {
    const inner = resolveVars.get(asVar[1])

    if (inner === undefined) return asVar[2] === undefined ? v : resolveValue(asVar[2], depth + 1)
    return resolveValue(inner, depth + 1)
  }

  const asCalc = /^calc\((.+)\)$/.exec(v)

  if (asCalc) {
    const substituted = asCalc[1].replace(
      /var\((--[\w-]+)(?:\s*,\s*([^)]+))?\)/g,
      (_, name, fb) => resolveVars.get(name) ?? fb ?? "",
    )
    const px = evalCalc(substituted)
    return px === null ? v : `${px}px`
  }

  return v
}

function normalize(value) {
  const resolved = resolveValue(value)
  const px = toPx(resolved)
  return px === null ? resolved : `${Math.round(px * 1000) / 1000}px`
}

/** DESIGN.md 的 letterSpacing 导出成 --tracking-<role>，app.css 里是 --text-<role>--letter-spacing */
function ourNames(name) {
  if (name.startsWith("--color-")) return ["--" + name.slice("--color-".length)]
  const tracking = /^--tracking-(.+)$/.exec(name)

  if (tracking) return [`--text-${tracking[1]}--letter-spacing`, name]
  return [name]
}

const SKIPPED_PREFIXES = ["--font-", "--font-weight-"]
const missing = []
const differ = []

for (const [name, value] of officialVars) {
  if (SKIPPED_PREFIXES.some((p) => name.startsWith(p))) continue

  const candidates = ourNames(name).filter((n) => curVars.has(n))

  if (candidates.length === 0) {
    missing.push(`${name}: ${value}`)
    continue
  }

  const want = normalize(value)

  if (!candidates.some((n) => normalize(curVars.get(n)) === want)) {
    differ.push(
      `${name}: official=${value} app.css=${candidates.map((n) => `${n}=${curVars.get(n)}`).join(", ")}`,
    )
  }
}

const themeBlock = cssText.match(/@theme inline \{([\s\S]*?)\n\}/)?.[1] ?? ""
const defs = new Map()

for (const block of cssText.matchAll(/(?::root|\.dark) \{([\s\S]*?)\n\}/g)) {
  for (const [name, value] of parseVars(block[1]))
    defs.set(`${name} ${block[0].slice(0, 5)}`, value)
}

const mixTheme = []

for (const m of themeBlock.matchAll(/--color-[\w-]+:\s*var\((--[\w-]+)\)/g)) {
  const target = m[1]

  for (const [key, value] of defs) {
    if (key.startsWith(`${target} `) && /color-mix\s*\(/i.test(value)) {
      /* --contrast-* 是文字对比度层：:root 上的派生色，允许被工具类引用。 */
      if (target.startsWith("--contrast-")) continue
      mixTheme.push(`${m[0].trim()} → ${key} = ${value}`)
    }
  }
}

if (mixTheme.length) {
  console.error("✗ @theme --color-* 指向 color-mix 变量（会把 app.css 打空）:")

  for (const l of mixTheme) console.error(`  ${l}`)
  process.exit(1)
}

if (missing.length === 0 && differ.length === 0) {
  console.log(`✓ DESIGN.md tokens 与 app.css :root 一致（${officialVars.size} 项比对）`)
  process.exit(0)
}

console.error(`✗ DESIGN.md tokens 与 app.css :root 不一致:`)

for (const l of missing) console.error(`  缺失  ${l}`)

for (const l of differ) console.error(`  差异  ${l}`)

process.exit(1)
