import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises"
import type { IncomingMessage, ServerResponse } from "node:http"
import { homedir } from "node:os"
import { dirname, join } from "node:path"

const SECRET_BYTES = 32
const COOKIE_DAYS = 30
const DAY_MS = 24 * 60 * 60 * 1000
const COOKIE_PREFIX = "pig-auth-"

interface CookiePayload {
  version: 1
  authority: string
  issuedAt: number
  expiresAt: number
}

export function browserSecretFile(sessionDir?: string): string {
  if (sessionDir) return join(sessionDir, "browser-session-secret")
  return join(homedir(), ".pig", "browser-session-secret")
}

function encode(value: Buffer): string {
  return value.toString("base64url")
}

function decode(value: string): Buffer | undefined {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return undefined
  const decoded = Buffer.from(value, "base64url")
  return encode(decoded) === value ? decoded : undefined
}

function header(headers: IncomingMessage["headers"], name: string): string | undefined {
  const value = headers[name]
  return typeof value === "string" ? value : undefined
}

function authorityOf(headers: IncomingMessage["headers"]): string | undefined {
  const host = header(headers, "host")

  if (!host) return undefined

  try {
    return new URL(`http://${host}`).host
  } catch {
    return undefined
  }
}

function loopbackHost(host: string): boolean {
  try {
    const name = new URL(`http://${host}`).hostname
    return name === "127.0.0.1" || name === "localhost"
  } catch {
    return false
  }
}

function sameBytes(actual: string, expected: string): boolean {
  const left = Buffer.from(actual)
  const right = Buffer.from(expected)
  return left.byteLength === right.byteLength && timingSafeEqual(left, right)
}

function sign(secret: Buffer, body: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url")
}

function cookieName(authority: string): string {
  return COOKIE_PREFIX + createHmac("sha256", "pig-auth").update(authority).digest("base64url")
}

function readCookie(raw: string, name: string): string | undefined {
  for (const part of raw.split(";")) {
    const at = part.indexOf("=")

    if (at === -1 || part.slice(0, at).trim() !== name) continue
    return part.slice(at + 1).trim()
  }
}

function encodeCookie(payload: CookiePayload, secret: Buffer): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url")
  return `v1.${body}.${sign(secret, body)}`
}

function decodeCookie(value: string, secret: Buffer): CookiePayload | undefined {
  const [version, body, signature] = value.split(".")

  if (!body || !signature || version !== "v1" || !sameBytes(signature, sign(secret, body)))
    return undefined

  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as CookiePayload

    if (
      parsed.version !== 1 ||
      typeof parsed.authority !== "string" ||
      !Number.isSafeInteger(parsed.issuedAt) ||
      !Number.isSafeInteger(parsed.expiresAt)
    )
      return undefined
    return parsed
  } catch {
    return undefined
  }
}

async function loadSecret(file: string): Promise<Buffer> {
  try {
    const parsed = JSON.parse(await readFile(file, "utf8")) as { version?: number; secret?: string }
    const secret = typeof parsed.secret === "string" ? decode(parsed.secret) : undefined

    if (parsed.version === 1 && secret?.byteLength === SECRET_BYTES) return secret
    throw new Error("浏览器会话签名已损坏")
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
  }

  const secret = randomBytes(SECRET_BYTES)
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, JSON.stringify({ version: 1, secret: encode(secret) }), { mode: 0o600 })
  await chmod(file, 0o600)
  return secret
}

/** 浏览器入场：进程内一次性 token 换 HttpOnly cookie，签名密钥落在本机文件。 */
export class BrowserSession {
  readonly launchToken = encode(randomBytes(SECRET_BYTES))
  private secret: Buffer | undefined

  constructor(private readonly file: string) {}

  async open(): Promise<void> {
    this.secret = await loadSecret(this.file)
  }

  authorizationHeader(): string {
    return `Bearer ${this.launchToken}`
  }

  authenticatedUrl(base: string): string {
    const url = new URL(base)
    url.pathname = "/"
    url.search = ""
    url.hash = ""
    url.searchParams.set("token", this.launchToken)
    return url.href
  }

  /** 本机回环且不是跨站请求。未带通行证时返回 401。 */
  rejection(headers: IncomingMessage["headers"]): 401 | 403 | undefined {
    const host = header(headers, "host")

    if (!host || !loopbackHost(host)) return 403

    if (header(headers, "sec-fetch-site") === "cross-site") return 403
    const origin = header(headers, "origin")

    if (origin !== undefined) {
      try {
        const name = new URL(origin).hostname

        if (name !== "127.0.0.1" && name !== "localhost") return 403
      } catch {
        return 403
      }
    }

    return this.accepts(headers) ? undefined : 401
  }

  accepts(headers: IncomingMessage["headers"]): boolean {
    const bearer = header(headers, "authorization")

    if (bearer && sameBytes(bearer, this.authorizationHeader())) return true
    return this.cookieValid(headers)
  }

  /** 根路径上的 token 换成 cookie 并跳回干净地址。已有 cookie 则可以返回页面。 */
  authorizeIndex(req: IncomingMessage, res: ServerResponse): boolean {
    const url = new URL(req.url ?? "/", "http://127.0.0.1")
    const tokens = url.searchParams.getAll("token")

    if (tokens.length > 0) {
      const authority = authorityOf(req.headers)

      if (
        req.method === "GET" &&
        url.pathname === "/" &&
        tokens.length === 1 &&
        authority &&
        sameBytes(tokens[0] ?? "", this.launchToken)
      ) {
        this.writeCookie(res, authority)
        return false
      }

      this.writeDenied(res)
      return false
    }

    if (this.accepts(req.headers)) return true
    this.writeDenied(res)
    return false
  }

  private cookieValid(headers: IncomingMessage["headers"]): boolean {
    const secret = this.secret
    const authority = authorityOf(headers)
    const raw = header(headers, "cookie")

    if (!secret || !authority || !raw) return false
    const value = readCookie(raw, cookieName(authority))

    if (!value) return false
    const payload = decodeCookie(value, secret)

    if (!payload || payload.authority !== authority) return false
    const now = Date.now()
    const maxAge = COOKIE_DAYS * DAY_MS
    return (
      payload.issuedAt <= now &&
      payload.expiresAt > now &&
      payload.expiresAt - payload.issuedAt <= maxAge
    )
  }

  private writeCookie(res: ServerResponse, authority: string): void {
    const secret = this.secret

    if (!secret) throw new Error("浏览器会话尚未就绪")
    const issuedAt = Date.now()
    const expiresAt = issuedAt + COOKIE_DAYS * DAY_MS
    const value = encodeCookie({ version: 1, authority, issuedAt, expiresAt }, secret)
    const maxAge = Math.floor((COOKIE_DAYS * DAY_MS) / 1000)
    res.writeHead(303, {
      "cache-control": "no-store",
      location: "/",
      "referrer-policy": "no-referrer",
      "set-cookie": `${cookieName(authority)}=${value}; Max-Age=${maxAge}; Path=/; Expires=${new Date(expiresAt).toUTCString()}; HttpOnly; SameSite=Strict`,
    })
    res.end()
  }

  private writeDenied(res: ServerResponse): void {
    res.writeHead(401, {
      "cache-control": "no-store",
      "content-type": "text/plain; charset=utf-8",
    })
    res.end("需要本机通行证。请重新打开启动时打印的地址。\n")
  }
}
