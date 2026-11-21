const POSITION_SUFFIX = /:\d+(?::\d+|-\d+)?$/
const POSITION = /(?::(\d+)(?::(\d+)|-(\d+))?|#L(\d+)(?:-L?(\d+))?)$/
const WHITESPACE = /\s/
const SEPARATOR = /[\\/]/
const RELATIVE_PREFIX = /^(~\/|\.{1,2}\/)/
const ELIDED_SEGMENT = /(?:^|[\\/])(?:\.{3,}|…)(?:[\\/]|$)/
const FILE_EXTENSION = /\.[A-Za-z0-9_-]+$/
const ANY_FILE_EXTENSION = /\.[^./\\]+$/
const VERSION_SUFFIX = /\d\.\d[^.]*$/
const NUMERIC_DOTTED = /^\d+(?:\.\d+)+$/
const SPACED_ROOT = /^(?:\/|~\/|[A-Za-z]:[\\/])/
const SPACED_BODY =
  /^(?:[\p{L}\p{M}\p{N}._$+@()[\]-]+(?: (?!-+\p{L})[\p{L}\p{M}\p{N}._$+@()[\]-]+)*(?:[\\/]|$))+$/u
const WINDOWS_ABSOLUTE = /^(?:[A-Za-z]:[\\/]|\\\\)/
const EXTENSIONLESS_FILES = new Set([
  "Makefile",
  "makefile",
  "GNUmakefile",
  "Dockerfile",
  "Containerfile",
  "Justfile",
  "justfile",
  "Rakefile",
  "Gemfile",
  "Procfile",
  "Brewfile",
  "Caddyfile",
  "Vagrantfile",
  "Jenkinsfile",
  "Podfile",
  "Fastfile",
  "BUILD",
  "WORKSPACE",
  "LICENSE",
  "LICENCE",
  "COPYING",
  "NOTICE",
  "AUTHORS",
  "CONTRIBUTORS",
  "CHANGELOG",
  "README",
  "CODEOWNERS",
])
const GENERIC_TLDS = new Set([
  "com",
  "net",
  "org",
  "io",
  "dev",
  "app",
  "ai",
  "co",
  "edu",
  "gov",
  "mil",
  "info",
  "biz",
  "xyz",
  "me",
  "tv",
  "gg",
  "chat",
  "cloud",
  "site",
  "online",
  "tech",
  "store",
  "link",
])
const COUNTRY_TLDS = new Set([
  "uk",
  "de",
  "fr",
  "nl",
  "se",
  "no",
  "fi",
  "dk",
  "pl",
  "ch",
  "at",
  "be",
  "es",
  "it",
  "pt",
  "eu",
  "us",
  "ca",
  "au",
  "nz",
  "jp",
  "kr",
  "cn",
  "br",
  "ru",
  "mx",
  "ie",
  "cz",
  "tr",
  "sg",
  "hk",
  "cc",
])

export interface FilePosition {
  path: string
  line?: number
  column?: number
  endLine?: number
}

function looksLikeHostname(segment: string, hasPosition: boolean): boolean {
  if (segment.startsWith(".")) return false
  const lowered = segment.toLowerCase()

  if (lowered === "localhost" || NUMERIC_DOTTED.test(segment)) return true
  const labels = lowered.split(".")
  const last = labels.at(-1)

  if (labels.length < 2 || last === undefined) return false

  if (GENERIC_TLDS.has(last)) return true
  return !hasPosition && COUNTRY_TLDS.has(last)
}

function isSpacedAbsolutePath(text: string): boolean {
  const root = SPACED_ROOT.exec(text)?.[0]

  if (root === undefined) return false
  const body = text.slice(root.length).replace(POSITION_SUFFIX, "")

  if (!SPACED_BODY.test(body)) return false
  const firstSpace = body.indexOf(" ")
  const folders = body.slice(0, firstSpace).split(SEPARATOR).slice(0, -1)

  if (folders.some((folder) => folder === "bin" || folder === "sbin")) return false
  const spaceInFolder = SEPARATOR.test(body.slice(firstSpace))

  if (!spaceInFolder && root === "/" && !/^(?:Users|home)[\\/]/.test(body)) return false

  if (SEPARATOR.test(body.at(-1) ?? "")) return true
  const basename = body.split(SEPARATOR).at(-1) ?? ""
  return FILE_EXTENSION.test(basename) || EXTENSIONLESS_FILES.has(basename)
}

export function inlineCodeFilePath(code: string): string | null {
  const trimmed = code.trim()

  if (trimmed.length === 0 || /[`*]/.test(trimmed)) return null

  if (WHITESPACE.test(trimmed) && !isSpacedAbsolutePath(trimmed)) return null
  const candidate = WINDOWS_ABSOLUTE.test(trimmed) ? trimmed : trimmed.replaceAll("\\", "/")
  const hasPosition = POSITION_SUFFIX.test(candidate)

  if (!hasPosition && !SEPARATOR.test(candidate)) return null

  if (ELIDED_SEGMENT.test(candidate.replace(POSITION_SUFFIX, ""))) return null
  const bare = candidate.replace(POSITION_SUFFIX, "")

  if (
    RELATIVE_PREFIX.test(candidate) ||
    candidate.startsWith("/") ||
    WINDOWS_ABSOLUTE.test(candidate)
  )
    return candidate

  if (SEPARATOR.test(bare.at(-1) ?? "")) return null
  const basename = bare.split(SEPARATOR).at(-1) ?? ""
  const named = FILE_EXTENSION.test(basename) || EXTENSIONLESS_FILES.has(basename)

  if (looksLikeHostname(bare.split("/")[0] ?? bare, hasPosition)) return null

  if (VERSION_SUFFIX.test(basename)) return null

  if (named) return candidate
  return hasPosition && ANY_FILE_EXTENSION.test(basename) ? candidate : null
}

export function filePosition(raw: string): FilePosition {
  const match = POSITION.exec(raw)

  if (!match) return { path: raw }
  const line = Number(match[1] ?? match[4])
  const column = match[2] === undefined ? undefined : Number(match[2])
  const endLine = Number(match[3] ?? match[5]) || undefined
  return {
    path: raw.slice(0, match.index),
    ...(line > 0 ? { line } : {}),
    ...(column ? { column } : {}),
    ...(line > 0 && endLine && endLine > line ? { endLine } : {}),
  }
}

export function fileBasename(path: string): string {
  return (
    path
      .replace(/[\\/]+$/, "")
      .split(SEPARATOR)
      .at(-1) ?? path
  )
}

export function fileExtension(path: string): string {
  const name = fileBasename(path)
  return name.includes(".") ? (name.split(".").pop() ?? "text") : "text"
}

export function fileLinkLabel(raw: string): string {
  const { path, line, column, endLine } = filePosition(raw)
  const position = line
    ? `L${line}${endLine ? `–${endLine}` : column ? `:C${column}` : ""}`
    : undefined
  return [fileBasename(path), position].filter(Boolean).join(" · ").normalize("NFC")
}

export function isFileLinkLabel(label: string, href: string): boolean {
  const target = filePosition(href.trim())
  const shown = filePosition(label.trim())

  if (
    (shown.line !== undefined && shown.line !== target.line) ||
    (shown.column !== undefined && shown.column !== target.column) ||
    (shown.endLine !== undefined && shown.endLine !== target.endLine)
  )
    return false

  const normalize = (path: string) =>
    path.replaceAll("\\", "/").replace(/^\.\//, "").replace(/\/+$/, "").toLowerCase()
  const shownPath = normalize(shown.path)
  const targetPath = normalize(target.path)

  if (shownPath.length === 0) return true
  return targetPath === shownPath || targetPath.endsWith(`/${shownPath}`)
}

export function looksLikeFolder(raw: string): boolean {
  const { path, line } = filePosition(raw)
  const name = fileBasename(path)
  return (
    !line &&
    (SEPARATOR.test(path.at(-1) ?? "") ||
      (!FILE_EXTENSION.test(name) && !EXTENSIONLESS_FILES.has(name)))
  )
}
