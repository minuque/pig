/** 扫 apps/* 与 packages/* 的源码，解析 import，得到仓库内的文件节点与依赖边。 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join, posix, relative } from "node:path"
import ts from "typescript"

const SOURCE = /\.(?:ts|mts|mjs|vue)$/
const SKIP_DIR = new Set(["node_modules", "dist", "out", "test"])
const SCRIPT_BLOCK = /<script\b[^>]*>([\s\S]*?)<\/script>/g
const toId = (root, path) => relative(root, path).replaceAll("\\", "/")

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)

    if (statSync(path).isDirectory()) {
      if (!SKIP_DIR.has(name)) walk(path, out)
    } else if (SOURCE.test(name) && !/\.(?:test|spec)\.|\.d\.ts$/.test(name)) out.push(path)
  }

  return out
}

/** 工作区包：名字 → 目录（仓库相对）。 */
function workspacePackages(root) {
  const pkgs = []

  for (const group of ["apps", "packages"])
    for (const name of readdirSync(join(root, group))) {
      const manifest = join(root, group, name, "package.json")

      if (!existsSync(manifest)) continue
      const { name: pkgName } = JSON.parse(readFileSync(manifest, "utf8"))
      pkgs.push({ name: pkgName, dir: `${group}/${name}` })
    }

  return pkgs
}

/** apps/web 的路径别名，照 tsconfig 的 paths。 */
function webAliases(root) {
  const file = join(root, "apps/web/tsconfig.json")
  const { config } = ts.readConfigFile(file, ts.sys.readFile)
  return Object.entries(config.compilerOptions.paths).map(([key, [target]]) => ({
    prefix: key.replace(/\*$/, ""),
    target: posix.join("apps/web", target.replace(/\*$/, "")),
  }))
}

/** 模块所在的分组：src 下第一层目录；features 与 components 再往下一层。 */
function groupOf(id, pkgDir) {
  const rest = id.slice(pkgDir.length + 1).split("/")
  const srcAt = rest.indexOf("src")
  const parts = rest.slice(srcAt + 1, -1)
  const depth = ["features", "components"].includes(parts[0]) ? 2 : 1
  return [pkgDir, ...rest.slice(0, srcAt + 1), ...parts.slice(0, depth)].join("/")
}

function specifiers(path) {
  const text = readFileSync(path, "utf8")
  const blocks = path.endsWith(".vue") ? [...text.matchAll(SCRIPT_BLOCK)].map((m) => m[1]) : [text]
  return blocks.flatMap((code) =>
    ts.preProcessFile(code, true, true).importedFiles.map((f) => f.fileName),
  )
}

export function scanGraph(root) {
  const pkgs = workspacePackages(root)
  const aliases = webAliases(root)
  const paths = pkgs.flatMap(({ dir }) =>
    existsSync(join(root, dir, "src")) ? walk(join(root, dir, "src"), []) : [],
  )
  const ids = new Set(paths.map((p) => toId(root, p)))
  /** 依次试原样、.js→.ts、补后缀、index。 */
  const pick = (base) =>
    [
      base,
      base.replace(/\.js$/, ".ts"),
      base.replace(/\.mjs$/, ".mts"),
      `${base}.ts`,
      `${base}/index.ts`,
    ].find((c) => ids.has(c))
  const resolveSpec = (fromId, spec) => {
    if (spec.startsWith(".")) return pick(posix.normalize(posix.join(posix.dirname(fromId), spec)))

    if (fromId.startsWith("apps/web/")) {
      const alias = aliases
        .filter((a) => spec.startsWith(a.prefix))
        .sort((a, b) => b.prefix.length - a.prefix.length)[0]

      if (alias) return pick(alias.target + spec.slice(alias.prefix.length))
    }

    const pkg = pkgs.find((p) => spec === p.name || spec.startsWith(`${p.name}/`))

    if (!pkg) return undefined
    return pick(`${pkg.dir}/src/index.ts`)
  }
  const files = [...ids].map((id) => {
    const pkg = pkgs.find((p) => id.startsWith(`${p.dir}/`))
    return { id, pkg: pkg.dir, dir: groupOf(id, pkg.dir) }
  })
  const edges = []

  for (const path of paths) {
    const from = toId(root, path)
    const seen = new Set()

    for (const spec of specifiers(path)) {
      const to = resolveSpec(from, spec)

      if (!to || to === from || seen.has(to)) continue
      seen.add(to)
      edges.push({ from, to })
    }
  }

  return { files, edges }
}
