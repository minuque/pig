/** 读取手写的数据流，校验每步 ref（路径#导出名[.成员]）仍指向真实代码。 */
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import ts from "typescript"

export const FLOWS_FILE = "docs/architecture/flows.ts"

export async function loadFlows(root) {
  const { flows } = await import(pathToFileURL(join(root, FLOWS_FILE)).href)
  return flows
}

function exportedDeclarations(file) {
  const out = new Map()
  const exported = (node) =>
    ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Export ||
    ts.isExportDeclaration(node.parent)

  for (const stmt of file.statements) {
    if (ts.isVariableStatement(stmt) && exported(stmt))
      for (const decl of stmt.declarationList.declarations) out.set(decl.name.getText(), decl)
    else if (stmt.name && exported(stmt)) out.set(stmt.name.text, stmt)
  }

  return out
}

function hasMember(decl, member) {
  const members = decl.members ?? decl.initializer?.properties ?? []
  return members.some((m) => m.name?.getText() === member)
}

export function validateFlows(root, flows) {
  const errors = []
  const cache = new Map()

  for (const flow of flows)
    for (const step of flow.steps) {
      if (!step.ref) continue
      const [path, symbol] = step.ref.split("#")
      const where = `${flow.id}: ${step.ref}`

      if (!existsSync(join(root, path))) {
        errors.push(`${where} 文件不存在`)
        continue
      }

      if (!symbol || !/\.[cm]?ts$/.test(path)) continue

      if (!cache.has(path)) {
        const text = readFileSync(join(root, path), "utf8")
        const file = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true)
        cache.set(path, exportedDeclarations(file))
      }

      const [name, member] = symbol.split(".")
      const decl = cache.get(path).get(name)

      if (!decl) errors.push(`${where} 没有导出 ${name}`)
      else if (member && !hasMember(decl, member))
        errors.push(`${where} ${name} 没有成员 ${member}`)
    }

  return errors
}
