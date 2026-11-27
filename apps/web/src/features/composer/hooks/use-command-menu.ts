import { shallowRef, watch, type Ref } from "vue"
import { useI18n } from "@i18n/index.js"
import { listWorkspaceCommands, searchWorkspaceFiles } from "@client/platform.js"
import type {
  TriggerDefinition,
  TriggerMenuData,
  TriggerMenuSelectDetails,
} from "@pig/ui/trigger-menu"
import type { ComposerCommand } from "@/types/common-type.js"
import type {
  ChipInsert,
  CommandMenuGroup,
  CommandMenuRow,
  MentionSession,
} from "@features/composer/type.js"
import { composerTriggerAt } from "@features/composer/lib/composer-trigger.js"
import {
  BUILTIN_PREFIX,
  CLEAR_COMMAND,
  DIR_PREFIX,
  buildCommandGroups,
  chipForRow,
} from "@features/composer/lib/command-menu-groups.js"

export interface CommandMenuOptions {
  prompt: Ref<string>
  caret: Ref<number>
  inCode(): boolean
  cwd(): string | undefined
  hasSession?(): boolean
  mentionSessions?(query: string): readonly MentionSession[]
  reloadRevision?(): number | undefined
  markdownOffset(pos: number): number
  onChip(chip: ChipInsert): void
  onReplaceText(start: number, triggerLength: number, text: string): void
}

interface Commands {
  skills: ComposerCommand[]
  prompts: ComposerCommand[]
}

export function useCommandMenu(options: CommandMenuOptions) {
  const { t } = useI18n()
  const rows = shallowRef(new Map<string, CommandMenuRow>())
  let commandsFor = ""
  let commands: Commands = { skills: [], prompts: [] }

  watch(
    () => options.reloadRevision?.(),
    () => {
      commandsFor = ""
    },
  )

  function toData(groups: CommandMenuGroup[]): TriggerMenuData {
    rows.value = new Map(groups.flatMap((group) => group.rows.map((row) => [row.id, row])))
    return groups.map((group) => ({
      type: "group",
      ...(group.label && { label: group.label }),
      items: group.rows.map((row) => ({ value: row.id, label: row.title })),
    }))
  }

  function source(kind: "mention" | "command", query: string) {
    return {
      kind,
      query,
      clearApplicable: clearApplicable(),
      hasSession: options.hasSession?.() ?? false,
      files: [],
      ...commands,
      label: (key: string) => t(key),
    }
  }

  function clearApplicable(): boolean {
    const prompt = options.prompt.value
    const trigger = composerTriggerAt(prompt, options.caret.value)

    if (trigger?.kind !== "command") return false
    return prompt.trim() === prompt.slice(trigger.start, options.caret.value).trim()
  }

  async function mentions(query: string, { signal }: { signal: AbortSignal }) {
    const dir = options.cwd()
    const files = dir ? await searchWorkspaceFiles(dir, query, signal).catch(() => []) : []
    const sessions = options.mentionSessions?.(query) ?? []
    return toData(buildCommandGroups({ ...source("mention", query), files, sessions }))
  }

  async function workspaceCommands(query: string) {
    const dir = options.cwd()

    if (dir && commandsFor !== dir) {
      const loaded = await listWorkspaceCommands(dir).catch(() => undefined)
      commands = { skills: loaded?.skills ?? [], prompts: loaded?.prompts ?? [] }

      if (loaded?.skills.length || loaded?.prompts.length) commandsFor = dir
    }

    return toData(buildCommandGroups(source("command", query)))
  }

  const triggers: TriggerDefinition[] = [
    { char: '@"', spaces: true, pattern: /[^"\n]/u, items: mentions },
    { char: "@", pattern: /[^\s"]/u, items: mentions },
    { char: "/", boundary: "line", pattern: /[^\s/]/u, items: workspaceCommands },
  ]

  function onOpenChange(open: boolean, details: { cancel(): void }) {
    if (open && (options.inCode() || !options.cwd())) details.cancel()
  }

  function onSelect(id: string, details: TriggerMenuSelectDetails) {
    details.preventDefault()
    const start = options.markdownOffset(details.match.start)
    const length = options.markdownOffset(details.match.end) - start

    if (id.startsWith(DIR_PREFIX)) {
      options.onReplaceText(start, length, `@${id.slice(DIR_PREFIX.length)}`)
      return
    }

    if (id === `${BUILTIN_PREFIX}${CLEAR_COMMAND}`) {
      options.prompt.value = ""
      options.caret.value = 0
      return
    }

    const row = rows.value.get(id)
    const chip = row && chipForRow(row, start, length)

    if (chip) options.onChip(chip)
  }

  function emptyText(trigger: string | null): string {
    return t(trigger === "/" ? "composer.commandEmptyCommand" : "composer.commandEmptyFile")
  }

  return { triggers, rows, onOpenChange, onSelect, emptyText }
}
