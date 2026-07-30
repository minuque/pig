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
