// 外部：vue-tsc 不编译模板事件表达式，只有 Vite 构建才报
import { readdirSync, readFileSync, statSync } from "node:fs"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import ts from "typescript"

// 外部：Vue 模板 ref 名对不上时编译与类型都不报错，只静默变 null
function checkRefNames(script, template, templateRefKeys) {
  const messages = []
  const declared = new Set(script.match(/[A-Za-z_$][\w$]*/g) ?? [])

  if (!template) return messages

  const used = new Map()

  for (const match of template.matchAll(/(?<![:\w-])ref="([^"]+)"/g)) {
    const key = match[1]
    used.set(key, (used.get(key) ?? 0) + 1)

    if (!declared.has(key)) messages.push(`模板 ref="${key}" 在脚本里没有用上`)
  }

  for (const [key, count] of used) {
    if (count > 1) messages.push(`模板 ref="${key}" 出现 ${count} 次`)
  }

  for (const key of templateRefKeys) {
    if (!used.has(key)) messages.push(`useTemplateRef("${key}") 在模板里没有同名 ref`)
  }

  return messages
}

function templateRefKeysOf(script) {
  const file = ts.createSourceFile(
    "check.ts",
    script,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  )
  const keys = []

  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "useTemplateRef"
    ) {
      const arg = node.arguments[0]

      if (arg && (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)))
        keys.push(arg.text)
    }

    ts.forEachChild(node, visit)
  }

  visit(file)
  return keys
}

function checkBlockOrder(descriptor) {
  const blocks = [
    descriptor.template ? { kind: "template", pos: descriptor.template.loc.start.offset } : null,
    descriptor.script ? { kind: "script", pos: descriptor.script.loc.start.offset } : null,
    descriptor.scriptSetup
      ? { kind: "script", pos: descriptor.scriptSetup.loc.start.offset }
      : null,
    ...descriptor.styles.map((style) => ({ kind: "style", pos: style.loc.start.offset })),
  ]
    .filter(Boolean)
    .sort((a, b) => a.pos - b.pos)
  const rank = { template: 0, script: 1, style: 2 }

  for (let i = 1; i < blocks.length; i += 1) {
    if (rank[blocks[i].kind] < rank[blocks[i - 1].kind]) {
      return ["SFC 块顺序必须为 <template> → <script> → <style>"]
    }
  }

  return []
}

function hasMultipleStatements(expression) {
  const file = ts.createSourceFile(
    "expr.ts",
    expression,
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.TS,
  )
  return file.statements.length > 1
}

function checkTemplateAst(ast) {
  const messages = []
  const walk = (children, blockSuppressed = false) => {
    let suppressed = blockSuppressed
    let nextSuppressed = false

    for (const node of children ?? []) {
      if (node.type === 3) {
        const text = node.content.trim()

        if (/^(?:eslint|oxlint)-disable\b.*\bvue\/no-v-html\b/.test(text)) suppressed = true
        else if (/^(?:eslint|oxlint)-enable\b.*\bvue\/no-v-html\b/.test(text)) suppressed = false
        else if (/^(?:eslint|oxlint)-disable-next-line\b.*\bvue\/no-v-html\b/.test(text))
          nextSuppressed = true
        continue
      }

      if (node.type === 2 && !node.content.trim()) continue

      const allowVHtml = suppressed || nextSuppressed
      nextSuppressed = false

      if (node.type === 1) {
        for (const prop of node.props ?? []) {
          if (prop.type !== 7) continue

          if (prop.name === "html" && !allowVHtml) {
            messages.push(
              `(${prop.loc.start.line}:${prop.loc.start.column}) 禁止使用 v-html（仅允许有理由的 lint 抑制）`,
            )
          }

          if (
            prop.name === "on" &&
            prop.exp?.type === 4 &&
            hasMultipleStatements(prop.exp.content)
          ) {
            messages.push(
              `(${prop.loc.start.line}:${prop.loc.start.column}) 事件绑定只允许一条语句，多条逻辑移到方法里`,
            )
          }
        }
      }

      if (node.children) walk(node.children, suppressed)

      if (node.branches) {
        for (const branch of node.branches) walk(branch.children, suppressed)
      }
    }
  }

  walk(ast.children)
  return messages
}

const root = resolve(import.meta.dirname, "../..")
const compilerUrl = pathToFileURL(
  resolve(root, "apps/web/node_modules/vue/compiler-sfc/index.mjs"),
).href
const { parse, compileTemplate } = await import(compilerUrl)

function vueFiles(target) {
  const stat = statSync(target)

  if (stat.isFile()) return target.endsWith(".vue") ? [target] : []
  const found = []

  for (const entry of readdirSync(target, { withFileTypes: true })) {
    const path = resolve(target, entry.name)

    if (entry.isDirectory()) found.push(...vueFiles(path))
    else if (entry.name.endsWith(".vue")) found.push(path)
  }

  return found
}

function lineOf(source, message) {
  const match = /\((\d+):(\d+)\)/.exec(message)
  const line = match ? Number(match[1]) : 0
  const text = source.split(/\r?\n/)[line - 1]?.trim()
  return text ? `${message}\n  ${text}` : message
}

const targets = process.argv.slice(2).map((file) => resolve(root, file))
const files = targets.flatMap(vueFiles)
const failures = []

for (const file of files) {
  const source = readFileSync(file, "utf8")
  const parsed = parse(source, { filename: file })
  const messages = parsed.errors.map((error) => lineOf(source, error.message))
  const descriptor = parsed.descriptor
  const script = `${descriptor.script?.content ?? ""}\n${descriptor.scriptSetup?.content ?? ""}`
  const template = descriptor.template

  messages.push(...checkBlockOrder(descriptor))

  if (template) {
    if (template.ast) messages.push(...checkTemplateAst(template.ast))

    const compiled = compileTemplate({
      source: template.content,
      filename: file,
      id: "check",
    })

    for (const error of compiled.errors) {
      messages.push(lineOf(source, error instanceof Error ? error.message : String(error)))
    }

    for (const tip of compiled.tips) {
      messages.push(`tip: ${tip}`)
    }
  }

  messages.push(...checkRefNames(script, template?.content ?? null, templateRefKeysOf(script)))

  if (messages.length) failures.push(`${file}\n${messages.join("\n")}`)
}

if (failures.length) {
  console.error(failures.join("\n\n"))
  process.exitCode = 1
}
