import { existsSync } from "node:fs"
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { basename, dirname, join, relative, resolve, sep } from "node:path"
import {
  DefaultPackageManager,
  DefaultResourceLoader,
  parseFrontmatter,
  type ResolvedResource,
  type Skill,
} from "@earendil-works/pi-coding-agent"
import type {
  AgentConfigScope,
  SkillDiagnosticView,
  SkillFileView,
  SkillScopeView,
  SkillView,
} from "@pig/protocol"

import { settingsWithoutPackages } from "./resource-loader.js"

const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const MAX_FILES = 200

function key(path: string): string {
  const full = resolve(path)
  return process.platform === "win32" ? full.toLowerCase() : full
}

function settingsFile(agentDir: string, scope: AgentConfigScope): string {
  return scope === "global" ? join(agentDir, "settings.json") : join(scope, ".pi", "settings.json")
}

function settingsBase(agentDir: string, scope: AgentConfigScope): string {
  return scope === "global" ? agentDir : join(scope, ".pi")
}

async function frontmatter(path: string): Promise<Record<string, unknown>> {
  try {
    return parseFrontmatter<Record<string, unknown>>(await readFile(path, "utf8")).frontmatter
  } catch {
    return {}
  }
}

async function viewOf(resource: ResolvedResource, loaded: Skill | undefined): Promise<SkillView> {
  if (loaded)
    return {
      name: loaded.name,
      description: loaded.description,
      filePath: resource.path,
      enabled: resource.enabled,
      disableModelInvocation: loaded.disableModelInvocation,
    }

  const meta = await frontmatter(resource.path)
  return {
    name:
      typeof meta.name === "string" ? meta.name : (dirname(resource.path).split(sep).pop() ?? ""),
    description: typeof meta.description === "string" ? meta.description : "",
    filePath: resource.path,
    enabled: resource.enabled,
    disableModelInvocation: meta["disable-model-invocation"] === true,
  }
}

async function scan(agentDir: string, scope: AgentConfigScope) {
  const cwd = scope === "global" ? agentDir : scope
  const settingsManager = settingsWithoutPackages(cwd, agentDir)
  const resolved = (await new DefaultPackageManager({ cwd, agentDir, settingsManager }).resolve())
    .skills
  const loader = new DefaultResourceLoader({ cwd, agentDir, settingsManager, noExtensions: true })

  await loader.reload()
  const result = loader.getSkills()
  return { resolved, skills: result.skills, diagnostics: result.diagnostics }
}

export async function listSkills(
  agentDir: string,
  scope: AgentConfigScope,
): Promise<SkillScopeView> {
  const { resolved, skills, diagnostics } = await scan(agentDir, scope)
  const loaded = new Map(skills.map((skill) => [key(skill.filePath), skill]))
  const own: SkillView[] = []
  const inherited: SkillView[] = []
  const issues: SkillDiagnosticView[] = []
  const ownPaths = new Set<string>()

  for (const resource of resolved) {
    const isOwn = scope === "global" || resource.metadata.scope === "project"

    if (scope === "global" && resource.metadata.scope !== "user") continue
    const skill = loaded.get(key(resource.path))
    const view = await viewOf(resource, skill)

    if (isOwn) ownPaths.add(key(resource.path))

    if (resource.enabled && !skill) {
      if (!isOwn) continue

      const messages = diagnostics
        .filter((d) => d.type !== "collision" && d.path && key(d.path) === key(resource.path))
        .map((d) => d.message)

      issues.push({
        kind: "broken",
        path: resource.path,
        name: view.name,
        message: messages.join("; "),
      })
      continue
    }

    ;(isOwn ? own : inherited).push(view)
  }

  for (const d of diagnostics) {
    const loser = d.collision?.loserPath

    if (d.type === "collision" && loser && ownPaths.has(key(loser)))
      issues.push({
        kind: "collision",
        path: loser,
        name: d.collision?.name ?? "",
        message: d.message,
      })
  }

  const roots =
    scope === "global"
      ? [join(agentDir, "skills"), join(homedir(), ".agents", "skills")]
      : [join(scope, ".pi", "skills"), join(scope, ".agents", "skills")]
  return { roots, skills: own, inherited, diagnostics: issues }
}

export async function isKnownSkillPath(
  agentDir: string,
  scope: AgentConfigScope,
  path: string,
): Promise<boolean> {
  const view = await listSkills(agentDir, scope)
  const known = [...view.skills, ...view.inherited]
    .map((skill) => skill.filePath)
    .concat(view.diagnostics.map((d) => d.path))
  return known.some((item) => key(item) === key(path))
}

function expandHome(path: string): string {
  return path === "~" || path.startsWith("~/") ? join(homedir(), path.slice(1)) : path
}

export async function setSkillEnabled(
  agentDir: string,
  scope: AgentConfigScope,
  filePath: string,
  enabled: boolean,
): Promise<void> {
  const file = settingsFile(agentDir, scope)
  const base = settingsBase(agentDir, scope)
  const text = existsSync(file) ? await readFile(file, "utf8") : undefined
  const clean = text?.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  const parsed = (clean ? JSON.parse(clean) : {}) as Record<string, unknown>
  const current = Array.isArray(parsed.skills) ? (parsed.skills as unknown[]) : []
  const excludes = (entry: unknown) =>
    typeof entry === "string" &&
    entry.startsWith("-") &&
    key(resolve(base, expandHome(entry.slice(1)))) === key(filePath)
  const next = current.filter((entry) => !excludes(entry))

  if (!enabled) next.push(`-${filePath}`)
  parsed.skills = next
  const indent = (clean && /^([ \t]+)\S/m.exec(clean)?.[1]) || "  "

  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, `${JSON.stringify(parsed, null, indent)}\n`)
}

async function listFiles(root: string, dir = root, out: string[] = []): Promise<string[]> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (out.length >= MAX_FILES) break
    const full = join(dir, entry.name)

    if (entry.isDirectory()) await listFiles(root, full, out)
    else if (full !== join(root, "SKILL.md")) out.push(relative(root, full).split(sep).join("/"))
  }

  return out
}

function isSkillDir(path: string): boolean {
  return basename(path) === "SKILL.md"
}

export async function readSkillFile(path: string): Promise<SkillFileView> {
  const raw = await readFile(path, "utf8")
  return { raw, files: isSkillDir(path) ? (await listFiles(dirname(path))).sort() : [] }
}

export async function writeSkillFile(path: string, raw: string): Promise<void> {
  parseFrontmatter(raw)
  await writeFile(path, raw)
}

export async function createSkill(
  agentDir: string,
  scope: AgentConfigScope,
  name: string,
  description: string,
): Promise<string> {
  if (!SKILL_NAME.test(name)) throw new Error(`invalid skill name "${name}"`)

  const dir =
    scope === "global" ? join(agentDir, "skills", name) : join(scope, ".pi", "skills", name)

  if (existsSync(dir)) throw new Error(`skill "${name}" already exists`)
  const file = join(dir, "SKILL.md")

  await mkdir(dir, { recursive: true })
  await writeFile(
    file,
    `---\nname: ${name}\ndescription: ${JSON.stringify(description)}\n---\n\n# ${name}\n`,
  )
  return file
}

export async function deleteSkill(path: string): Promise<void> {
  if (isSkillDir(path)) await rm(dirname(path), { recursive: true, force: true })
  else await rm(path, { force: true })
}
