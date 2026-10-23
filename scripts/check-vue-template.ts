/** 用 Vue 模板编译器检查 SFC。vue-tsc 不编译事件表达式，Vite 才会报。 */
import { readdirSync, readFileSync, statSync } from "node:fs"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"

/* 模板 ref 名写错时两侧都不报错，只静默变 null，所以按名字对齐校验。 */
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

type TemplateRefKey = string

function templateRefKeysOf(source: string): TemplateRefKey[] {
  return [...source.matchAll(/useTemplateRef(?:<[^()]*>)?\(\s*["'`]([^"'`]+)["'`]/g)].map(
    (match) => match[1]!,
  )
}

const root = resolve(import.meta.dirname, "..")
const compilerUrl = pathToFileURL(resolve(root, "apps/web/node_modules/vue/compiler-sfc")).href
// vue 的类型在 apps/web 下，脚本 tsconfig 解析不到；用最小结构描述用到的 API
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

    // tips 是 dev 期 warning（如非法嵌套元素），线上会出 hydration 问题，一并计入失败
    for (const tip of compiled.tips) {
      messages.push(`tip: ${tip}`)
    }
  }

  messages.push(...checkRefNames(script, template?.content ?? null, templateRefKeysOf(source)))

  if (messages.length) failures.push(`${file}\n${messages.join("\n")}`)
}

if (failures.length) {
  console.error(failures.join("\n\n"))
  process.exitCode = 1
}
