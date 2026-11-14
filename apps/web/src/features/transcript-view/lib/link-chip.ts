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

/** 链接的显示文字：去掉协议头、www 和末尾斜杠。 */
export function prettifyUrl(url: string): string {
  return url
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/$/, "")
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
    return prettifyUrl(href)
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
