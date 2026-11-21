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

export function prettifyUrl(url: string): string {
  return url
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/$/, "")
}

const SITES: [RegExp, string][] = [
  [/(^|\.)github\.com$|^raw\.githubusercontent\.com$/, "github"],
  [/(^|\.)huggingface\.co$/, "huggingface"],
  [/(^|\.)openai\.com$/, "openai"],
  [/(^|\.)(anthropic\.com|claude\.ai|claude\.com)$/, "anthropic"],
  [/(^|\.)vercel\.com$/, "vercel"],
  [/(^|\.)cloudflare\.com$/, "cloudflare"],
  [/^ai\.google\.dev$/, "gemini"],
]

export function linkSite(url: string): string | undefined {
  const host = parseUrl(url)?.hostname.toLowerCase()
  return host ? SITES.find(([pattern]) => pattern.test(host))?.[1] : undefined
}

function githubLabel(parts: string[]): string | undefined {
  const [owner, repo, kind, id, ...rest] = parts

  if (!owner || !repo) return undefined
  const name = `${owner}/${repo}`

  if (!kind) return name

  if ((kind === "pull" || kind === "issues") && id && /^\d+$/.test(id)) return `${name}#${id}`

  if (kind === "commit" && id) return `${name}@${id.slice(0, 7)}`

  if ((kind === "blob" || kind === "tree") && rest.length) return `${name} · ${rest.join("/")}`
  return `${name} · ${[kind, id, ...rest].filter(Boolean).join("/")}`
}

export function shortUrlLabel(url: string): string {
  const parsed = parseUrl(url)

  if (!parsed) return prettifyUrl(url)
  const host = parsed.hostname.toLowerCase().replace(/^www\./, "")
  const parts = parsed.pathname.split("/").filter(Boolean).map(safeDecode)

  if (host === "github.com") return githubLabel(parts) ?? prettifyUrl(url)

  if (host === "npmjs.com" && parts[0] === "package" && parts[1])
    return parts.slice(1, parts[1].startsWith("@") ? 3 : 2).join("/")

  if (host === "huggingface.co" && parts.length === 2 && !parsed.search) return parts.join("/")
  return prettifyUrl(url)
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export function linkChipLabel(href: string, text: string | undefined): string {
  const plain = (text ?? "").trim()

  if (
    plain.length === 0 ||
    plain === href ||
    href === `https://${plain}` ||
    href === `http://${plain}`
  ) {
    return shortUrlLabel(href)
  }

  return plain
}

function splitUrlToken(raw: string): { url: string; rest: string } {
  const trailing = raw.match(TRAILING_PUNCTUATION)

  if (!trailing) return { url: raw, rest: "" }
  return { url: raw.slice(0, -trailing[0].length), rest: trailing[0] }
}

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
