import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

export const RUNTIME_TOKENS = new Set([
  "--active-tab-left",
  "--active-tab-width",
  "--anchor-width",
  "--available-height",
  "--available-width",
  "--collapsible-panel-height",
  "--drag-x",
  "--drag-y",
  "--toast-swipe-x",
  "--toast-swipe-y",
  "--transform-origin",
  "--tree-level",
])

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "")
}

function collectWalk(dir, matcher, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)

    if (entry.isDirectory()) collectWalk(full, matcher, out)
    else if (matcher(full)) out.push(full)
  }

  return out
}

export function collectRootTokens(tokensCss) {
  const rootVars = new Set()

  for (const match of stripComments(tokensCss).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = match[1].split(",").map((part) => part.trim())

    if (!selectors.includes(":root")) continue

    for (const decl of match[2].matchAll(/(?:^|[\s;])(--[\w-]+)\s*:/g)) rootVars.add(decl[1])
  }

  return rootVars
}

export function auditCssTokens({ tokensCss, files, runtimeTokens = RUNTIME_TOKENS }) {
  const cleanTokens = stripComments(tokensCss)
  const defined = new Set()

  for (const match of cleanTokens.matchAll(/(?:^|[\s{;])(--[\w-]+)\s*:/gm)) defined.add(match[1])

  for (const match of cleanTokens.matchAll(/@property\s+(--[\w-]+)/g)) defined.add(match[1])

  const depsOf = new Map()

  for (const match of cleanTokens.matchAll(/(?:^|[\s{;])(--[\w-]+)\s*:([^;{}]+)/gm)) {
    const lhs = match[1]
    let deps = depsOf.get(lhs)

    if (!deps) {
      deps = new Set()
      depsOf.set(lhs, deps)
    }

    for (const ref of match[2].matchAll(/var\(\s*(--[\w-]+)\s*[,)]/g)) deps.add(ref[1])
  }

  const localDeclared = new Set()
  const dynamicPrefixes = []
  const dynamicSuffixes = []
  const usedOutside = new Set()
  const refsByFile = new Map()
  const recordRef = (name, filePath) => {
    let set = refsByFile.get(name)

    if (!set) {
      set = new Set()
      refsByFile.set(name, set)
    }

    set.add(filePath)
  }

  for (const ref of cleanTokens.matchAll(/var\(\s*(--[\w-]+)\s*[,)]/g))
    recordRef(ref[1], "tokens.css")

  for (const file of files) {
    const clean = stripComments(file.content)

    for (const match of clean.matchAll(/(?:^|[\s{;,"'`])(--[\w-]+)["'`]?\s*:/gm))
      localDeclared.add(match[1])

    for (const match of clean.matchAll(/setProperty\(\s*["'](--[\w-]+)["']/g))
      localDeclared.add(match[1])

    for (const match of clean.matchAll(/var\(\s*(--[\w-]+)\$\{/g)) dynamicPrefixes.push(match[1])

    for (const match of clean.matchAll(/getPropertyValue\(\s*`(--[\w-]+)\$\{/g))
      dynamicPrefixes.push(match[1])

    for (const match of clean.matchAll(/var\(\s*\$\{[^}]+\}(-[\w-]+)\s*[,)]/g))
      dynamicSuffixes.push(match[1])

    for (const match of clean.matchAll(/var\(\s*(--[\w-]+)\s*[,)]/g)) {
      usedOutside.add(match[1])
      recordRef(match[1], file.path)
    }

    for (const match of clean.matchAll(/getPropertyValue\(\s*["'](--[\w-]+)["']\s*\)/g)) {
      usedOutside.add(match[1])
      recordRef(match[1], file.path)
    }
  }

  const undefinedRefs = []

  for (const [name, refFiles] of refsByFile) {
    if (defined.has(name) || localDeclared.has(name) || runtimeTokens.has(name)) continue
    undefinedRefs.push({ name, files: [...refFiles].sort() })
  }

  undefinedRefs.sort((a, b) => a.name.localeCompare(b.name))

  const visited = new Set()
  const queue = []

  for (const name of defined) {
    const matched =
      usedOutside.has(name) ||
      dynamicPrefixes.some((prefix) => name.startsWith(prefix)) ||
      dynamicSuffixes.some((suffix) => name.endsWith(suffix))

    if (!matched) continue
    visited.add(name)
    queue.push(name)
  }

  while (queue.length) {
    const current = queue.shift()
    const deps = depsOf.get(current)

    if (!deps) continue

    for (const dep of deps) {
      if (!defined.has(dep) || visited.has(dep)) continue
      visited.add(dep)
      queue.push(dep)
    }
  }

  const unusedTokens = [...defined].filter((name) => !visited.has(name)).sort()
  return { undefinedRefs, unusedTokens }
}

export function auditRepoCssTokens(root) {
  const uiTokensPath = path.join(root, "packages/ui/src/styles/tokens.css")
  const appTokensPath = path.join(root, "apps/web/src/style/tokens.css")
  const indexPath = path.join(root, "apps/web/index.html")
  const uiSrcDir = path.join(root, "packages/ui/src")
  const webSrcDir = path.join(root, "apps/web/src")
  const readFiles = (paths) =>
    paths.map((filePath) => ({
      path: path.relative(root, filePath).replace(/\\/g, "/"),
      content: fs.readFileSync(filePath, "utf8"),
    }))
  const uiTokensCss = fs.readFileSync(uiTokensPath, "utf8")
  const appTokensCss = fs.readFileSync(appTokensPath, "utf8")
  const uiFiles = readFiles(
    collectWalk(uiSrcDir, (file) => /\.(vue|css|ts)$/.test(file) && file !== uiTokensPath),
  )
  const webFiles = readFiles([
    indexPath,
    ...collectWalk(webSrcDir, (file) => /\.(vue|css|ts)$/.test(file) && file !== appTokensPath),
  ])
  const uiAudit = auditCssTokens({ tokensCss: uiTokensCss, files: uiFiles })
  const uiRootTokens = collectRootTokens(uiTokensCss)
  const appRootTokens = collectRootTokens(appTokensCss)
  const duplicateRootTokens = [...appRootTokens].filter((name) => uiRootTokens.has(name)).sort()
  const fullAudit = auditCssTokens({
    tokensCss: `${uiTokensCss}\n${appTokensCss}`,
    files: [...uiFiles, ...webFiles],
  })
  return {
    uiUndefinedRefs: uiAudit.undefinedRefs,
    duplicateRootTokens,
    undefinedRefs: fullAudit.undefinedRefs,
    unusedTokens: fullAudit.unusedTokens,
  }
}

function main() {
  const result = auditRepoCssTokens(process.cwd())

  if (result.uiUndefinedRefs.length) {
    console.error("Undefined CSS variables in @pig/ui:")

    for (const item of result.uiUndefinedRefs)
      console.error(`  ${item.name} -> ${item.files.join(", ")}`)

    process.exitCode = 1
  }

  if (result.duplicateRootTokens.length) {
    console.error("Duplicate :root tokens between @pig/ui and apps/web:")

    for (const name of result.duplicateRootTokens) console.error(`  ${name}`)

    process.exitCode = 1
  }

  if (result.undefinedRefs.length) {
    console.error("Undefined CSS variables:")

    for (const item of result.undefinedRefs)
      console.error(`  ${item.name} -> ${item.files.join(", ")}`)

    process.exitCode = 1
  }

  if (result.unusedTokens.length) {
    console.error("Unused tokens:")

    for (const name of result.unusedTokens) console.error(`  ${name}`)

    process.exitCode = 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main()
