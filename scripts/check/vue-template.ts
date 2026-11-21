// 外部：vue-tsc 不编译模板事件表达式，只有 Vite 构建才报
import { readdirSync, readFileSync, statSync } from "node:fs"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import ts from "typescript"

// 外部：Vue 模板 ref 名对不上时编译与类型都不报错，只静默变 null
function checkRefNames(
  script: string,
  template: string | null,
  templateRefKeys: readonly string[],
): string[] {
  const messages: string[] = []
  const declared = new Set(script.match(/[A-Za-z_$][\w$]*/g) ?? [])

  if (!template) return messages

  const used = new Map<string, number>()

  for (const match of template.matchAll(/(?<![:\w-])ref="([^"]+)"/g)) {
    const key = match[1]!
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

function templateRefKeysOf(script: string): string[] {
  const file = ts.createSourceFile(
    "check.ts",
    script,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  )
  const keys: string[] = []

  function visit(node: ts.Node) {
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

const root = resolve(import.meta.dirname, "../..")
const compilerUrl = pathToFileURL(resolve(root, "apps/web/node_modules/vue/compiler-sfc")).href
const { parse, compileTemplate } = (await import(compilerUrl)) as {
  parse: (
    source: string,
    opts: { filename: string },
  ) => {
    errors: { message: string }[]
    descriptor: {
      template: { content: string } | null
      script: { content: string } | null
      scriptSetup: { content: string } | null
    }
  }
  compileTemplate: (opts: { source: string; filename: string; id: string }) => {
    errors: unknown[]
    tips: string[]
  }
}

function vueFiles(target: string): string[] {
  const stat = statSync(target)

  if (stat.isFile()) return target.endsWith(".vue") ? [target] : []
  const found: string[] = []

  for (const entry of readdirSync(target, { withFileTypes: true })) {
    const path = resolve(target, entry.name)

    if (entry.isDirectory()) found.push(...vueFiles(path))
    else if (entry.name.endsWith(".vue")) found.push(path)
  }

  return found
}

function lineOf(source: string, message: string): string {
  const match = /\((\d+):(\d+)\)/.exec(message)
  const line = match ? Number(match[1]) : 0
  const text = source.split(/\r?\n/)[line - 1]?.trim()
  return text ? `${message}\n  ${text}` : message
}

const targets = process.argv.slice(2).map((file) => resolve(root, file))
const files = targets.flatMap(vueFiles)
const failures: string[] = []

for (const file of files) {
  const source = readFileSync(file, "utf8")
  const parsed = parse(source, { filename: file })
  const messages = parsed.errors.map((error) => lineOf(source, error.message))
  const descriptor = parsed.descriptor
  const script = `${descriptor.script?.content ?? ""}\n${descriptor.scriptSetup?.content ?? ""}`
  const template = descriptor.template

  if (template) {
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
