import type { SupportedLanguages } from "stream-diffs/pierre"
import { toolPath } from "@features/transcript-view/lib/transcript-format.js"

export function pathBasename(path: string): string {
  return path.replace(/\\/g, "/").split("/").filter(Boolean).pop() || path
}

const FILE_LANGUAGES: Record<string, SupportedLanguages> = {
  js: "javascript",
  jsx: "jsx",
  mjs: "javascript",
  cjs: "javascript",
  ts: "typescript",
  tsx: "tsx",
  mts: "typescript",
  cts: "typescript",
  vue: "vue",
  json: "json",
  jsonc: "jsonc",
  md: "markdown",
  mdx: "mdx",
  css: "css",
  scss: "scss",
  html: "html",
  xml: "xml",
  svg: "xml",
  py: "python",
  rs: "rust",
  go: "go",
  java: "java",
  c: "c",
  h: "c",
  cpp: "cpp",
  cs: "csharp",
  sh: "shellscript",
  bash: "shellscript",
  ps1: "powershell",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
  sql: "sql",
}

export function readToolPreview(input: unknown, output: string) {
  let startLine = 1
  if (typeof input === "object" && input !== null && "offset" in input) {
    const offset = input.offset
    if (typeof offset === "number" && Number.isSafeInteger(offset) && offset > 0) startLine = offset
  }
  let code = output
  let totalLines: number | null = null
  const notice = output.match(
    /\r?\n\r?\n(\[(?:Showing lines \d+-\d+ of \d+(?: \([^\]\r\n]+\))?\. Use offset=\d+ to continue\.|\d+ more lines in file\. Use offset=\d+ to continue\.)\])$/,
  )
  if (notice) {
    code = output.slice(0, notice.index)
    const range = notice[1]?.match(/Showing lines (\d+)-\d+ of (\d+)/)
    const remaining = notice[1]?.match(/(\d+) more lines in file\. Use offset=(\d+)/)
    if (range) {
      startLine = Number(range[1])
      totalLines = Number(range[2])
    } else if (remaining) {
      totalLines = Number(remaining[1]) + Number(remaining[2]) - 1
    }
  }
  const path = toolPath(input)
  const language = fileLanguage(path)
  const extension = pathBasename(path).split(".").pop()?.toLowerCase() ?? ""

  return {
    code,
    lines: code ? code.split(/\r?\n/) : [],
    startLine,
    totalLines,
    language,
    languageLabel: language === "text" ? "text" : extension,
    notice: notice?.[1] ?? "",
  }
}

export function fileLanguage(path: string): SupportedLanguages {
  const extension = pathBasename(path).split(".").pop()?.toLowerCase() ?? ""
  return FILE_LANGUAGES[extension] ?? "text"
}

export type ReadToolPreview = ReturnType<typeof readToolPreview>
