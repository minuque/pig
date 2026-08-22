import { readFile } from "fs/promises";
import { extname, isAbsolute, relative, resolve } from "path";
import type { ServerResponse } from "http";

const contentTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

export async function serveWebFile(root: string, pathname: string, res: ServerResponse) {
  let requested: string;
  try {
    requested = decodeURIComponent(pathname).replace(/^\/+/, "") || "index.html";
  } catch {
    return false;
  }
  const file = resolve(root, requested);
  // 路径穿越防御：解析后的真实路径必须仍在 webRoot 内
  const pathFromRoot = relative(resolve(root), file);
  if (pathFromRoot.startsWith("..") || isAbsolute(pathFromRoot)) return false;

  try {
    const content = await readFile(file);
    res.writeHead(200, {
      "Content-Type": contentTypes[extname(file)] ?? "application/octet-stream",
    });
    res.end(content);
    return true;
  } catch {
    // 无扩展名的路径回退 index.html（SPA 前端路由）；带扩展名的静态资源缺失按 404 处理
    if (extname(requested)) return false;
    try {
      const content = await readFile(resolve(root, "index.html"));
      res.writeHead(200, { "Content-Type": contentTypes[".html"] });
      res.end(content);
      return true;
    } catch {
      return false;
    }
  }
}
