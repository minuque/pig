import { net, protocol } from "electron"

import { gatewayTargetUrl, injectGatewayOrigin, PIG_SCHEME } from "./urls.js"

type GatewayFetchInit = RequestInit & {
  bypassCustomProtocolHandlers: true
  duplex?: "half"
}

/** 必须在 app ready 之前调用，否则 Chromium 不把 pig:// 当标准 origin。 */
export function registerPigScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: PIG_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
      },
    },
  ])
}

export function handlePigProtocol(httpOrigin: string): void {
  protocol.handle(PIG_SCHEME, (request) => proxyPigRequest(request, httpOrigin))
}

async function proxyPigRequest(request: Request, httpOrigin: string): Promise<Response> {
  const target = gatewayTargetUrl(request.url, httpOrigin)
  if (!target) return new Response("Not Found", { status: 404 })
  try {
    const response = await net.fetch(target.href, fetchInit(request))
    return stampHtmlResponse(response, httpOrigin)
  } catch {
    return new Response("Bad Gateway", { status: 502 })
  }
}

function fetchInit(request: Request): GatewayFetchInit {
  const init: GatewayFetchInit = {
    method: request.method,
    headers: proxyHeaders(request.headers),
    bypassCustomProtocolHandlers: true,
  }
  if (request.method !== "GET" && request.method !== "HEAD" && request.body) {
    init.body = request.body
    init.duplex = "half"
  }
  return init
}

function proxyHeaders(headers: Headers): Headers {
  const next = new Headers()
  for (const [key, value] of headers) {
    const name = key.toLowerCase()
    if (name === "host" || name === "connection" || name === "content-length") continue
    next.append(key, value)
  }
  return next
}

async function stampHtmlResponse(response: Response, httpOrigin: string): Promise<Response> {
  const type = response.headers.get("content-type") ?? ""
  if (!type.toLowerCase().includes("text/html")) return response
  const html = await response.text()
  const headers = new Headers(response.headers)
  headers.delete("content-length")
  return new Response(injectGatewayOrigin(html, httpOrigin), {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}
