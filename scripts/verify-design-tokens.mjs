/**
 * 验证 apps/web/src/style/app.css 的 :root token 与 DESIGN.md 官方导出一致。
 * 用法: pnpm check:design-tokens（根目录）
 * 数据源: designmd export DESIGN.md --format css-tailwind（根 devDependency @google/design.md）
 *
 * 已知刻意差异（不视为不一致）:
 *  - --font-<role>: SystemUI / GeistMono → 专有/角色字体名, 工作台用 --font-sans / --font-mono
 *  - --font-weight-<role>                → 值与 Tailwind 默认一致, 通用 4 档 --font-weight-* 已覆盖
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const appCss = resolve(root, "apps/web/src/style/app.css");

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
);

/** 解析 CSS 变量, 取首次出现（:root 定义; @theme inline 是引用） */
function parseVars(css) {
  const out = new Map();
  for (const m of css.matchAll(/^\s*(--[\w-]+):\s*([^;]+);/gm)) {
    if (!out.has(m[1])) out.set(m[1], m[2].trim().replace(/^"|"$/g, ""));
  }
  return out;
}

const officialVars = parseVars(official);
const curVars = parseVars(readFileSync(appCss, "utf8"));

const SKIPPED_PREFIXES = ["--font-", "--font-weight-"];
const missing = [];
const differ = [];
for (const [name, value] of officialVars) {
  if (SKIPPED_PREFIXES.some((p) => name.startsWith(p))) continue;
  const ourName = name.startsWith("--color-") ? "--" + name.slice("--color-".length) : name;
  if (!curVars.has(ourName)) {
    missing.push(`${name}: ${value}`);
  } else if (curVars.get(ourName) !== value) {
    differ.push(`${name}: official=${value} app.css=${curVars.get(ourName)}`);
  }
}

const cssText = readFileSync(appCss, "utf8");
const themeBlock = cssText.match(/@theme inline \{([\s\S]*?)\n\}/)?.[1] ?? "";
const defs = new Map();
for (const block of cssText.matchAll(/(?::root|\.dark) \{([\s\S]*?)\n\}/g)) {
  for (const [name, value] of parseVars(block[1]))
    defs.set(`${name} ${block[0].slice(0, 5)}`, value);
}
const mixTheme = [];
for (const m of themeBlock.matchAll(/--color-[\w-]+:\s*var\((--[\w-]+)\)/g)) {
  const target = m[1];
  for (const [key, value] of defs) {
    if (key.startsWith(`${target} `) && /color-mix\s*\(/i.test(value)) {
      mixTheme.push(`${m[0].trim()} → ${key} = ${value}`);
    }
  }
}

if (mixTheme.length) {
  console.error("✗ @theme --color-* 指向 color-mix 变量（会把 app.css 打空）:");
  for (const l of mixTheme) console.error(`  ${l}`);
  process.exit(1);
}

if (missing.length === 0 && differ.length === 0) {
  console.log(`✓ DESIGN.md tokens 与 app.css :root 一致（${officialVars.size} 项比对）`);
  process.exit(0);
}
console.error(`✗ DESIGN.md tokens 与 app.css :root 不一致:`);
for (const l of missing) console.error(`  缺失  ${l}`);
for (const l of differ) console.error(`  差异  ${l}`);
process.exit(1);
