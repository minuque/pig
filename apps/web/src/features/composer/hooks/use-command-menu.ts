import { computed, onScopeDispose, ref, useId, watch, type Ref } from "vue"
import { useI18n } from "@i18n/index.js"
import { listWorkspaceCommands, searchWorkspaceFiles } from "@client/platform.js"
import type { ComposerCommand, FileSearchEntry } from "@/types/common-type.js"
import type { ChipInsert, CommandMenuGroup, CommandMenuRow } from "@features/composer/type.js"
import {
  composerTriggerAt,
  triggerKey,
  type ComposerTrigger,
} from "@features/composer/lib/composer-trigger.js"
import {
  BUILTIN_PREFIX,
  CLEAR_COMMAND,
  DIR_PREFIX,
  buildCommandGroups,
  chipForRow,
} from "@features/composer/lib/command-menu-groups.js"

const MENU_ID = "composer-command-menu"
const SEARCH_DELAY = 150

export interface CommandMenuApi {
  open: Ref<boolean>
  menuId: string
  groups: Ref<CommandMenuGroup[]>
  activeId: Ref<string | null>
  activeDescendantId: Ref<string | undefined>
  loading: Ref<boolean>
  emptyText: Ref<string>
  onKeydown(event: KeyboardEvent): boolean
  select(id: string): void
  close(): void
  dismiss(): void
}

export interface CommandMenuOptions {
  prompt: Ref<string>
  caret: Ref<number>
  edited: Ref<boolean>
  inCode(): boolean
  cwd(): string | undefined
  hasSession?(): boolean
  reloadRevision?(): number | undefined
  onChip(chip: ChipInsert): void
  onReplaceText(start: number, triggerLength: number, text: string): void
}

let menuSeq = 0

export function commandRowId(id: string, menuId = MENU_ID): string {
  return `${menuId}-row-${encodeURIComponent(id)}`
}

export function useCommandMenu(options: CommandMenuOptions): CommandMenuApi {
  const { t } = useI18n()
  const menuId = `${MENU_ID}-${useId() || ++menuSeq}`
  const open = ref(false)
  const trigger = ref<ComposerTrigger>(null)
  const dismissedKey = ref("")
  const files = ref<FileSearchEntry[]>([])
  const skills = ref<ComposerCommand[]>([])
  const prompts = ref<ComposerCommand[]>([])
  const loading = ref(false)
  const activeId = ref<string | null>(null)
  let fetchSeq = 0
  let skillsFor = ""
  let debounce: ReturnType<typeof setTimeout> | undefined
  let fetchController: AbortController | undefined
  const clearApplicable = computed(() => {
    const start = trigger.value?.start
    const { prompt, caret } = options

    if (start === undefined || trigger.value?.kind !== "command") return false
    return prompt.value.trim() === prompt.value.slice(start, caret.value).trim()
  })
  const groups = computed<CommandMenuGroup[]>(() =>
    buildCommandGroups({
      kind: trigger.value?.kind ?? "none",
      query: trigger.value?.kind === "command" ? trigger.value.query : "",
      clearApplicable: clearApplicable.value,
      hasSession: options.hasSession?.() ?? false,
      files: files.value,
      skills: skills.value,
      prompts: prompts.value,
      label: (key) => t(key),
    }),
  )
  const flatRows = computed<CommandMenuRow[]>(() => groups.value.flatMap((group) => group.rows))
  const emptyText = computed(() =>
    t(
      trigger.value?.kind === "mention"
        ? "composer.commandEmptyFile"
        : "composer.commandEmptyCommand",
    ),
  )
  const activeDescendantId = computed(() =>
    activeId.value ? commandRowId(activeId.value, menuId) : undefined,
  )

  watch([options.prompt, options.caret, () => options.cwd()], () => void refresh(), {
    flush: "post",
  })
  watch(flatRows, (rows) => (activeId.value = rows[0]?.id ?? null), { immediate: true })
  watch(
    () => options.reloadRevision?.(),
    () => {
      skillsFor = ""
    },
  )

  function cancelFetch() {
    if (debounce) clearTimeout(debounce)
    debounce = undefined
    fetchController?.abort()
    fetchController = undefined
  }

  function scheduleFetch(run: (signal: AbortSignal) => Promise<void>) {
    cancelFetch()
    const controller = (fetchController = new AbortController())

    debounce = setTimeout(() => {
      debounce = undefined
      void run(controller.signal)
    }, SEARCH_DELAY)
  }

  async function refresh() {
    const dir = options.cwd()

    if (options.inCode()) {
      close()
      files.value = []
      activeId.value = null
      loading.value = false
      return
    }

    const next = composerTriggerAt(options.prompt.value, options.caret.value)

    if (!next || !dir) {
      close()
      files.value = []
      activeId.value = null
      loading.value = false
      return
    }

    const key = triggerKey(next)

    if (dismissedKey.value && dismissedKey.value !== key) dismissedKey.value = ""

    if (dismissedKey.value === key || (!options.edited.value && !open.value)) {
      open.value = false
      return
    }

    const changed = key !== triggerKey(trigger.value)

    trigger.value = next

    if (!changed && open.value) return
    open.value = true
    await load(next.kind, next.query, dir)
  }

  async function load(kind: "mention" | "command", query: string, dir: string) {
    const seq = ++fetchSeq

    if (kind === "mention") {
      scheduleFetch(async (signal) => {
        loading.value = true
        const entries = await searchWorkspaceFiles(dir, query, signal).catch(() => [])

        if (seq !== fetchSeq) return
        files.value = entries
        loading.value = false
      })
      return
    }

    files.value = []

    if (skillsFor === dir) {
      loading.value = false
      return
    }

    loading.value = true
    const loaded = await listWorkspaceCommands(dir).catch(() => undefined)

    if (seq !== fetchSeq) return
    skills.value = loaded?.skills ?? []
    prompts.value = loaded?.prompts ?? []
    loading.value = false

    if (loaded?.skills.length || loaded?.prompts.length) skillsFor = dir
  }

  function onKeydown(event: KeyboardEvent): boolean {
    if (event.isComposing || !open.value) return false

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault()
      step(event.key === "ArrowDown" ? 1 : -1)
      return true
    }

    if (event.key !== "Enter" && event.key !== "Tab") return false
    const id = activeId.value ?? flatRows.value[0]?.id

    if (!id) return false
    event.preventDefault()
    select(id)
    return true
  }

  function step(offset: number) {
    const rows = flatRows.value
    const index = rows.findIndex((row) => row.id === activeId.value)

    activeId.value = rows[(index + offset + rows.length) % rows.length]?.id ?? null
  }

  function select(id: string) {
    const start = trigger.value?.start

    if (start === undefined) return

    if (id.startsWith(DIR_PREFIX)) {
      const prefix = id.slice(DIR_PREFIX.length)

      options.onReplaceText(start, options.caret.value - start, `@${prefix}`)
      return
    }

    if (id === `${BUILTIN_PREFIX}${CLEAR_COMMAND}`) {
      options.prompt.value = ""
      options.caret.value = 0
      close()
      return
    }

    const chip = chipForRow(id, start, options.caret.value - start)

    if (chip) options.onChip(chip)
    close()
  }

  function dismiss() {
    dismissedKey.value = triggerKey(trigger.value)
    close()
  }

  function close() {
    cancelFetch()
    open.value = false
    trigger.value = null
  }

  onScopeDispose(cancelFetch)
  return {
    open,
    menuId,
    groups,
    activeId,
    activeDescendantId,
    loading,
    emptyText,
    onKeydown,
    select,
    close,
    dismiss,
  }
}
