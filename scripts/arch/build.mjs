import { execFileSync, spawn } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join, resolve } from "node:path"

import { scanApi } from "./api.mjs"
import { loadFlows, validateFlows } from "./flows.mjs"
import { scanGraph } from "./graph.mjs"
import { analyzeLayers, loadLayers } from "./layers.mjs"

const ARCH_DIR = import.meta.dirname
const CLIENT_SCRIPTS = [
  "client/data.js",
  "client/diagrams.js",
  "client/search.js",
  "client/views-dep.js",
  "client/views.js",
]

function pkgDir(webRequire, name) {
  let dir = dirname(webRequire.resolve(name))

  while (!existsSync(join(dir, "package.json"))) dir = dirname(dir)
  return dir
}

const read = (path) => readFileSync(path, "utf8")
const inlineJs = (text) => text.replaceAll("</script", "<\\/script")

export async function buildArchHtml(root) {
  const flows = await loadFlows(root)
  const errors = validateFlows(root, flows)

  if (errors.length) {
    throw new Error(`arch: 数据流引用失效\n${errors.join("\n")}`)
  }

  const api = scanApi(root)
  const graph = scanGraph(root)
  const layers = analyzeLayers(graph, await loadLayers(root))

  if (layers.errors.length) {
    throw new Error(
      `arch: 分层配置和代码对不上，改 docs/architecture/layers.ts\n${layers.errors.join("\n")}`,
    )
  }

  const webRequire = createRequire(join(root, "apps/web/package.json"))
  const css = [
    join(root, "apps/web/src/style/tokens.css"),
    join(root, "apps/web/src/style/mermaid.css"),
    join(ARCH_DIR, "page.css"),
  ]
    .map(read)
    .join("\n")
  const appJs = CLIENT_SCRIPTS.map((file) => read(join(ARCH_DIR, file))).join("\n;\n")
  const data = {
    graph,
    layers: layers.views,
    api,
    flows,
    runtime: [
      ["apps/web", "packages/gateway", `WS ${api.ws.path} + HTTP`],
      ["apps/desktop", "packages/gateway", "主进程动态加载"],
      ["packages/gateway", "Pi Agent Runtime", "SDK"],
      ["packages/extensions", "Pi Agent Runtime", "Extension API"],
      ["Pi Agent Runtime", "模型服务", "HTTP"],
      ["Pi Agent Runtime", "Session JSONL", "读写"],
    ],
    commit: execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root }).toString().trim(),
    generatedAt: new Intl.DateTimeFormat("zh-CN", {
      dateStyle: "short",
      timeStyle: "medium",
      hour12: false,
    }).format(new Date()),
  }
  const icon = readFileSync(join(root, "apps/web/public/pwa-icon-192.png")).toString("base64")
  return read(join(ARCH_DIR, "page.html"))
    .replace("/*__CSS__*/", () => css.replaceAll("</style", "<\\/style"))
    .replace("/*__PELE__*/", () =>
      inlineJs(read(join(pkgDir(webRequire, "pele"), "dist/pele.global.js"))),
    )
    .replaceAll("__ICON__", () => `data:image/png;base64,${icon}`)
    .replace("/*__DATA__*/", () => JSON.stringify(data).replaceAll("<", "\\u003c"))
    .replace("/*__APP__*/", () => inlineJs(appJs))
}

const isEntry = process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)

if (isEntry) {
  const root = resolve(ARCH_DIR, "../..")
  const out = join(root, "docs/architecture/dist/index.html")

  try {
    const html = await buildArchHtml(root)
    mkdirSync(dirname(out), { recursive: true })
    writeFileSync(out, html)
    console.log(`arch: ${out}`)

    if (!process.argv.includes("--no-open")) {
      const [cmd, args] =
        process.platform === "win32"
          ? ["cmd", ["/c", "start", "", out]]
          : [process.platform === "darwin" ? "open" : "xdg-open", [out]]

      spawn(cmd, args, { detached: true, stdio: "ignore" }).unref()
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}
