import { readFile } from "fs/promises"
import { extname, isAbsolute, relative, resolve } from "path"
import type { ServerResponse } from "http"
import { gzipSync } from "zlib"

const contentTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
}

const COMPRESSIBLE = new Set([".css", ".html", ".js", ".json", ".svg", ".webmanifest"])

const MIN_GZIP_BYTES = 512

type CachedFile = { raw: Buffer; gzip?: Buffer }

const fileCache = new Map<string, CachedFile>()

function wantsGzip(acceptEncoding: string): boolean {
  const match = /(?:^|,)\s*gzip(?:\s*;\s*q\s*=\s*([\d.]+))?/i.exec(acceptEncoding)

  if (!match) return false

  return match[1] === undefined || Number(match[1]) > 0
}

function cacheControl(requested: string): string | undefined {
  if (requested.startsWith("assets/")) return "public, max-age=31536000, immutable"

  if (requested === "index.html" || !extname(requested)) return "no-cache"

  return undefined
}

async function loadFile(file: string, ext: string): Promise<CachedFile> {
  const hit = fileCache.get(file)

  if (hit) return hit
  const raw = await readFile(file)
  const cached: CachedFile = { raw }

  if (COMPRESSIBLE.has(ext) && raw.length >= MIN_GZIP_BYTES) {
    const gzip = gzipSync(raw)

    if (gzip.length < raw.length) cached.gzip = gzip
  }

  fileCache.set(file, cached)

  return cached
}

function sendFile(
  res: ServerResponse,
  cached: CachedFile,
  ext: string,
  requested: string,
  acceptEncoding: string,
) {
  const gzip = Boolean(cached.gzip && wantsGzip(acceptEncoding))

  const headers: Record<string, string> = {
    "Content-Type": contentTypes[ext] ?? "application/octet-stream",
  }

  if (gzip) {
    headers["Content-Encoding"] = "gzip"
    headers.Vary = "Accept-Encoding"
  }

  const cache = cacheControl(requested)

  if (cache) headers["Cache-Control"] = cache
  res.writeHead(200, headers)
  res.end(gzip ? cached.gzip : cached.raw)
}

export async function serveWebFile(
  root: string,
  pathname: string,
  res: ServerResponse,
  acceptEncoding = "",
) {
  let requested: string

  try {
    requested = decodeURIComponent(pathname).replace(/^\/+/, "") || "index.html"
  } catch {
    return false
  }

  const file = resolve(root, requested)
  // 路径穿越防御：解析后的真实路径必须仍在 webRoot 内
  const pathFromRoot = relative(resolve(root), file)

  if (pathFromRoot.startsWith("..") || isAbsolute(pathFromRoot)) return false

  try {
    const ext = extname(file).toLowerCase()
    sendFile(res, await loadFile(file, ext), ext, requested, acceptEncoding)

    return true
  } catch {
    // 无扩展名的路径回退 index.html（SPA 前端路由）；带扩展名的静态资源缺失按 404 处理
    if (extname(requested)) return false

    try {
      const index = resolve(root, "index.html")
      sendFile(res, await loadFile(index, ".html"), ".html", "index.html", acceptEncoding)

      return true
    } catch {
      return false
    }
  }
}
