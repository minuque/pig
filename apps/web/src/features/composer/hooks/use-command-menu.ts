import { computed, nextTick, onScopeDispose, ref, watch, type Ref } from "vue"
import { listWorkspaceCommands, searchWorkspaceFiles } from "@client/platform.js"
import type { ComposerCommand, FileSearchEntry } from "@/types/common-type.js"
import type {
  CommandMenuGroup,
  CommandMenuRow,
  CommandMenuRowKind,
} from "@features/composer/components/CommandMenu.vue"
import {
  composerTriggerAt,
  mentionPathNeedsQuoting,
  type ComposerTrigger,
} from "@features/composer/lib/composer-trigger.js"

const DIR_PREFIX = "dir:"
const FILE_PREFIX = "file:"
const SKILL_PREFIX = "skill:"
const TEMPLATE_PREFIX = "template:"
const BUILTIN_PREFIX = "builtin:"
const BUILTIN_COMMANDS = [{ name: "clear", description: "清空输入草稿" }]

export interface CommandMenuApi {
  open: Ref<boolean>
  groups: Ref<CommandMenuGroup[]>
  activeId: Ref<string | null>
  loading: Ref<boolean>
  emptyText: Ref<string>
  onKeydown(event: KeyboardEvent): boolean
  select(id: string): void
  close(): void
}

export interface ChipInsert {
  kind: "skill" | "template" | "builtin" | "file"
  label: string
  token: string
  start: number
  triggerLength: number
  caret: number
}

export function useCommandMenu(
  prompt: Ref<string>,
  caret: Ref<number>,
  cwd: () => string | undefined,
  onChip: (chip: ChipInsert) => void,
): CommandMenuApi {
  const open = ref(false)
  const trigger = ref<ComposerTrigger>(null)
  const files = ref<FileSearchEntry[]>([])
  const skills = ref<ComposerCommand[]>([])
  const prompts = ref<ComposerCommand[]>([])
  const loading = ref(false)
  const activeId = ref<string | null>(null)
  let fetchSeq = 0
  let skillsFor = ""
  const fileRows = computed<CommandMenuRow[]>(() =>
    files.value.map((entry) => ({
      id: `${entry.kind === "directory" ? DIR_PREFIX : FILE_PREFIX}${entry.path}`,
      title: entry.path.split("/").filter(Boolean).pop() ?? entry.path,
      secondary: entry.kind === "directory" ? undefined : parentPath(entry.path),
      directory: entry.kind === "directory",
      kind: entry.kind === "directory" ? "directory" : "file",
      trailing: entry.kind === "directory" ? "目录" : undefined,
    })),
  )
  const clearApplicable = computed(() => {
    const start = trigger.value?.start

    if (start === undefined || trigger.value?.kind !== "command") return false
    return prompt.value.trim() === prompt.value.slice(start, caret.value).trim()
  })
  const commandRows = computed<CommandMenuRow[]>(() => {
    const query = trigger.value?.kind === "command" ? trigger.value.query.toLowerCase() : ""
    const templateNames = new Set(prompts.value.map((prompt) => prompt.name))
    const commands: Array<{
      key: string
      name: string
      description: string
      hint?: string | undefined
      kind: CommandMenuRowKind
    }> = [
      ...BUILTIN_COMMANDS.filter(
        (command) => clearApplicable.value && !templateNames.has(command.name),
      ).map((command) => ({
        ...command,
        key: `${BUILTIN_PREFIX}${command.name}`,
        kind: "builtin" as const,
      })),
      ...skills.value.map((skill) => ({
        key: `${SKILL_PREFIX}${skill.name}`,
        name: `skill:${skill.name}`,
        description: skill.description,
        kind: "skill" as const,
      })),
      ...prompts.value.map((prompt) => ({
        key: `${TEMPLATE_PREFIX}${prompt.name}`,
        name: prompt.name,
        description: prompt.description,
        hint: prompt.argumentHint,
        kind: "template" as const,
      })),
    ]
    return commands
      .filter((command) => !query || command.name.toLowerCase().includes(query))
      .map((command) => ({
        id: command.key,
        title: `/${command.name}`,
        secondary: command.hint ?? command.description,
        kind: command.kind,
        trailing: command.key.startsWith(SKILL_PREFIX)
          ? "技能"
          : command.key.startsWith(TEMPLATE_PREFIX)
            ? "模板"
            : "命令",
      }))
  })
  const groups = computed<CommandMenuGroup[]>(() => {
    if (trigger.value?.kind === "mention") {
      return fileRows.value.length ? [{ id: "files", label: "文件", rows: fileRows.value }] : []
    }

    if (trigger.value?.kind === "command") {
      const builtin = commandRows.value.filter((row) => row.id.startsWith(BUILTIN_PREFIX))
      const skill = commandRows.value.filter((row) => row.id.startsWith(SKILL_PREFIX))
      const template = commandRows.value.filter((row) => row.id.startsWith(TEMPLATE_PREFIX))
      const next: CommandMenuGroup[] = []

      if (builtin.length) next.push({ id: "builtin", label: "内置", rows: builtin })

      if (template.length) next.push({ id: "templates", label: "模板", rows: template })

      if (skill.length) next.push({ id: "skills", label: "技能", rows: skill })
      return next
    }

    return []
  })
  const flatRows = computed(() => groups.value.flatMap((group) => group.rows))
  const emptyText = computed(() =>
    trigger.value?.kind === "mention" ? "没有匹配的文件" : "没有匹配的命令",
  )

  watch([prompt, caret, () => cwd()], () => void refresh(), { flush: "post" })

  let debounce: ReturnType<typeof setTimeout> | undefined
  let fetchController: AbortController | undefined

  function scheduleFetch(run: (signal: AbortSignal) => Promise<void>, delay: number) {
    if (debounce) clearTimeout(debounce)
    fetchController?.abort()
    const controller = new AbortController()
    fetchController = controller
    debounce = setTimeout(() => {
      debounce = undefined
      void run(controller.signal)
    }, delay)
  }

  async function refresh() {
    const next = composerTriggerAt(prompt.value, caret.value)
    const dir = cwd()

    if (!next || !dir) {
      open.value = false
      trigger.value = null
      files.value = []
      cancelFetch()
      return
    }

    const changed =
      next.kind !== trigger.value?.kind ||
      next.query !== trigger.value.query ||
      next.start !== trigger.value.start

    trigger.value = next

    if (!changed && open.value) return
    open.value = true
    activeId.value = null
    const seq = ++fetchSeq

    if (next.kind === "mention") {
      scheduleFetch(async (signal) => {
        loading.value = true

        try {
          const entries = await searchWorkspaceFiles(dir, next.query, signal)

          if (seq === fetchSeq) files.value = entries
        } catch {
          if (seq === fetchSeq && !signal.aborted) files.value = []
        } finally {
          if (seq === fetchSeq) loading.value = false
        }
      }, 150)
      return
    }

    files.value = []

    if (skillsFor === dir) {
      loading.value = false
      return
    }

    loading.value = true

    try {
      const loaded = await listWorkspaceCommands(dir)

      if (seq === fetchSeq) {
        skills.value = loaded.skills
        prompts.value = loaded.prompts

        if (loaded.skills.length || loaded.prompts.length) skillsFor = dir
      }
    } catch {
      if (seq === fetchSeq) {
        skills.value = []
        prompts.value = []
      }
    } finally {
      if (seq === fetchSeq) loading.value = false
    }
  }

  function cancelFetch() {
    if (debounce) clearTimeout(debounce)
    debounce = undefined
    fetchController?.abort()
    fetchController = undefined
  }

  onScopeDispose(cancelFetch)

  function move(step: 1 | -1) {
    const rows = flatRows.value

    if (!rows.length) return
    const index = rows.findIndex((row) => row.id === activeId.value)
    activeId.value = rows[(index + step + rows.length) % rows.length]?.id ?? rows[0]!.id
  }

  function onKeydown(event: KeyboardEvent): boolean {
    if (event.isComposing) return false

    if (!open.value) return false

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault()
        move(1)
        return true
      case "ArrowUp":
        event.preventDefault()
        move(-1)
        return true
      case "Enter":
      case "Tab": {
        const id = activeId.value ?? flatRows.value[0]?.id

        if (!id) return false
        event.preventDefault()
        select(id)
        return true
      }

      case "Escape":
        event.preventDefault()
        event.stopPropagation()
        close()
        return true
      default:
        return false
    }
  }

  function select(id: string) {
    const start = trigger.value?.start
    const kind = trigger.value?.kind

    if (start === undefined || !kind) return

    if (id.startsWith(DIR_PREFIX)) {
      const prefix = id.slice(DIR_PREFIX.length)

      prompt.value = `${prompt.value.slice(0, start)}@${prefix}${prompt.value.slice(caret.value)}`
      void nextTick(() => {
        caret.value = start + prefix.length + 1
      })
      return
    }

    if (id.startsWith(BUILTIN_PREFIX)) {
      prompt.value = ""
      caret.value = 0
      close()
      return
    }

    const triggerLength = caret.value - start
    const base = { start, triggerLength }

    if (id.startsWith(SKILL_PREFIX)) {
      const name = id.slice(SKILL_PREFIX.length)
      onChip({
        ...base,
        kind: "skill",
        label: name,
        token: `/skill:${name} `,
        caret: start + `/skill:${name} `.length,
      })
    } else if (id.startsWith(TEMPLATE_PREFIX)) {
      const name = id.slice(TEMPLATE_PREFIX.length)
      onChip({
        ...base,
        kind: "template",
        label: name,
        token: `/${name} `,
        caret: start + `/${name} `.length,
      })
    } else if (id.startsWith(FILE_PREFIX)) {
      const path = id.slice(FILE_PREFIX.length)
      const label = path.split("/").filter(Boolean).pop() ?? path
      const token = mentionPathNeedsQuoting(path) ? `@${JSON.stringify(path)} ` : `@${path} `
      onChip({ ...base, kind: "file", label, token, caret: start + token.length })
    }

    close()
  }

  function close() {
    cancelFetch()
    open.value = false
    trigger.value = null
    activeId.value = null
  }

  return { open, groups, activeId, loading, emptyText, onKeydown, select, close }
}

function parentPath(path: string): string | undefined {
  const at = path.lastIndexOf("/")
  return at > 0 ? path.slice(0, at) : undefined
}
