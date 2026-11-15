/** pnpm arch：扫代码生成架构看板单文件 HTML，写到 docs/architecture/dist/ 并打开。 */
import { execFileSync, spawn } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join, resolve } from "node:path"

import { scanApi } from "./api.mjs"
import { loadFlows, validateFlows } from "./flows.mjs"
import { scanGraph } from "./graph.mjs"
import { analyzeLayers, loadLayers } from "./layers.mjs"

const root = resolve(import.meta.dirname, "../..")
const out = join(root, "docs/architecture/dist/index.html")
const webRequire = createRequire(join(root, "apps/web/package.json"))
const RADIX_COLORS = ["indigo", "slate", "green", "amber", "cyan", "orange", "violet", "red"]

/** 包根目录：从入口文件往上找到 package.json。 */
function pkgDir(name) {
  let dir = dirname(webRequire.resolve(name))

  while (!existsSync(join(dir, "package.json"))) dir = dirname(dir)
  return dir
}

const read = (path) => readFileSync(path, "utf8")
/** 内联进 <script> 的文本不能出现结束标签。 */
const inlineJs = (text) => text.replaceAll("</script", "<\\/script")
const flows = await loadFlows(root)
const errors = validateFlows(root, flows)

if (errors.length) {
  console.error(`arch: 数据流引用失效\n${errors.join("\n")}`)
  process.exit(1)
}

const api = scanApi(root)
const graph = scanGraph(root)
const layers = analyzeLayers(graph, await loadLayers(root))

if (layers.errors.length) {
  console.error(
    `arch: 分层配置和代码对不上，改 docs/architecture/layers.ts\n${layers.errors.join("\n")}`,
  )
  process.exit(1)
}

const radix = pkgDir("@radix-ui/themes")
const css = [
  join(radix, "tokens/base.css"),
  ...RADIX_COLORS.map((c) => join(radix, `tokens/colors/${c}.css`)),
  join(root, "apps/web/src/style/tokens.css"),
  join(root, "apps/web/src/style/mermaid.css"),
]
  .map(read)
  .join("\n")
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
  generatedAt: new Date().toLocaleString("zh-CN", { hour12: false }),
}
const html = read(join(import.meta.dirname, "page.html"))
  .replace("/*__CSS__*/", () => css.replaceAll("</style", "<\\/style"))
  .replace("/*__PELE__*/", () => inlineJs(read(join(pkgDir("pele"), "dist/pele.global.js"))))
  .replace("/*__PANZOOM__*/", () =>
    inlineJs(read(join(pkgDir("@panzoom/panzoom"), "dist/panzoom.min.js"))),
  )
  .replace("/*__DATA__*/", () => JSON.stringify(data).replaceAll("<", "\\u003c"))

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
