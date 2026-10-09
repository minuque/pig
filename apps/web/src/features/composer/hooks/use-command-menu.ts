import { computed, nextTick, onScopeDispose, ref, watch, type Ref } from "vue"
import {
  listWorkspaceCommands,
  searchWorkspaceFiles,
  type ComposerCommand,
  type FileSearchEntry,
} from "@client/platform.js"
import type {
  CommandMenuGroup,
  CommandMenuRow,
} from "@features/composer/components/CommandMenu.vue"
import {
  applyTriggerChoice,
  composerTriggerAt,
  type ComposerTrigger,
} from "@features/composer/lib/composer-trigger.js"

/** 目录候选行的 id 前缀；选中目录不插文本，改为把查询推进到该前缀继续搜。 */
const DIR_PREFIX = "dir:"
const FILE_PREFIX = "file:"
/** 技能插入 /skill:name（Pi 的显式调用形式）；模板插入 /name。 */
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
  /** PromptEditor keydown 先交给菜单：返回 true 表示已消费。 */
  onKeydown(event: KeyboardEvent): boolean
  /** 行点击提交；与 Enter/Tab 同一条路。 */
  select(id: string): void
  /** 面板开着时吃掉 keydown 的关闭路径（Esc）。 */
  close(): void
}

export function useCommandMenu(
  prompt: Ref<string>,
  caret: Ref<number>,
  cwd: () => string | undefined,
): CommandMenuApi {
  const open = ref(false)
  const trigger = ref<ComposerTrigger>(null)
  const files = ref<FileSearchEntry[]>([])
  const skills = ref<ComposerCommand[]>([])
  const prompts = ref<ComposerCommand[]>([])
  const loading = ref(false)
  const activeId = ref<string | null>(null)
  /** 每次查询递增，丢弃过期响应。 */
  let fetchSeq = 0
  let skillsFor = ""
  const fileRows = computed<CommandMenuRow[]>(() =>
    files.value.map((entry) => ({
      id: `${entry.kind === "directory" ? DIR_PREFIX : FILE_PREFIX}${entry.path}`,
      title: entry.path.split("/").filter(Boolean).pop() ?? entry.path,
      secondary: entry.kind === "directory" ? undefined : parentPath(entry.path),
      directory: entry.kind === "directory",
      trailing: entry.kind === "directory" ? "目录" : undefined,
    })),
  )
  /** /clear 的适用条件：整份草稿只有光标处的这个 token。 */
  const clearApplicable = computed(() => {
    const start = trigger.value?.start

    if (start === undefined || trigger.value?.kind !== "command") return false
    return prompt.value.trim() === prompt.value.slice(start, caret.value).trim()
  })
  const commandRows = computed<CommandMenuRow[]>(() => {
    const query = trigger.value?.kind === "command" ? trigger.value.query.toLowerCase() : ""
    // 同名时模板优先于内置命令：模板是 Pi 的实际展开目标，内置项让位避免截胡
    const templateNames = new Set(prompts.value.map((prompt) => prompt.name))
    const commands: Array<{
      key: string
      name: string
      description: string
      /** 模板用法提示，优先于 description。 */
      hint?: string | undefined
    }> = [
      // /clear 只在草稿只剩这个 token 时执行，其他情形不显示，避免选中后无反馈
      ...BUILTIN_COMMANDS.filter(
        (command) => clearApplicable.value && !templateNames.has(command.name),
      ).map((command) => ({ ...command, key: `${BUILTIN_PREFIX}${command.name}` })),
      ...skills.value.map((skill) => ({
        key: `${SKILL_PREFIX}${skill.name}`,
        name: `skill:${skill.name}`,
        description: skill.description,
      })),
      ...prompts.value.map((prompt) => ({
        key: `${TEMPLATE_PREFIX}${prompt.name}`,
        name: prompt.name,
        description: prompt.description,
        hint: prompt.argumentHint,
      })),
    ]
    return commands
      .filter((command) => !query || command.name.toLowerCase().includes(query))
      .map((command) => ({
        id: command.key,
        title: `/${command.name}`,
        secondary: command.hint ?? command.description,
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

      // 模板排技能前：模板名与技能名同名时，Enter 先选中标题与输入完全一致的那个
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

  /** 文件搜索防抖：高频键入只发末次请求；旧请求 Abort。 */
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

    // 无触发或没有工作目录：收敛面板
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

        // 空列表可能是 slot 被淘汰的瞬时结果，不写缓存，下次打开重拉
        if (loaded.skills.length || loaded.prompts.length) skillsFor = dir
      }
    } catch {
      // 失败不写 skillsFor：下一次打开再拉
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
    // 输入法组字期间的按键不属于菜单；isComposing 返回 false 让编辑器按原语义处理
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

      // 目录下钻：触发 token 的查询换成该前缀，watch 会再拉起一次搜索
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

    // 模板插 /name；技能插 /skill:name（Pi 的显式调用形式）
    const value = id.startsWith(SKILL_PREFIX)
      ? `skill:${id.slice(SKILL_PREFIX.length)}`
      : id.startsWith(TEMPLATE_PREFIX)
        ? id.slice(TEMPLATE_PREFIX.length)
        : id.slice(FILE_PREFIX.length)
    const next = applyTriggerChoice(prompt.value, caret.value, { kind, start, query: "" }, value)

    prompt.value = next.text
    close()
    void nextTick(() => {
      caret.value = next.caret
    })
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
