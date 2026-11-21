import type { IncomingMessage, ServerResponse } from "node:http"
import type {
  PlatformHttpRouteKey,
  PlatformRouteParams,
  PlatformRouteResponse,
} from "@pig/protocol"

export type HttpDeps = {
  send(res: ServerResponse, status: number, body?: unknown): void
  body(req: IncomingMessage): Promise<Record<string, unknown>>
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code)
  }
}

export type HttpContext<D extends HttpDeps, K extends PlatformHttpRouteKey> = {
  req: IncomingMessage
  res: ServerResponse
  url: URL
  params: PlatformRouteParams<K>
  deps: D
  json(): Promise<Record<string, unknown>>
}

export type HttpHandler<D extends HttpDeps, K extends PlatformHttpRouteKey> = (
  ctx: HttpContext<D, K>,
) => Promise<PlatformRouteResponse<K>>

export type HttpRouteTable<D extends HttpDeps> = {
  readonly [K in PlatformHttpRouteKey]?: HttpHandler<D, K>
}

export type MapError = (error: unknown, route: PlatformHttpRouteKey) => HttpError

type Segment = { literal: string } | { param: string }

type Compiled = { method: string; segments: Segment[]; literals: number }

const compiled = new Map<string, Compiled>()

function compile(route: PlatformHttpRouteKey): Compiled {
  const cached = compiled.get(route)

  if (cached) return cached

  const space = route.indexOf(" ")
  const segments = route
    .slice(space + 1)
    .split("/")
    .map((part): Segment => (part.startsWith(":") ? { param: part.slice(1) } : { literal: part }))
  const entry = {
    method: route.slice(0, space),
    segments,
    literals: segments.filter((segment) => "literal" in segment).length,
  }

  compiled.set(route, entry)
  return entry
}

function match(route: Compiled, pathname: string): Record<string, string> | undefined {
  const parts = pathname.split("/")

  if (parts.length !== route.segments.length) return undefined

  for (const [index, segment] of route.segments.entries()) {
    if ("literal" in segment && segment.literal !== (parts[index] ?? "")) return undefined
  }

  const params: Record<string, string> = {}

  for (const [index, segment] of route.segments.entries()) {
    if (!("param" in segment)) continue

    try {
      params[segment.param] = decodeURIComponent(parts[index] ?? "")
    } catch {
      throw new HttpError(400, "INVALID_REQUEST")
    }
  }

  return params
}

async function readJson(deps: HttpDeps, req: IncomingMessage): Promise<Record<string, unknown>> {
  try {
    return await deps.body(req)
  } catch {
    throw new HttpError(400, "INVALID_REQUEST")
  }
}

export function defaultMapError(error: unknown, route: PlatformHttpRouteKey): HttpError {
  if (error instanceof HttpError) return error
  console.error(`${route} failed:`, error)
  return new HttpError(500, "INTERNAL_ERROR")
}

type Entry<D extends HttpDeps> = {
  route: PlatformHttpRouteKey
  path: Compiled
  handler: (ctx: HttpContext<D, PlatformHttpRouteKey>) => Promise<unknown>
}

export class HttpRouter<D extends HttpDeps> {
  private readonly entries: Entry<D>[] = []

  constructor(
    table: HttpRouteTable<D>,
    private readonly mapError: MapError = defaultMapError,
  ) {
    for (const route of Object.keys(table) as PlatformHttpRouteKey[]) {
      const handler = table[route]

      if (!handler) continue
      const erased = handler as (ctx: HttpContext<D, PlatformHttpRouteKey>) => Promise<unknown>

      this.entries.push({ route, path: compile(route), handler: erased })
    }

    this.entries.sort((a, b) => b.path.literals - a.path.literals)
  }

  async handle(req: IncomingMessage, res: ServerResponse, url: URL, deps: D): Promise<boolean> {
    const method = req.method ?? "GET"

    for (const entry of this.entries) {
      if (entry.path.method !== method) continue

      let params: Record<string, string> | undefined

      try {
        params = match(entry.path, url.pathname)
      } catch (error) {
        const mapped = this.mapError(error, entry.route)
        deps.send(res, mapped.status, { code: mapped.code })
        return true
      }

      if (!params) continue

      await this.run(entry, req, res, url, params, deps)
      return true
    }

    return false
  }

  private async run(
    entry: Entry<D>,
    req: IncomingMessage,
    res: ServerResponse,
    url: URL,
    params: Record<string, string>,
    deps: D,
  ) {
    const context = {
      req,
      res,
      url,
      params,
      deps,
      json: () => readJson(deps, req),
    } as HttpContext<D, PlatformHttpRouteKey>

    try {
      const result = await entry.handler(context)

      if (!res.headersSent && result !== undefined) deps.send(res, 200, result)
    } catch (error) {
      const mapped = this.mapError(error, entry.route)

      if (res.headersSent) res.destroy()
      else deps.send(res, mapped.status, { code: mapped.code })
    }
  }
}
