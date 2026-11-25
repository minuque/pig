import type { IncomingMessage, ServerResponse } from "node:http"
import { posix, win32 } from "node:path"
import { pipeline } from "node:stream/promises"
import { localEnvironment, type Environment } from "@pig/environment"
import type { FileStatResponse, FileTextResponse } from "@pig/protocol"
import type { PiHostService } from "../pi/service.js"
import { issuePreviewToken } from "./file-preview.js"
import { HttpError, type HttpDeps, type HttpRouteTable } from "./router.js"
import { searchContents } from "./content-search.js"

const TEXT_LIMIT = 1024 * 1024
const BINARY_PROBE = 8000
export const MIME: Record<string, string> = {
  html: "text/html; charset=utf-8",
  htm: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  bmp: "image/bmp",
  webp: "image/webp",
  avif: "image/avif",
  svg: "image/svg+xml",
  pdf: "application/pdf",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  m4v: "video/mp4",
  ogv: "video/ogg",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  wav: "audio/wav",
  flac: "audio/flac",
  opus: "audio/opus",
  ogg: "audio/ogg",
  oga: "audio/ogg",
}

type PathApi = typeof posix

export type Target = { env: Environment; file: string; root: string; path: PathApi }

type Workspace = { env: Environment; root: string; path: PathApi }

export type FileDeps = HttpDeps & { hostService: Pick<PiHostService, "isKnownWorkspace"> }

const cwd = (url: URL) => url.searchParams.get("cwd")?.trim() ?? ""

async function authorizedWorkspace(
  cwd: string,
  deps: Pick<FileDeps, "hostService">,
): Promise<Workspace | undefined> {
  if (!cwd || !(await deps.hostService.isKnownWorkspace(cwd))) return undefined
  return { env: localEnvironment, root: cwd, path: process.platform === "win32" ? win32 : posix }
}

export async function resolveFile(
  cwd: string,
  requested: string,
  deps: Pick<FileDeps, "hostService">,
): Promise<Target | number> {
  const workspace = requested ? await authorizedWorkspace(cwd, deps) : undefined

  if (!workspace) return 403

  const { env, root, path } = workspace
  const file = path.resolve(root, requested)

  if (!inside(path, root, file)) return 403

  try {
    const [realRoot, realFile] = await Promise.all([env.realpath(root), env.realpath(file)])
    return inside(path, realRoot, realFile) ? { env, file: realFile, root: realRoot, path } : 403
  } catch {
    return 404
  }
}

async function openFile(url: URL, deps: FileDeps): Promise<Target> {
  const target = await resolveFile(cwd(url), url.searchParams.get("path") ?? "", deps)

  if (typeof target !== "number") return target
  throw new HttpError(target, target === 403 ? "FORBIDDEN" : "NOT_FOUND")
}

async function statFile(
  url: URL,
  deps: FileDeps,
): Promise<{ target: Target; info: FileStatResponse }> {
  const target = await openFile(url, deps)
  const info = await target.env.stat(target.file)

  if (!info) throw new HttpError(404, "NOT_FOUND")
  return { target, info }
}

async function requireFile(url: URL, deps: FileDeps): Promise<{ target: Target; size: number }> {
  const { target, info } = await statFile(url, deps)

  if (info.kind !== "file") throw new HttpError(400, "NOT_A_FILE")
  return { target, size: info.size }
}

export const fsRoutes = {
  "GET /api/v1/platform/fs/stat": async ({ url, deps }): Promise<FileStatResponse> => {
    const { info } = await statFile(url, deps)
    return info
  },

  "GET /api/v1/platform/fs/text": async ({ url, deps }): Promise<FileTextResponse> => {
    const { target, size } = await requireFile(url, deps)
    return readText(target, size, url.searchParams.has("force"))
  },

  "GET /api/v1/platform/fs/list": async ({ url, deps }) => {
    const { target, info } = await statFile(url, deps)

    if (info.kind !== "directory") throw new HttpError(400, "NOT_A_DIRECTORY")
    return listDirectory(target)
  },

  "GET /api/v1/platform/fs/raw": async ({ req, res, url, deps }) => {
    const { target, size } = await requireFile(url, deps)
    await sendRaw(req, res, target, size)
  },

  "GET /api/v1/platform/fs/search": async ({ req, url, deps }) => {
    const workspace = await authorizedWorkspace(cwd(url), deps)

    if (!workspace) throw new HttpError(403, "FORBIDDEN")
    const controller = new AbortController()

    req.once("close", () => controller.abort())

    const { env, root, path } = workspace
    return searchContents(env, root, path.join, url.searchParams.get("q") ?? "", controller.signal)
  },

  "GET /api/v1/platform/fs/preview-token": async ({ url, deps }) => {
    const workspace = await authorizedWorkspace(cwd(url), deps)

    if (!workspace) throw new HttpError(403, "FORBIDDEN")
    return { token: issuePreviewToken(cwd(url)) }
  },
} satisfies HttpRouteTable<FileDeps>
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" })

async function listDirectory({ env, file }: Target) {
  const entries = (await env.readdir(file)).sort(
    (a, b) =>
      Number(b.kind === "directory") - Number(a.kind === "directory") ||
      collator.compare(a.name, b.name),
  )
  return { entries }
}

function inside(path: typeof posix, root: string, file: string) {
  const rel = path.relative(root, file)
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel))
}

async function readText(target: Target, size: number, force: boolean): Promise<FileTextResponse> {
  if (size > TEXT_LIMIT) return { size, binary: false, tooLarge: true }

  const bytes = await target.env.readFile(target.file)
  const binary = bytes.subarray(0, BINARY_PROBE).includes(0)

  if (binary && !force) return { size, binary, tooLarge: false }
  return { content: bytes.toString("utf8"), size, binary, tooLarge: false }
}

function parseRange(header: string | undefined, size: number) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header?.trim() ?? "")

  if (!match || (!match[1] && !match[2])) return undefined

  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]))
  const end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1
  return start <= end && start < size ? { start, end } : null
}

export async function sendRaw(
  req: IncomingMessage,
  res: ServerResponse,
  target: Target,
  size: number,
) {
  const ext = target.file.split(".").pop()?.toLowerCase() ?? ""
  const range = parseRange(req.headers.range, size)
  const type = MIME[ext] ?? "application/octet-stream"
  const headers = {
    "Content-Type": type,
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-cache",
    // 外部：Chromium 的 PDF 查看器在 sandbox 里不工作
    ...(type === "application/pdf" ? {} : { "Content-Security-Policy": "sandbox" }),
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  }

  if (range === null) {
    res.writeHead(416, { ...headers, "Content-Range": `bytes */${size}` })
    res.end()
    return
  }

  const { start, end } = range ?? { start: 0, end: size - 1 }
  const stream = size > 0 ? await target.env.readStream(target.file, { start, end }) : undefined

  res.writeHead(range ? 206 : 200, {
    ...headers,
    "Content-Length": String(Math.max(0, end - start + 1)),
    ...(range ? { "Content-Range": `bytes ${start}-${end}/${size}` } : {}),
  })

  if (stream) await pipeline(stream, res)
  else res.end()
}
