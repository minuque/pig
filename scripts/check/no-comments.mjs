import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { relative, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import stylelint from "stylelint"
import ts from "typescript"

import { lintIgnores } from "./lint-ignores.mjs"

const ALLOWED = [
  /^\s*prettier-ignore\b/,
  /^\s*(eslint|eslint-disable|eslint-enable|eslint-disable-line|eslint-disable-next-line|oxlint-disable|oxlint-enable|oxlint-disable-line|oxlint-disable-next-line|global|globals)\b/,
  /^\s*stylelint-(disable|enable)/,
  /^\s*@ts-(expect-error|ignore|nocheck|check)\b/,
  /^\/\s*<reference\b/,
  /SPDX-License-Identifier|@license\b|Copyright\s+(\(c\)|©)/i,
  /^\s*\*?\s*外部：/,
  /https?:\/\/\S*(\/issues\/|\/pull\/|\/discussions\/|rfc-editor\.org|datatracker\.ietf\.org|\/rfcs?\/|crbug\.com|bugzilla\.)/i,
]
const MESSAGE =
  "删掉注释：只放行许可证、外部约束（以「外部：」开头）、prettier-ignore、有理由的 lint 抑制、公开契约文档和 issue/RFC 链接。见 /delete-comment。"
const TYPE_TAG =
  /^@(type|typedef|param|returns?|template|satisfies|import|property|overload|callback)\b/
const SCRIPT_EXT = /\.(?:[cm]?[jt]sx?)$/
const VUE_EXT = /\.vue$/
const root = resolve(import.meta.dirname, "../..")

function isTypeAnnotation(text) {
  if (!text.startsWith("*")) return false

  const lines = text
    .slice(1)
    .split("\n")
    .map((line) => line.replace(/^\s*\*?\s*/, "").trim())
    .filter(Boolean)
  return lines.length > 0 && lines.every((line) => TYPE_TAG.test(line))
}

export function isAllowedComment(text) {
  return ALLOWED.some((pattern) => pattern.test(text)) || isTypeAnnotation(text)
}

const ruleName = "pig/no-comments"
const messages = stylelint.utils.ruleMessages(ruleName, { comment: MESSAGE })
const SECTION_HEADER = /^\s*(=+|-+)\s/
const stylelintRule = (enabled, options) => (rootNode, result) => {
  if (!enabled) return
  rootNode.walkComments((comment) => {
    if (isAllowedComment(comment.text)) return

    if (options?.sectionHeaders && SECTION_HEADER.test(comment.text)) return
    stylelint.utils.report({ ruleName, result, node: comment, message: messages.comment })
  })
}

stylelintRule.ruleName = ruleName
stylelintRule.messages = messages

export const stylelintPlugin = stylelint.createPlugin(ruleName, stylelintRule)

function scriptKindOf(filePath) {
  if (filePath.endsWith(".tsx")) return ts.ScriptKind.TSX

  if (filePath.endsWith(".jsx")) return ts.ScriptKind.JSX

  if (/\.m?ts$/.test(filePath) || /\.cts$/.test(filePath)) return ts.ScriptKind.TS
  return ts.ScriptKind.JS
}

function collectScriptViolations(text, { filePath, contractDocs = false, lineOffset = 0 }) {
  const sourceFile = ts.createSourceFile(
    filePath,
    text,
    ts.ScriptTarget.Latest,
    false,
    scriptKindOf(filePath),
  )
  const seen = new Set()
  const violations = []
  const inspect = (range) => {
    if (seen.has(range.pos)) return
    seen.add(range.pos)

    const raw = text.slice(range.pos, range.end)
    const isBlock = range.kind === ts.SyntaxKind.MultiLineCommentTrivia
    const body = isBlock ? raw.slice(2, -2) : raw.slice(2)

    if (isAllowedComment(body)) return

    if (contractDocs && isBlock && body.startsWith("*")) return
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(range.pos)
    violations.push({ line: lineOffset + line + 1, column: character + 1 })
  }
  const visit = (node) => {
    for (const range of ts.getLeadingCommentRanges(text, node.pos) ?? []) inspect(range)

    for (const range of ts.getTrailingCommentRanges(text, node.end) ?? []) inspect(range)

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return violations
}

function walkTemplateComments(node, out) {
  if (!node || typeof node !== "object") return

  if (node.type === 3) out.push(node)

  if (Array.isArray(node.children)) {
    for (const child of node.children) walkTemplateComments(child, out)
  }
}

let cachedParse

async function getVueParse() {
  if (cachedParse) return cachedParse
  const url = pathToFileURL(resolve(root, "apps/web/node_modules/vue/compiler-sfc/index.mjs")).href
  const mod = await import(url)
  cachedParse = mod.parse
  return cachedParse
}

export async function checkCommentsInSource(filePath, source, { contractDocs } = {}) {
  const normalized = filePath.replaceAll("\\", "/")
  const docs = contractDocs ?? normalized.startsWith("packages/protocol/src/")

  if (VUE_EXT.test(normalized)) {
    const parse = await getVueParse()
    const { descriptor } = parse(source, { filename: normalized })
    const violations = []

    if (descriptor.template?.ast) {
      const comments = []

      walkTemplateComments(descriptor.template.ast, comments)

      for (const comment of comments) {
        if (!isAllowedComment(comment.content)) {
          violations.push({ line: comment.loc.start.line, column: comment.loc.start.column })
        }
      }
    }

    for (const block of [descriptor.script, descriptor.scriptSetup]) {
      if (!block) continue
      const ext = block.lang === "tsx" ? ".tsx" : block.lang === "ts" ? ".ts" : ".js"
      violations.push(
        ...collectScriptViolations(block.content, {
          filePath: `${normalized}${ext}`,
          contractDocs: docs,
          lineOffset: block.loc.start.line - 1,
        }),
      )
    }

    return violations.sort((a, b) => a.line - b.line || a.column - b.column)
  }

  if (SCRIPT_EXT.test(normalized)) {
    return collectScriptViolations(source, { filePath: normalized, contractDocs: docs })
  }

  return []
}

function buildIgnoreMatcher() {
  const dirs = new Set()
  const names = new Set()

  for (const pattern of lintIgnores) {
    if (pattern.startsWith("**/")) {
      const rest = pattern.slice(3)

      if (rest.endsWith("/**")) dirs.add(rest.slice(0, -3))
      else names.add(rest)
    } else if (pattern.endsWith("/**")) {
      dirs.add(pattern.slice(0, -3))
    } else {
      names.add(pattern)
    }
  }

  return (relPath, entryName, isDir) => {
    if (isDir) return dirs.has(relPath) || dirs.has(entryName)

    if (names.has(relPath) || names.has(entryName)) return true

    const parts = relPath.split("/")

    for (let i = 0; i < parts.length - 1; i += 1) {
      if (dirs.has(parts[i]) || dirs.has(parts.slice(0, i + 1).join("/"))) return true
    }

    return false
  }
}

function collectFiles(targets) {
  const isIgnored = buildIgnoreMatcher()
  const out = []
  const walk = (abs) => {
    const rel = relative(root, abs).replaceAll("\\", "/")

    if (!existsSync(abs)) return
    const stat = statSync(abs)

    if (stat.isDirectory()) {
      const name = rel.split("/").pop() ?? ""

      if (rel && isIgnored(rel, name, true)) return

      for (const entry of readdirSync(abs, { withFileTypes: true })) {
        walk(resolve(abs, entry.name))
      }

      return
    }

    const name = rel.split("/").pop() ?? ""

    if (isIgnored(rel, name, false)) return

    if (SCRIPT_EXT.test(rel) || VUE_EXT.test(rel)) out.push(rel)
  }

  for (const target of targets) walk(resolve(root, target))

  return out
}

async function main() {
  const args = process.argv.slice(2)
  const files = collectFiles(args.length ? args : ["."])
  const failures = []

  for (const file of files) {
    const violations = await checkCommentsInSource(file, readFileSync(resolve(root, file), "utf8"))

    for (const v of violations) failures.push(`${file}:${v.line}:${v.column} ${MESSAGE}`)
  }

  if (failures.length) {
    console.error(failures.join("\n"))
    process.exitCode = 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main()
}
