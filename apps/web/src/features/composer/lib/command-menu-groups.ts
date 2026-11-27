import type { ComposerCommand, FileSearchEntry } from "@/types/common-type.js"
import type {
  ChipInsert,
  CommandMenuGroup,
  CommandMenuRow,
  MentionSession,
} from "@features/composer/type.js"

export const DIR_PREFIX = "dir:"
export const FILE_PREFIX = "file:"
export const SKILL_PREFIX = "skill:"
export const TEMPLATE_PREFIX = "template:"
export const BUILTIN_PREFIX = "builtin:"
export const SESSION_PREFIX = "session:"
export const CLEAR_COMMAND = "clear"
export const COMPACT_COMMAND = "compact"
export const RELOAD_COMMAND = "reload"
const MENTION_SESSION_LIMIT = 5

export interface CommandGroupSource {
  kind: "none" | "mention" | "command"
  query: string
  clearApplicable: boolean
  hasSession?: boolean
  files: FileSearchEntry[]
  sessions?: readonly MentionSession[]
  skills: ComposerCommand[]
  prompts: ComposerCommand[]
  label(key: string): string
}

export function buildCommandGroups(source: CommandGroupSource): CommandMenuGroup[] {
  if (source.kind === "mention") {
    const groups: CommandMenuGroup[] = [
      {
        id: "sessions",
        label: source.label("composer.commandSessions"),
        rows: sessionRows(source),
      },
      { id: "files", label: source.label("composer.commandFiles"), rows: fileRows(source) },
    ]
    return groups.filter((group) => group.rows.length > 0)
  }

  if (source.kind !== "command") return []
  const rows = commandRows(source)
  return COMMAND_GROUPS.map(([id, key, prefix]) => ({
    id,
    label: source.label(key),
    rows: rows.filter((row) => row.id.startsWith(prefix)),
  })).filter((group) => group.rows.length > 0)
}

const COMMAND_GROUPS = [
  ["builtin", "composer.commandBuiltin", BUILTIN_PREFIX],
  ["templates", "composer.commandTemplates", TEMPLATE_PREFIX],
  ["skills", "composer.commandSkills", SKILL_PREFIX],
] as const

function sessionRows(source: CommandGroupSource): CommandMenuRow[] {
  return (source.sessions ?? []).slice(0, MENTION_SESSION_LIMIT).map((session) => ({
    id: `${SESSION_PREFIX}${session.id}`,
    title: session.title,
    secondary: session.project,
    kind: "session",
  }))
}

function fileRows(source: CommandGroupSource): CommandMenuRow[] {
  return source.files.map((entry) => {
    const directory = entry.kind === "directory"
    return {
      id: `${directory ? DIR_PREFIX : FILE_PREFIX}${entry.path}`,
      title: basename(entry.path),
      secondary: directory ? undefined : parentPath(entry.path),
      directory,
      kind: directory ? "directory" : "file",
    }
  })
}

function commandRows(source: CommandGroupSource): CommandMenuRow[] {
  const templates = source.prompts.map((prompt) => prompt.name)
  const builtins = source.clearApplicable
    ? [
        { name: CLEAR_COMMAND, labelKey: "composer.builtinClear", sessionOnly: false },
        { name: COMPACT_COMMAND, labelKey: "composer.builtinCompact", sessionOnly: true },
        { name: RELOAD_COMMAND, labelKey: "composer.builtinReload", sessionOnly: true },
      ]
        .filter(
          (entry) => (!entry.sessionOnly || source.hasSession) && !templates.includes(entry.name),
        )
        .map((entry) => ({
          id: `${BUILTIN_PREFIX}${entry.name}`,
          title: `/${entry.name}`,
          secondary: source.label(entry.labelKey),
          kind: "builtin" as const,
        }))
    : []
  const skillRows = source.skills.map((skill) => ({
    id: `${SKILL_PREFIX}${skill.name}`,
    title: `/skill:${skill.name}`,
    secondary: skill.description,
    kind: "skill" as const,
  }))
  const templateRows = source.prompts.map((prompt) => ({
    id: `${TEMPLATE_PREFIX}${prompt.name}`,
    title: `/${prompt.name}`,
    secondary: prompt.argumentHint ?? prompt.description,
    kind: "template" as const,
  }))
  const query = source.query.toLowerCase()
  const rows = [...builtins, ...skillRows, ...templateRows]
  return query ? rows.filter((row) => row.title.slice(1).toLowerCase().includes(query)) : rows
}

export function chipForRow(
  row: CommandMenuRow,
  start: number,
  triggerLength: number,
): ChipInsert | undefined {
  const { id } = row
  const range = { start, triggerLength }

  if (id.startsWith(SESSION_PREFIX)) {
    return {
      kind: "session",
      sessionId: id.slice(SESSION_PREFIX.length),
      label: row.title,
      ...range,
    }
  }

  if (id.startsWith(BUILTIN_PREFIX)) {
    const name = id.slice(BUILTIN_PREFIX.length)
    return name === CLEAR_COMMAND ? undefined : { ...range, kind: "builtin", label: name }
  }

  if (id.startsWith(SKILL_PREFIX)) {
    return { ...range, kind: "skill", label: id.slice(SKILL_PREFIX.length) }
  }

  if (id.startsWith(TEMPLATE_PREFIX)) {
    return { ...range, kind: "template", label: id.slice(TEMPLATE_PREFIX.length) }
  }

  if (!id.startsWith(FILE_PREFIX)) return undefined
  const path = id.slice(FILE_PREFIX.length)
  return { ...range, kind: "file", label: basename(path), path }
}

export function basename(path: string): string {
  return path.split("/").filter(Boolean).pop() ?? path
}

export function parentPath(path: string): string | undefined {
  const at = path.lastIndexOf("/")
  return at > 0 ? path.slice(0, at) : undefined
}
