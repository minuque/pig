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

/** pig://app/... → Gateway 同源路径；其它 host 一律拒绝。 */
export function gatewayTargetUrl(requestUrl: string, httpOrigin: string): URL | undefined {
  let url: URL
  try {
    url = new URL(requestUrl)
  } catch {
    return undefined
  }
  if (url.protocol !== `${PIG_SCHEME}:`) return undefined
  if (url.hostname !== PIG_APP_HOST) return undefined
  if (url.username !== "" || url.password !== "") return undefined
  const path = url.pathname === "" ? "/" : url.pathname
  return new URL(`${path}${url.search}`, httpOrigin)
}

export function injectGatewayOrigin(html: string, httpOrigin: string): string {
  const stamp = `<script>document.documentElement.dataset.pigGatewayOrigin=${JSON.stringify(httpOrigin)}</script>`
  const marked = html.replace(/<head>/i, `<head>${stamp}`)
  return marked === html ? `${stamp}${html}` : marked
}
