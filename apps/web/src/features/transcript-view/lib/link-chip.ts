export interface LinkChipDescriptor {
  label: string
  isGitHub: boolean
}

const HTTP_URL = /https?:\/\/[^\s<>()[\]]+/gi
const TRAILING_PUNCTUATION = /[.,;:!?'"]+$/

export interface LinkTextPart {
  kind: "text" | "link"
  text: string
}

function parseUrl(raw: string): URL | null {
  try {
    return new URL(raw)
  } catch {
    return null
  }
}

function stripGitSuffix(repo: string): string {
  return repo.endsWith(".git") ? repo.slice(0, -4) : repo
}

function isGitHubHost(url: string): boolean {
  const parsed = parseUrl(url)

  if (!parsed) return false
  const host = parsed.hostname.toLowerCase()
  return host === "github.com" || host === "www.github.com"
}

function shortenGitHubLink(url: string): string | null {
  if (!isGitHubHost(url)) return null
  const parsed = parseUrl(url)

  if (!parsed) return null
  const parts = parsed.pathname.split("/").filter((part) => part.length > 0)
  const owner = parts[0]

  if (!owner) return null
  const repo = parts[1] ? stripGitSuffix(parts[1]) : undefined

  if (!repo) return owner
  const kind = parts[2]

  if (!kind) return `${owner}/${repo}`
  const ref = parts[3]

  if ((kind === "pull" || kind === "issues") && ref && /^\d+$/.test(ref)) {
    return `${owner}/${repo}#${ref}`
  }

  if (kind === "commit" && ref && /^[0-9a-f]{7,40}$/i.test(ref)) {
    return `${owner}/${repo}@${ref.slice(0, 7)}`
  }

  return null
}

function prettifyUrl(url: string): string {
  return url
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/$/, "")
}

/** GitHub 常见地址收成 owner/repo。其余 GitHub 地址保留路径，仍用同一枚标。 */
export function describeLinkChip(url: string): LinkChipDescriptor {
  const shortened = shortenGitHubLink(url)

  if (shortened) return { label: shortened, isGitHub: true }
  return { label: prettifyUrl(url), isGitHub: isGitHubHost(url) }
}

/** 链接文字就是地址本身时用缩短标签，手写标签保留原文。 */
export function linkChipLabel(href: string, text: string | undefined): string {
  const plain = (text ?? "").trim()

  if (
    plain.length === 0 ||
    plain === href ||
    href === `https://${plain}` ||
    href === `http://${plain}`
  ) {
    return describeLinkChip(href).label
  }

  return plain
}

function splitUrlToken(raw: string): { url: string; rest: string } {
  const trailing = raw.match(TRAILING_PUNCTUATION)

  if (!trailing) return { url: raw, rest: "" }
  return { url: raw.slice(0, -trailing[0].length), rest: trailing[0] }
}

/** 把纯文本里的 http(s) 地址切出来，其余空白原样保留。 */
export function splitLinkText(text: string): LinkTextPart[] {
  const parts: LinkTextPart[] = []
  let cursor = 0

  for (const match of text.matchAll(HTTP_URL)) {
    const index = match.index ?? 0
    const raw = match[0]
    const { url, rest } = splitUrlToken(raw)

    if (index > cursor) parts.push({ kind: "text", text: text.slice(cursor, index) })

    if (url.length > 0 && parseUrl(url)) parts.push({ kind: "link", text: url })
    else parts.push({ kind: "text", text: raw.slice(0, raw.length - rest.length) })

    if (rest.length > 0) parts.push({ kind: "text", text: rest })
    cursor = index + raw.length
  }

  if (cursor < text.length) parts.push({ kind: "text", text: text.slice(cursor) })
  return parts
}
