/** 工作区内文件的只读接口：stat / text / raw / list / search、git 状态与预览令牌。 */
import type { IncomingMessage, ServerResponse } from "node:http"
import { posix, win32 } from "node:path"
import { pipeline } from "node:stream/promises"
import type { Environment } from "@pig/environment"
import type { FileStatResponse, FileTextResponse } from "@pig/protocol"
import { workspaceEnvironment } from "../pi/remote-session.js"
import type { PiHostService } from "../pi/service.js"
import { issuePreviewToken } from "./file-preview.js"
import { HttpError, type HttpDeps, type HttpRouteTable } from "./router.js"
import { gitIgnored, gitStatus, searchContents } from "./workspace-git.js"

/** 预览上限：超过就不读文本。 */
const TEXT_LIMIT = 1024 * 1024
/** 与 git 的判定一致：前 8000 字节里有 NUL 就当二进制。 */
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

/** 解析后的目标：file 与 root 都是解开符号链接后的真实路径。 */
export type Target = { env: Environment; file: string; root: string; path: PathApi }

type Workspace = { env: Environment; root: string; path: PathApi }

/** 文件路由只需要判定工作区是否授权过。 */
export type FileDeps = HttpDeps & { hostService: Pick<PiHostService, "isKnownWorkspace"> }

const cwd = (url: URL) => url.searchParams.get("cwd")?.trim() ?? ""

/** 授权过的工作区：环境、根目录与该环境的路径规则。 */
async function authorizedWorkspace(
  cwd: string,
  deps: Pick<FileDeps, "hostService">,
): Promise<Workspace | undefined> {
  if (!cwd || !(await deps.hostService.isKnownWorkspace(cwd))) return undefined

  const { env, root } = workspaceEnvironment(cwd)
  return { env, root, path: env.id === "local" && process.platform === "win32" ? win32 : posix }
}

/** 授权工作区 + 解开符号链接后仍在根内，才给出目标；否则返回状态码。 */
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

/** 按 query 里的 cwd/path 定位文件；越界回 403，不存在回 404。 */
async function openFile(url: URL, deps: FileDeps): Promise<Target> {
  const target = await resolveFile(cwd(url), url.searchParams.get("path") ?? "", deps)

  if (typeof target !== "number") return target
  throw new HttpError(target, target === 403 ? "FORBIDDEN" : "NOT_FOUND")
}

/** stat 之后再确认类型：文本与原始字节要文件，列表要目录。 */
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

  "GET /api/v1/platform/git/status": async ({ url, deps }) => {
    const workspace = await authorizedWorkspace(cwd(url), deps)

    if (!workspace) throw new HttpError(403, "FORBIDDEN")
    return gitStatus(workspace.env, workspace.root)
  },

  "GET /api/v1/platform/fs/preview-token": async ({ url, deps }) => {
    const workspace = await authorizedWorkspace(cwd(url), deps)

    if (!workspace) throw new HttpError(403, "FORBIDDEN")
    return { token: issuePreviewToken(cwd(url)) }
  },
} satisfies HttpRouteTable<FileDeps>
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" })

/** 目录在前、名字按自然序；顺带标出被 .gitignore 命中的项。 */
async function listDirectory({ env, file, root, path }: Target) {
  const items = (await env.readdir(file)).sort(
    (a, b) =>
      Number(b.kind === "directory") - Number(a.kind === "directory") ||
      collator.compare(a.name, b.name),
  )
  const dir = path.relative(root, file).split(path.sep).filter(Boolean).join("/")
  const relative = (name: string) => (dir ? `${dir}/${name}` : name)
  const ignored = await gitIgnored(
    env,
    root,
    items.map((item) => `${relative(item.name)}${item.kind === "directory" ? "/" : ""}`),
  )
  return {
    entries: items.map((item) => ({ ...item, ignored: ignored.has(relative(item.name)) })),
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
    // agent 写的文件打开时不能以 pig 的源跑脚本；PDF 除外，Chromium 的查看器在 sandbox 里不工作
    ...(type === "application/pdf" ? {} : { "Content-Security-Policy": "sandbox" }),
    "X-Content-Type-Options": "nosniff",
    // 预览地址里带令牌，PDF 里的外链不能经 Referer 带走
    "Referrer-Policy": "no-referrer",
  }

  if (range === null) {
    res.writeHead(416, { ...headers, "Content-Range": `bytes */${size}` })
    res.end()
    return
  }

  const { start, end } = range ?? { start: 0, end: size - 1 }
  // 先拿到流再写头：连不上远端时还能回 500
  const stream = size > 0 ? await target.env.readStream(target.file, { start, end }) : undefined

  res.writeHead(range ? 206 : 200, {
    ...headers,
    "Content-Length": String(Math.max(0, end - start + 1)),
    ...(range ? { "Content-Range": `bytes ${start}-${end}/${size}` } : {}),
  })

  if (stream) await pipeline(stream, res)
  else res.end()
}
