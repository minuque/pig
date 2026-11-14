import { randomBytes } from "node:crypto"
import type { IncomingMessage, ServerResponse } from "node:http"

import { MIME, resolveFile } from "./fs-routes.js"
import type { PlatformRequestDeps } from "./platform.js"

/** 令牌活多久：一次预览会话够用，过期后面板重新取。 */
const TOKEN_TTL_MS = 60 * 60 * 1000
const PREFIX = "/api/v1/preview/"
/** 页面里点到 http(s) 外链时交给外层确认，不在预览框里直接跳走。 */
const LINK_SCRIPT = `<script>document.addEventListener("click",function(e){var a=e.target&&e.target.closest&&e.target.closest("a[href]");if(!a)return;var u=new URL(a.href,location.href);if(u.protocol!=="http:"&&u.protocol!=="https:")return;if(u.host===location.host&&u.pathname.indexOf(${JSON.stringify(PREFIX)})===0)return;e.preventDefault();parent.postMessage({type:"pig-preview-link",href:u.href},"*")},true)</script>`
const tokens = new Map<string, { cwd: string; expires: number }>()

/** 给一个授权过的工作区发预览令牌：沙箱里的页面拿不到 cookie，靠路径里的令牌取同目录资源。 */
export function issuePreviewToken(cwd: string): string {
  const now = Date.now()

  for (const [key, entry] of tokens) if (entry.expires < now) tokens.delete(key)

  const token = randomBytes(24).toString("base64url")
  tokens.set(token, { cwd, expires: now + TOKEN_TTL_MS })
  return token
}

/** /api/v1/preview/<令牌>/<工作区内路径>；不走 cookie 校验，true=已处理。 */
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
  const target =
    entry && entry.expires > Date.now() ? await resolveFile(entry.cwd, requested, deps) : 403

  if (typeof target === "number") {
    deps.send(res, target, { code: target === 403 ? "FORBIDDEN" : "NOT_FOUND" })
    return true
  }

  const info = await target.env.stat(target.file)

  if (info?.kind !== "file") {
    deps.send(res, 404, { code: "NOT_FOUND" })
    return true
  }

  const ext = target.file.split(".").pop()?.toLowerCase() ?? ""
  const type = MIME[ext] ?? "application/octet-stream"
  let body = await target.env.readFile(target.file)

  if (type.startsWith("text/html")) body = Buffer.from(injectLinkScript(body.toString("utf8")))

  res.writeHead(200, {
    "Content-Type": type,
    "Content-Length": String(body.length),
    "Cache-Control": "no-cache",
    // 顶层直接打开也是沙箱；令牌在地址里，不能经 Referer 带给外站
    "Content-Security-Policy": "sandbox allow-scripts",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
  })
  res.end(body)
  return true
}

function injectLinkScript(html: string): string {
  const head = /<head[^>]*>/i.exec(html)
  return head
    ? `${html.slice(0, head.index + head[0].length)}${LINK_SCRIPT}${html.slice(head.index + head[0].length)}`
    : `${LINK_SCRIPT}${html}`
}

/** 地址里的每段解码；坏的百分号编码当空路径，交给 resolveFile 拒绝。 */
function decodePath(parts: string[]): string {
  try {
    return parts.map(decodeURIComponent).join("/")
  } catch {
    return ""
  }
}
