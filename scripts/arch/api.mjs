import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import ts from "typescript"

const SERVER_DIR = "packages/gateway/src/server"
const WIRE = "packages/protocol/src/wire.ts"
const METHOD = /method\s*[!=]==\s*"([A-Z]+)"/g
const ROUTE_KEY = /^(?:GET|POST|PUT|PATCH|DELETE|HEAD) (\/api\/\S+)$/
const parse = (root, id) =>
  ts.createSourceFile(id, readFileSync(join(root, id), "utf8"), ts.ScriptTarget.Latest, true)

function visit(node, fn) {
  fn(node)
  ts.forEachChild(node, (child) => visit(child, fn))
}

const methodsIn = (text) => [...new Set([...text.matchAll(METHOD)].map((m) => m[1]))]

export function expandPattern(source) {
  let n = 0
  const body = source.replace(/^\^/, "").replace(/\$$/, "").replaceAll("\\/", "/")
  const expand = (text) => {
    const open = text.indexOf("(")

    if (open < 0) return [text]

    let depth = 0
    let close = open

    for (; close < text.length; close++) {
      if (text[close] === "(") depth++

      if (text[close] === ")" && --depth === 0) break
    }

    const inner = text.slice(open + 1, close)
    const capture = !inner.startsWith("?:")
    const content = capture ? inner : inner.slice(2)
    const heads =
      capture && content === "[^/]+"
        ? [`:${++n}`]
        : splitTop(content).flatMap((branch) => expand(branch))
    const tails = expand(text.slice(close + 1))
    return heads.flatMap((h) => tails.map((t) => text.slice(0, open) + h + t))
  }

  return expand(body)
}

function splitTop(text) {
  const parts = []
  let depth = 0
  let start = 0

  for (let i = 0; i < text.length; i++) {
    if (text[i] === "(") depth++

    if (text[i] === ")") depth--

    if (text[i] === "|" && depth === 0) {
      parts.push(text.slice(start, i))
      start = i + 1
    }
  }

  parts.push(text.slice(start))
  return parts
}

function fileRoutes(root, id) {
  const file = parse(root, id)
  const consts = new Map()
  const execVars = new Map()
  const routes = []
  const add = (paths, methods) => {
    for (const path of paths)
      for (const method of methods.length ? methods : ["ANY"])
        routes.push({ method, path, handler: id })
  }

  visit(file, (node) => {
    if (!ts.isVariableDeclaration(node) || !node.initializer) return
    const init = node.initializer
    const name = node.name.getText()

    if (ts.isRegularExpressionLiteral(init) || ts.isStringLiteral(init)) consts.set(name, init)

    if (ts.isCallExpression(init) && init.expression.getText().endsWith(".exec"))
      execVars.set(name, init.expression.expression)
  })

  const chainOf = (node) => {
    let top = node

    while (ts.isBinaryExpression(top.parent) || ts.isParenthesizedExpression(top.parent))
      top = top.parent
    return top.getText()
  }
  const regexSource = (node) => {
    const literal = ts.isIdentifier(node) ? consts.get(node.text) : node

    if (!literal || !ts.isRegularExpressionLiteral(literal)) return undefined
    return literal.text.slice(1, literal.text.lastIndexOf("/"))
  }

  visit(file, (node) => {
    if (ts.isStringLiteral(node)) {
      const key = ROUTE_KEY.exec(node.text)

      if (key) add([key[1]], [node.text.slice(0, node.text.indexOf(" "))])
    }

    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken &&
      node.left.getText().endsWith(".pathname") &&
      ts.isStringLiteral(node.right)
    )
      add([node.right.text], methodsIn(chainOf(node)))

    if (ts.isIfStatement(node)) {
      const cond = node.expression.getText()

      for (const [name, target] of execVars) {
        const source = regexSource(target)

        if (source && new RegExp(`^${name}\\b`).test(cond))
          add(expandPattern(source), methodsIn(cond))
      }

      const prefix = /pathname\.startsWith\((\w+)\)/.exec(cond)?.[1]
      const literal = prefix && consts.get(prefix)

      if (literal && ts.isStringLiteral(literal)) add([`${literal.text}*`], methodsIn(cond))
    }

    if (ts.isRegularExpressionLiteral(node) && !ts.isVariableDeclaration(node.parent)) {
      const source = regexSource(node)
      let fn = node.parent

      while (fn && !ts.isFunctionLike(fn)) fn = fn.parent

      if (source?.startsWith("^\\/api")) add(expandPattern(source), methodsIn(fn.getText()))
    }
  })
  return routes
}

function webCallSites(root) {
  const sites = []
  const walk = (dir) => {
    for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
      const id = `${dir}/${entry.name}`

      if (entry.isDirectory()) walk(id)
      else if (/\.(?:ts|vue)$/.test(entry.name)) {
        const text = readFileSync(join(root, id), "utf8").replace(/\$\{[^}]*\}/g, "\0")

        for (const m of text.matchAll(/["'`](?:[A-Z]+ )?(\/api\/[^"'`?]*)/g))
          sites.push({ id, url: m[1] })
      }
    }
  }

  walk("apps/web/src")
  return sites
}

const routeMatcher = (path) =>
  new RegExp(
    `^${path
      .replace(/[.]/g, "\\.")
      .replace(/\/:[A-Za-z]\w*/g, "/[^/]+")
      .replace(/:\d+/g, "[^/]+")
      .replace(/\*$/, ".*")}$`,
  )

function unionLiterals(file, typeName, key) {
  const out = []

  visit(file, (node) => {
    if (!ts.isTypeAliasDeclaration(node) || node.name.text !== typeName) return
    visit(node.type, (member) => {
      if (
        ts.isPropertySignature(member) &&
        member.name.getText() === key &&
        member.type &&
        ts.isLiteralTypeNode(member.type)
      )
        out.push(member.type.literal.text)
    })
  })
  return out
}

export function scanApi(root) {
  const servers = readdirSync(join(root, SERVER_DIR)).filter((f) => f.endsWith(".ts"))
  const sites = webCallSites(root)
  const seen = new Set()
  const http = servers
    .flatMap((name) => fileRoutes(root, `${SERVER_DIR}/${name}`))
    .filter((r) => {
      const key = `${r.method} ${r.path}`

      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .map((route) => {
      const match = routeMatcher(route.path)
      const callers = sites.filter((s) => match.test(s.url.replaceAll("\0", "x"))).map((s) => s.id)
      return { ...route, callers: [...new Set(callers)] }
    })
  const wire = parse(root, WIRE)
  return {
    http,
    ws: {
      path: /WEBSOCKET_PATH = "([^"]+)"/.exec(
        readFileSync(join(root, SERVER_DIR, "websocket.ts"), "utf8"),
      )?.[1],
      commands: unionLiterals(wire, "Command", "command"),
      events: unionLiterals(wire, "ServerEvent", "type"),
    },
  }
}
