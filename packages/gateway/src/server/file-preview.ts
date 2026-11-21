import { randomBytes } from "node:crypto"
import type { IncomingMessage, ServerResponse } from "node:http"

import { MIME, resolveFile, sendRaw, type Target } from "./fs-routes.js"
import type { PlatformRequestDeps } from "./platform.js"

const TOKEN_TTL_MS = 60 * 60 * 1000
const PREFIX = "/api/v1/preview/"
const LINK_SCRIPT = `<script>document.addEventListener("click",function(e){var a=e.target&&e.target.closest&&e.target.closest("a[href]");if(!a)return;var u=new URL(a.href,location.href);if(u.protocol!=="http:"&&u.protocol!=="https:")return;if(u.host===location.host&&u.pathname.indexOf(${JSON.stringify(PREFIX)})===0)return;e.preventDefault();parent.postMessage({type:"pig-preview-link",href:u.href},"*")},true)</script>`
const tokens = new Map<string, { cwd: string; expires: number }>()

export function issuePreviewToken(cwd: string): string {
  const now = Date.now()

  for (const [key, entry] of tokens) if (entry.expires < now) tokens.delete(key)

  const token = randomBytes(24).toString("base64url")
  tokens.set(token, { cwd, expires: now + TOKEN_TTL_MS })
  return token
}

export async function handlePreviewRequest(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  deps: Pick<PlatformRequestDeps, "hostService" | "send">,
): Promise<boolean> {
  if (!url.pathname.startsWith(PREFIX) || req.method !== "GET") return false

  const [token = "", ...rest] = url.pathname.slice(PREFIX.length).split("/")
  const entry = tokens.get(token)
  const requested = decodePath(rest)
  const now = Date.now()

  if (entry && entry.expires > now) entry.expires = now + TOKEN_TTL_MS

  try {
    const target =
      entry && entry.expires > now ? await resolveFile(entry.cwd, requested, deps) : 403

    if (typeof target === "number") {
      deps.send(res, target, { code: target === 403 ? "FORBIDDEN" : "NOT_FOUND" })
      return true
    }

    const info = await target.env.stat(target.file)

    if (info?.kind !== "file") deps.send(res, 404, { code: "NOT_FOUND" })
    else if (target.file.toLowerCase().match(/\.html?$/)) await sendPage(res, target)
    else await sendRaw(req, res, target, info.size)
  } catch (error) {
    console.error("preview failed:", error)

    if (!res.headersSent) deps.send(res, 500, { code: "INTERNAL_ERROR" })
    else res.destroy()
  }

  return true
}

async function sendPage(res: ServerResponse, target: Target) {
  const body = Buffer.from(injectLinkScript((await target.env.readFile(target.file)).toString()))

  res.writeHead(200, {
    "Content-Type": MIME.html,
    "Content-Length": String(body.length),
    "Cache-Control": "no-cache",
    "Content-Security-Policy": "sandbox allow-scripts",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
  })
  res.end(body)
}

function injectLinkScript(html: string): string {
  const head = /<head[^>]*>/i.exec(html)
  return head
    ? `${html.slice(0, head.index + head[0].length)}${LINK_SCRIPT}${html.slice(head.index + head[0].length)}`
    : `${LINK_SCRIPT}${html}`
}

function decodePath(parts: string[]): string {
  try {
    return parts.map(decodeURIComponent).join("/")
  } catch {
    return ""
  }
}
