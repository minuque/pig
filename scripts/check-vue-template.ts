/** 用 Vue 模板编译器检查 SFC。vue-tsc 不编译事件表达式，Vite 才会报。 */
import { readdirSync, readFileSync, statSync } from "node:fs"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"

const root = resolve(import.meta.dirname, "..")
const compilerUrl = pathToFileURL(resolve(root, "apps/web/node_modules/vue/compiler-sfc")).href
const { parse, compileTemplate } = (await import(compilerUrl)) as typeof import("vue/compiler-sfc")

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
  const template = parsed.descriptor.template

  if (template) {
    const compiled = compileTemplate({
      source: template.content,
      filename: file,
      id: "check",
    })

    for (const error of compiled.errors) {
      messages.push(lineOf(source, error instanceof Error ? error.message : String(error)))
    }
  }

  if (messages.length) failures.push(`${file}\n${messages.join("\n")}`)
}

if (failures.length) {
  console.error(failures.join("\n\n"))
  process.exitCode = 1
}
