import type { IncomingMessage, ServerResponse } from "node:http"
import { posix, win32 } from "node:path"
import { pipeline } from "node:stream/promises"
import type { FileStatResponse, FileTextResponse } from "@pig/protocol"
import type { Environment } from "@pig/environment"

import { workspaceEnvironment } from "../pi/remote-session.js"
import type { PlatformRequestDeps } from "./platform.js"

/** 与 cc-wrapper 的 PREVIEW_LIMIT 一致：超过就不读文本。 */
const TEXT_LIMIT = 1024 * 1024
/** 与 git 的判定一致：前 8000 字节里有 NUL 就当二进制。 */
const BINARY_PROBE = 8000
const MIME: Record<string, string> = {
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

type Target = { env: Environment; file: string }

/** 工作区内文件的只读接口；true=已处理。 */
export async function handleFsRequest(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  deps: PlatformRequestDeps,
): Promise<boolean> {
  const kind = /^\/api\/v1\/platform\/fs\/(stat|text|raw)$/.exec(url.pathname)?.[1]

  if (!kind || req.method !== "GET") return false

  const target = await resolveTarget(url, deps)

  if (typeof target === "number") {
    deps.send(res, target, { code: target === 403 ? "FORBIDDEN" : "NOT_FOUND" })
    return true
  }

  try {
    const info = await target.env.stat(target.file)

    if (!info) deps.send(res, 404, { code: "NOT_FOUND" })
    else if (kind === "stat") deps.send(res, 200, info satisfies FileStatResponse)
    else if (info.kind !== "file") deps.send(res, 400, { code: "NOT_A_FILE" })
    else if (kind === "text")
      deps.send(res, 200, await readText(target, info.size, url.searchParams.has("force")))
    else await sendRaw(req, res, target, info.size)
  } catch (error) {
    console.error(`fs ${kind} failed:`, error)

    if (!res.headersSent) deps.send(res, 500, { code: "INTERNAL_ERROR" })
    else res.destroy()
  }

  return true
}

/** 授权工作区 + 解开符号链接后仍在根内，才给出目标；否则返回状态码。 */
async function resolveTarget(url: URL, deps: PlatformRequestDeps): Promise<Target | number> {
  const cwd = url.searchParams.get("cwd")?.trim() ?? ""
  const requested = url.searchParams.get("path") ?? ""

  if (!cwd || !requested || !(await deps.hostService.isKnownWorkspace(cwd))) return 403

  const { env, root } = workspaceEnvironment(cwd)
  const path = env.id === "local" && process.platform === "win32" ? win32 : posix
  const file = path.resolve(root, requested)

  if (!inside(path, root, file)) return 403

  try {
    const [realRoot, realFile] = await Promise.all([env.realpath(root), env.realpath(file)])
    return inside(path, realRoot, realFile) ? { env, file: realFile } : 403
  } catch {
    return 404
  }
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

/** 单段 Range；多段或不认识的写法按整份返回。 */
function parseRange(header: string | undefined, size: number) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header?.trim() ?? "")

  if (!match || (!match[1] && !match[2])) return undefined

  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]))
  const end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1
  return start <= end && start < size ? { start, end } : null
}

async function sendRaw(req: IncomingMessage, res: ServerResponse, target: Target, size: number) {
  const ext = target.file.split(".").pop()?.toLowerCase() ?? ""
  const range = parseRange(req.headers.range, size)
  const headers = {
    "Content-Type": MIME[ext] ?? "application/octet-stream",
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-cache",
    // 工作区文件是 agent 写的：直接打开时也不能以 pig 的源执行脚本
    "Content-Security-Policy": "sandbox",
    "X-Content-Type-Options": "nosniff",
  }

  if (range === null) {
    res.writeHead(416, { ...headers, "Content-Range": `bytes */${size}` })
    res.end()
    return
  }

  const { start, end } = range ?? { start: 0, end: size - 1 }

  res.writeHead(range ? 206 : 200, {
    ...headers,
    "Content-Length": String(Math.max(0, end - start + 1)),
    ...(range ? { "Content-Range": `bytes ${start}-${end}/${size}` } : {}),
  })

  if (size === 0) {
    res.end()
    return
  }

  await pipeline(await target.env.readStream(target.file, { start, end }), res)
}
