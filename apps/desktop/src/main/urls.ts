import { extname, isAbsolute, relative, resolve } from "node:path"

export const VITE_DEV_ORIGIN = "http://127.0.0.1:5173"

export const PIG_SCHEME = "pig"

export const PIG_APP_HOST = "app"

export const PIG_APP_ORIGIN = `${PIG_SCHEME}://${PIG_APP_HOST}`

export const GATEWAY_ORIGIN_ARG_PREFIX = "--pig-gateway-origin="

export function gatewayOrigin(port: number): string {
  return `http://127.0.0.1:${port}`
}

export function pigAppUrl(): string {
  return `${PIG_APP_ORIGIN}/`
}

export function gatewayOriginArg(origin: string): string {
  return `${GATEWAY_ORIGIN_ARG_PREFIX}${origin}`
}

export function isDesktopDev(argv: readonly string[] = process.argv): boolean {
  return argv.includes("--dev")
}

export const DESKTOP_CDP_PORT = "9333"

/** `--dev` 默认 9333；`PIG_CDP` 覆盖，`0`/`off` 关闭。 */
export function desktopCdpPort(
  argv: readonly string[] = process.argv,
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const raw = env.PIG_CDP?.trim()

  if (raw === "0" || raw === "off") return undefined

  if (raw) return raw

  if (isDesktopDev(argv)) return DESKTOP_CDP_PORT
  return undefined
}

/** 基准进程：窗口先空着，由 Playwright 注入观察器后再打开工作台。 */
export function isDesktopBench(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.PIG_BENCH === "1"
}

/** 只接受 Gateway 回环 HTTP 地址，拒绝路径、凭据和其它主机。 */
export function isLoopbackHttpOrigin(value: string): boolean {
  try {
    const url = new URL(value)
    return (
      url.protocol === "http:" &&
      url.hostname === "127.0.0.1" &&
      (url.pathname === "" || url.pathname === "/") &&
      url.search === "" &&
      url.hash === "" &&
      url.username === "" &&
      url.password === ""
    )
  } catch {
    return false
  }
}

export function parseGatewayOriginArg(argv: readonly string[]): string | undefined {
  const arg = argv.find((item) => item.startsWith(GATEWAY_ORIGIN_ARG_PREFIX))

  if (!arg) return undefined
  const value = arg.slice(GATEWAY_ORIGIN_ARG_PREFIX.length)

  if (!isLoopbackHttpOrigin(value)) return undefined
  return new URL(value).origin
}

export function parsePigRequest(
  requestUrl: string,
): { pathname: string; search: string } | undefined {
  let url: URL

  try {
    url = new URL(requestUrl)
  } catch {
    return undefined
  }

  if (url.protocol !== `${PIG_SCHEME}:`) return undefined

  if (url.hostname !== PIG_APP_HOST) return undefined

  if (url.username !== "" || url.password !== "") return undefined
  const pathname = url.pathname === "" ? "/" : url.pathname
  return { pathname, search: url.search }
}

export function isPigApiPath(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/")
}

/** pig://app/... → Gateway 同源路径；其它 host 一律拒绝。 */
export function gatewayTargetUrl(requestUrl: string, httpOrigin: string): URL | undefined {
  const parsed = parsePigRequest(requestUrl)

  if (!parsed) return undefined
  return new URL(`${parsed.pathname}${parsed.search}`, httpOrigin)
}

/** 把 pig:// 路径落到 webRoot 内文件；穿越或坏编码返回 undefined。 */
export function resolvePigWebFile(webRoot: string, pathname: string): string | undefined {
  let requested: string

  try {
    requested = decodeURIComponent(pathname).replace(/^\/+/, "") || "index.html"
  } catch {
    return undefined
  }

  const root = resolve(webRoot)
  const file = resolve(root, requested)
  const pathFromRoot = relative(root, file)

  if (pathFromRoot.startsWith("..") || isAbsolute(pathFromRoot)) return undefined
  return file
}

export function pigSpaFallback(webRoot: string, pathname: string): string | undefined {
  const requested = pathname.replace(/^\/+/, "")

  if (requested !== "" && extname(requested)) return undefined
  return resolvePigWebFile(webRoot, "/index.html")
}

export function injectGatewayOrigin(html: string, httpOrigin: string): string {
  const stamp = `<script>document.documentElement.dataset.pigGatewayOrigin=${JSON.stringify(httpOrigin)}</script>`
  const marked = html.replace(/<head>/i, `<head>${stamp}`)
  return marked === html ? `${stamp}${html}` : marked
}

/** 模块脚本始终走 CORS；pig:// 响应必须带允许源，否则 Vite 产物无法执行。 */
export function pigCorsHeaders(headers: Headers): Headers {
  const next = new Headers(headers)
  next.set("Access-Control-Allow-Origin", PIG_APP_ORIGIN)
  next.set("Cross-Origin-Resource-Policy", "cross-origin")
  return next
}
