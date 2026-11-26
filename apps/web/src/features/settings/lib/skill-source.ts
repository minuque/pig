const FRONTMATTER = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/
const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export interface SkillSourceCheck {
  error?: "frontmatter" | "description"
  warning?: true
}

function field(header: string, key: string): string {
  const match = new RegExp(`^${key}:[ \t]*(.*)$`, "m").exec(header)
  return match?.[1]?.trim().replace(/^["']|["']$/g, "") ?? ""
}

export function checkSkillSource(raw: string): SkillSourceCheck {
  const header = FRONTMATTER.exec(raw)?.[1]

  if (header === undefined) return { error: "frontmatter" }

  if (!field(header, "description")) return { error: "description" }
  const name = field(header, "name")
  return name && SKILL_NAME.test(name) ? {} : { warning: true }
}

export function skillBody(raw: string): string {
  return raw.replace(FRONTMATTER, "").replace(/^\s*\n/, "")
}

export function isValidSkillName(name: string): boolean {
  return SKILL_NAME.test(name)
}

export function samePath(a: string, b: string): boolean {
  const norm = (path: string) => path.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase()
  return norm(a) === norm(b)
}

export function deleteTarget(
  filePath: string,
  roots: readonly string[],
): { path: string; standard: boolean } {
  const parent = (path: string) => path.replace(/[\\/][^\\/]+$/, "")
  const isDir = /[\\/]SKILL\.md$/.test(filePath)
  const path = isDir ? parent(filePath) : filePath
  return { path, standard: roots.some((root) => samePath(root, parent(path))) }
}
