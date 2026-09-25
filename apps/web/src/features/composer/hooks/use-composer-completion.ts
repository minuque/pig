import { computed, ref, type Ref } from "vue"
import { searchFiles, type SearchFileHit } from "@client/platform.js"

export type CompletionKind = "mention" | "slash"

export interface CompletionItem {
  id: string
  label: string
  detail: string
  icon: "file" | "file-code" | "image" | "command"
  /** 接受时的替换文本；mention 由调用方拼 Markdown 链接。 */
  insert: string
}

export interface SlashCommand {
  id: string
  name: string
  description: string
}

/** 内置命令只消费 token，不发消息。 */
export const BUILTIN_SLASH_COMMANDS: SlashCommand[] = [
  { id: "model", name: "model", description: "打开模型选择器" },
  { id: "new", name: "new", description: "回到欢迎页新建会话" },
]

interface TokenMatch {
  kind: CompletionKind
  start: number
  end: number
  query: string
}

const MENTION_PREFIX = /[\s([{>]/
const SLASH_TOKEN = /^[A-Za-z0-9\-_:.]*$/

/** 围栏代码块内不触发补全。 */
function insideFence(text: string, caret: number): boolean {
  let count = 0
  let at = text.indexOf("```")

  while (at !== -1 && at < caret) {
    count += 1
    at = text.indexOf("```", at + 3)
  }

  return count % 2 === 1
}

/** Markdown 链接目标（]( 之后、) 之前）不触发补全。 */
function insideLinkTarget(text: string, caret: number): boolean {
  const open = text.lastIndexOf("](", caret)

  if (open === -1) return false
  const close = text.indexOf(")", open + 2)
  return close === -1 || close >= caret
}

/** 取光标前最后一个 @ 触发词；不满足边界规则返回 undefined。 */
export function mentionTokenAt(text: string, caret: number): Omit<TokenMatch, "kind"> | undefined {
  const head = text.slice(0, caret)
  const at = head.lastIndexOf("@")

  if (at === -1) return undefined

  const prev = at === 0 ? "" : head[at - 1]

  if (prev && !MENTION_PREFIX.test(prev)) return undefined

  const query = head.slice(at + 1)

  if (/[\s@`]/.test(query)) return undefined

  if (insideFence(text, at) || insideLinkTarget(text, at)) return undefined
  return { start: at, end: caret, query }
}

/** 取光标前最后一个 / 命令触发词。 */
export function slashTokenAt(text: string, caret: number): Omit<TokenMatch, "kind"> | undefined {
  const head = text.slice(0, caret)
  const slash = head.lastIndexOf("/")

  if (slash === -1) return undefined

  const prev = slash === 0 ? "" : head[slash - 1]

  if (prev && !/\s/.test(prev)) return undefined

  const query = head.slice(slash + 1)

  if (!SLASH_TOKEN.test(query)) return undefined

  // 路径 / 货币 / 代码写法：触发词后紧跟 / 不当命令
  if (text[caret] === "/") return undefined
  return { start: slash, end: caret, query }
}

const SEARCH_DEBOUNCE_MS = 80
const SEARCH_RETRY_MS = 250

function fileIcon(path: string): CompletionItem["icon"] {
  if (/\.(png|jpe?g|gif|webp|svg)$/i.test(path)) return "image"

  if (/\.(ts|tsx|js|jsx|mjs|cjs|vue|py|rs|go|java|rb|swift|kt|css|scss|html)$/i.test(path))
    return "file-code"
  return "file"
}

export interface CompletionState {
  kind: CompletionKind | undefined
  start: number
  end: number
  query: string
  items: CompletionItem[]
  index: number
  loading: boolean
  /** 列表为空时的原因文案，弹层空态展示。 */
  emptyText: string
}

const IDLE: CompletionState = {
  kind: undefined,
  start: 0,
  end: 0,
  query: "",
  items: [],
  index: 0,
  loading: false,
  emptyText: "",
}

/**
 * @ / 补全状态机：token 提取、mention 防抖搜索（generation 防陈旧 + 失败重试一次）、
 * 键盘导航。update 由输入卡 caret / 输入事件驱动；handleKeydown 返回 true 表示已消费。
 */
export function useComposerCompletion(options: {
  prompt: Ref<string>
  cwd: Ref<string | undefined>
  onPick: (item: CompletionItem, range: { start: number; end: number }) => void
}) {
  const state = ref<CompletionState>({ ...IDLE })
  const active = computed(() => state.value.kind !== undefined)
  let searchTimer: ReturnType<typeof setTimeout> | undefined
  let generation = 0
  /** Escape 关掉的触发词，同一 token 不再重开。 */
  let dismissed = ""

  function close() {
    generation += 1

    if (searchTimer) clearTimeout(searchTimer)
    state.value = { ...IDLE }
  }

  function detect(caret: number): TokenMatch | undefined {
    const text = options.prompt.value
    const slash = slashTokenAt(text, caret)
    // @ 与 / 同行冲突时取离光标近的那个
    const mention = mentionTokenAt(text, caret)

    if (slash && (!mention || slash.start > mention.start)) return { ...slash, kind: "slash" }

    if (mention) return { ...mention, kind: "mention" }
    return undefined
  }

  function loadMention(token: TokenMatch, myGeneration: number, allowRetry: boolean) {
    const cwd = options.cwd.value

    if (!cwd) {
      if (state.value.kind === "mention" && myGeneration === generation)
        state.value = { ...state.value, loading: false, items: [], emptyText: "没有可用的工作目录" }
      return
    }

    searchFiles(cwd, token.query)
      .then((files) => {
        if (myGeneration !== generation || state.value.kind !== "mention") return
        state.value = {
          ...state.value,
          loading: false,
          items: files.map((hit: SearchFileHit) => ({
            id: hit.path,
            label: hit.name,
            detail: hit.path.slice(0, Math.max(0, hit.path.length - hit.name.length - 1)),
            icon: fileIcon(hit.path),
            insert: `[${hit.name}](${hit.path})`,
          })),
          emptyText: token.query ? "没有匹配的文件" : "输入以搜索文件",
        }
      })
      .catch(() => {
        if (myGeneration !== generation) return

        if (allowRetry) {
          setTimeout(() => loadMention(token, myGeneration, false), SEARCH_RETRY_MS)
          return
        }

        if (state.value.kind === "mention")
          state.value = { ...state.value, loading: false, items: [], emptyText: "搜索失败" }
      })
  }

  function update(caret: number) {
    const token = detect(caret)

    if (!token) {
      dismissed = ""
      close()
      return
    }

    const tokenText = options.prompt.value.slice(token.start, token.end)

    if (dismissed === tokenText) return

    if (tokenText === state.value.query && token.kind === state.value.kind) {
      // 光标移动但触发词没变：只更新替换区间
      state.value = { ...state.value, start: token.start, end: token.end }
      return
    }

    generation += 1

    if (searchTimer) clearTimeout(searchTimer)

    if (token.kind === "slash") {
      const query = token.query.toLowerCase()
      const items = BUILTIN_SLASH_COMMANDS.filter(
        (cmd) => !query || cmd.name.startsWith(query),
      ).map((cmd) => ({
        id: cmd.id,
        label: `/${cmd.name}`,
        detail: cmd.description,
        icon: "command" as const,
        insert: "",
      }))

      state.value = {
        kind: "slash",
        start: token.start,
        end: token.end,
        query: token.query,
        items,
        index: 0,
        loading: false,
        emptyText: query ? "没有匹配的命令" : "没有可用命令",
      }
      return
    }

    const myGeneration = generation

    state.value = {
      kind: "mention",
      start: token.start,
      end: token.end,
      query: token.query,
      items: [],
      index: 0,
      loading: true,
      emptyText: "",
    }
    searchTimer = setTimeout(() => loadMention(token, myGeneration, true), SEARCH_DEBOUNCE_MS)
  }

  /** 返回 true 表示事件已消费，输入卡跳过内置 Enter/Escape 逻辑。 */
  function handleKeydown(e: KeyboardEvent): boolean {
    if (!active.value) return false
    const current = state.value

    switch (e.key) {
      case "ArrowDown":
        if (current.items.length) current.index = (current.index + 1) % current.items.length
        return true
      case "ArrowUp":
        if (current.items.length)
          current.index = (current.index - 1 + current.items.length) % current.items.length
        return true
      case "Enter":
      case "Tab":
        accept(current.index)
        return true
      case "Escape":
        dismissed = options.prompt.value.slice(current.start, current.end)
        close()
        return true
      default:
        return false
    }
  }

  function accept(index: number) {
    const current = state.value
    const item = current.items[index]

    if (!item) return
    close()
    options.onPick(item, { start: current.start, end: current.end })
  }

  return { state, active, update, handleKeydown, accept, close }
}
