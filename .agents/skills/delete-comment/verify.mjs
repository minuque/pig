import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { join, resolve } from "node:path"

const root = resolve(import.meta.dirname, "../../..")
const ref = process.argv[2] ?? "HEAD"
const fromRoot = createRequire(join(root, "package.json"))
const ts = fromRoot("typescript")
const postcss = createRequire(fromRoot.resolve("stylelint"))("postcss")
const { parse: parseSfc } = createRequire(join(root, "apps/web/package.json"))("vue/compiler-sfc")
const printer = ts.createPrinter({ removeComments: true })
const DIRECTIVE =
  /prettier-ignore|eslint-(disable|enable)|stylelint-(disable|enable)|@ts-|<reference/

function git(...args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 1 << 28 })
}

function printScript(code, name) {
  const kind = /\.(tsx|jsx)$/.test(name) ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  return printer.printFile(ts.createSourceFile(name, code, ts.ScriptTarget.Latest, false, kind))
}

function printCss(code) {
  const tree = postcss.parse(code)

  tree.walkComments((comment) => comment.remove())
  tree.walk((node) => {
    node.raws = {}
  })
  return tree.toString().replace(/\s+/g, " ")
}

function printTemplate(code) {
  return code.replace(/<!--[\s\S]*?-->/g, "").replace(/\s+/g, " ")
}

function directives(code) {
  return (code.match(/(\/\/.*|\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->)/g) ?? []).filter((c) =>
    DIRECTIVE.test(c),
  )
}

function shape(code, file) {
  if (file.endsWith(".css")) return printCss(code)
  if (!file.endsWith(".vue")) return printScript(code, file)
  const { descriptor } = parseSfc(code, { filename: file })
  return [
    descriptor.template ? printTemplate(descriptor.template.content) : "",
    ...[descriptor.script, descriptor.scriptSetup].map((b) =>
      b ? printScript(b.content, "x.ts") : "",
    ),
    ...descriptor.styles.map((s) => printCss(s.content)),
  ].join("\n<<block>>\n")
}

const changed = git("diff", "--name-only", ref, "--", ".")
  .split(/\r?\n/)
  .filter((f) => /\.(ts|tsx|js|mjs|cjs|vue|css)$/.test(f))
let bad = 0

for (const file of changed) {
  const path = join(root, file)

  if (!existsSync(path)) {
    console.log(`DELETED  ${file}`)
    bad++
    continue
  }

  const before = git("show", `${ref}:${file}`)
  const after = readFileSync(path, "utf8")
  const lost = directives(before).filter((d) => !directives(after).includes(d))

  for (const d of lost) console.log(`DIRECTIVE ${file}: ${d.trim().slice(0, 100)}`)

  if (shape(before, file) !== shape(after, file)) {
    console.log(`CODE     ${file}`)
    bad++
  }
}

console.log(`${changed.length} files checked, ${bad} with code changes`)
process.exitCode = bad ? 1 : 0
