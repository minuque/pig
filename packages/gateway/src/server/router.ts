/** 极简声明式 HTTP 路由：按「方法 /路径」注册，:name 是路径参数，其余交给 handler。 */
import type { IncomingMessage, ServerResponse } from "node:http"
import type {
  PlatformHttpRouteKey,
  PlatformRouteParams,
  PlatformRouteResponse,
} from "@pig/protocol"

/** 路由需要的两项基础能力：写响应、读 JSON body。 */
export type HttpDeps = {
  send(res: ServerResponse, status: number, body?: unknown): void
  body(req: IncomingMessage): Promise<Record<string, unknown>>
}

/** handler 主动结束本轮：router 原样发出 status 与 { code }。 */
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
  /** 读 JSON body；解析不出来抛 400 INVALID_REQUEST。 */
  json(): Promise<Record<string, unknown>>
}

export type HttpHandler<D extends HttpDeps, K extends PlatformHttpRouteKey> = (
  ctx: HttpContext<D, K>,
) => Promise<PlatformRouteResponse<K>>

/** 一个文件的分发表：键就是 PlatformHttpRoutes 的键，响应类型由契约约束。 */
export type HttpRouteTable<D extends HttpDeps> = {
  readonly [K in PlatformHttpRouteKey]?: HttpHandler<D, K>
}

/** 把异常翻成要发出的错；未识别的写日志后回 500。 */
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

/** 段数一致再逐段比对；参数段解 URL 编码，坏的编码按 400 处理。 */
function match(route: Compiled, pathname: string): Record<string, string> | undefined {
  const parts = pathname.split("/")

  if (parts.length !== route.segments.length) return undefined

  const params: Record<string, string> = {}

  for (const [index, segment] of route.segments.entries()) {
    const part = parts[index] ?? ""

    if ("literal" in segment) {
      if (segment.literal !== part) return undefined
      continue
    }

    try {
      params[segment.param] = decodeURIComponent(part)
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

/** 声明式路由表；`handle` 未命中返回 false，交给下一个分发。 */
export class HttpRouter<D extends HttpDeps> {
  private readonly entries: Entry<D>[] = []

  constructor(
    private readonly deps: D,
    table: HttpRouteTable<D>,
    private readonly mapError: MapError = defaultMapError,
  ) {
    for (const route of Object.keys(table) as PlatformHttpRouteKey[]) {
      const handler = table[route]

      if (!handler) continue
      // 擦除只影响 router 内部：调用方拿到的仍是 table 逐键检查过的签名
      const erased = handler as (ctx: HttpContext<D, PlatformHttpRouteKey>) => Promise<unknown>

      this.entries.push({ route, path: compile(route), handler: erased })
    }

    // 字面量多的先试，避免 :param 抢走同层级的固定路径
    this.entries.sort((a, b) => b.path.literals - a.path.literals)
  }

  async handle(req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> {
    const method = req.method ?? "GET"

    for (const entry of this.entries) {
      if (entry.path.method !== method) continue

      const params = match(entry.path, url.pathname)

      if (!params) continue

      await this.run(entry, req, res, url, params)
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
  ) {
    const context = {
      req,
      res,
      url,
      params,
      deps: this.deps,
      json: () => readJson(this.deps, req),
    } as HttpContext<D, PlatformHttpRouteKey>

    try {
      const result = await entry.handler(context)

      if (!res.headersSent && result !== undefined) this.deps.send(res, 200, result)
    } catch (error) {
      const mapped = this.mapError(error, entry.route)

      // handler 已经发过响应时，唯一能做的只有断掉连接
      if (res.headersSent) res.destroy()
      else this.deps.send(res, mapped.status, { code: mapped.code })
    }
  }
}
