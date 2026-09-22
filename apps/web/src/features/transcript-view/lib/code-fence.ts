export interface CodeFenceInfo {
  language: string
  isFileReference: boolean
  filePath: string | null
  fileName: string | null
  directory: string | null
  lineRange: string | null
}

const CODE_REFERENCE = /^(\d+):(\d+):(.+)$/
const EXTENSION_LANGUAGE: Record<string, string> = {
  bash: "bash",
  cjs: "javascript",
  css: "css",
  go: "go",
  html: "html",
  js: "javascript",
  json: "json",
  jsx: "jsx",
  md: "markdown",
  mjs: "javascript",
  py: "python",
  rs: "rust",
  scss: "scss",
  sh: "bash",
  sql: "sql",
  toml: "toml",
  ts: "typescript",
  tsx: "tsx",
  vue: "vue",
  xml: "xml",
  yaml: "yaml",
  yml: "yaml",
}

function basename(filePath: string): string {
  const parts = filePath.split(/[/\\]/)
  return parts[parts.length - 1] || filePath
}

function directoryFromPath(filePath: string, fileName: string): string | null {
  const dir = filePath
    .slice(0, Math.max(0, filePath.length - fileName.length))
    .replace(/[/\\]+$/, "")
  return dir.length > 0 ? dir : null
}

function extensionLanguage(fileName: string): string {
  const dot = fileName.lastIndexOf(".")

  if (dot <= 0 || dot === fileName.length - 1) return "text"
  return EXTENSION_LANGUAGE[fileName.slice(dot + 1).toLowerCase()] ?? "text"
}

function fileReference(filePath: string, lineRange: string | null): CodeFenceInfo {
  const fileName = basename(filePath)
  return {
    language: extensionLanguage(fileName),
    isFileReference: true,
    filePath,
    fileName,
    directory: directoryFromPath(filePath, fileName),
    lineRange,
  }
}

function looksLikeFileName(info: string): boolean {
  const dot = info.lastIndexOf(".")

  if (dot <= 0 || info.includes("/") || info.includes("\\")) return false
  const ext = info.slice(dot + 1).toLowerCase()
  return EXTENSION_LANGUAGE[ext] !== undefined
}

/** 识别 `起始行:结束行:路径`、带斜杠的路径，以及 `Foo.vue` 这种文件名。 */
export function parseCodeFenceInfo(rawInfo: string): CodeFenceInfo {
  const info = rawInfo.trim()
  const reference = info.match(CODE_REFERENCE)

  if (reference) {
    const start = reference[1] ?? ""
    const end = reference[2] ?? ""
    const filePath = reference[3] ?? ""
    const lineRange = start === end ? start : `${start}-${end}`
    return fileReference(filePath, lineRange)
  }

  if (info.includes("/") || info.includes("\\") || looksLikeFileName(info)) {
    return fileReference(info, null)
  }

  return {
    language: info.length > 0 ? info : "text",
    isFileReference: false,
    filePath: null,
    fileName: null,
    directory: null,
    lineRange: null,
  }
}

/** 文件围栏用扩展名做高亮语言，避免把整段路径交给语法高亮。 */
export function fenceHighlightNode<T extends { language: string }>(
  node: T,
  fence: CodeFenceInfo,
): T {
  if (!fence.isFileReference || node.language === fence.language) return node
  return { ...node, language: fence.language }
}
