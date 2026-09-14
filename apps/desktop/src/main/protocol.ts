import { access } from "node:fs/promises"
import { extname } from "node:path"
import { pathToFileURL } from "node:url"

import { net, protocol } from "electron"

import {
  gatewayTargetUrl,
  injectGatewayOrigin,
  isPigApiPath,
  parsePigRequest,
  pigCorsHeaders,
  pigSpaFallback,
  PIG_SCHEME,
  resolvePigWebFile,
} from "./urls.js"

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

export function handlePigProtocol(httpOrigin: string, webRoot: string): void {
  protocol.handle(PIG_SCHEME, (request) => proxyPigRequest(request, httpOrigin, webRoot))
}

async function proxyPigRequest(
  request: Request,
  httpOrigin: string,
  webRoot: string,
): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: pigCorsHeaders(new Headers()) })
  }

  const parsed = parsePigRequest(request.url)

  if (!parsed) return notFound()

  if (isPigApiPath(parsed.pathname)) return proxyGateway(request, httpOrigin)
  return serveWebFile(webRoot, parsed.pathname, httpOrigin)
}

async function proxyGateway(request: Request, httpOrigin: string): Promise<Response> {
  const target = gatewayTargetUrl(request.url, httpOrigin)

  if (!target) return notFound()

  try {
    const response = await net.fetch(target.href, fetchInit(request))
    return withCors(response)
  } catch {
    return new Response("Bad Gateway", { status: 502, headers: pigCorsHeaders(new Headers()) })
  }
}

async function serveWebFile(
  webRoot: string,
  pathname: string,
  httpOrigin: string,
): Promise<Response> {
  const file = resolvePigWebFile(webRoot, pathname)

  if (!file) return notFound()

  try {
    await access(file)
    return sendFile(file, httpOrigin)
  } catch {
    const fallback = pigSpaFallback(webRoot, pathname)

    if (!fallback) return notFound()

    try {
      await access(fallback)
      return sendFile(fallback, httpOrigin)
    } catch {
      return notFound()
    }
  }
}

async function sendFile(file: string, httpOrigin: string): Promise<Response> {
  if (extname(file).toLowerCase() === ".html") {
    const response = await net.fetch(pathToFileURL(file).href)
    return stampHtmlResponse(response, httpOrigin)
  }

  return net.fetch(pathToFileURL(file).href)
}

function notFound(): Response {
  return new Response("Not Found", { status: 404, headers: pigCorsHeaders(new Headers()) })
}

function withCors(response: Response): Response {
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: pigCorsHeaders(response.headers),
  })
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
  const html = await response.text()
  const headers = pigCorsHeaders(response.headers)
  headers.delete("content-length")
  headers.set("content-type", "text/html; charset=utf-8")
  return new Response(injectGatewayOrigin(html, httpOrigin), {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}
