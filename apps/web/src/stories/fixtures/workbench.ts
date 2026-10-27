import { ref } from "vue"

import type { SessionMetadata, TranscriptItem } from "@/types/common-type.js"
import type { TurnTiming } from "@/types/turn-type.js"
import { workspaceName } from "@features/session-nav/index.js"
import {
  draftSessionId,
  groupSessionsByCwd,
  listSessionsForSidebar,
  sidebarSections,
} from "@features/session-nav/lib/session-list.js"
import type {
  SessionGroup,
  SidebarGrouping,
  SidebarRowFoot,
  SidebarSection,
  SidebarSort,
} from "@features/session-nav/type.js"
import {
  SIDEBAR_NOW,
  SIDEBAR_SESSION_STATES,
  SIDEBAR_SESSIONS,
  SIDEBAR_WORKSPACES,
  TRANSCRIPT_EPOCH,
  createTranscript,
  transcriptTimings,
  type TranscriptSample,
} from "@/stories/fixtures/sessions.js"

/** 整页故事的 controls：故事文件与 SFC 共用一份，避免两边漂移。 */
export type WorkbenchControls = {
  /** 侧栏分组：「日期」桶或「工作目录」组。 */
  sidebarGrouping: SidebarGrouping
  /** 项目筛选；空串映射成 undefined。 */
  sidebarScope: string
  /** 打开搜索弹层。 */
  sidebarSearch: boolean
  /** 正文样本；streaming 顺带置 running。 */
  transcriptSample: "short" | "long" | "streaming" | "error"
  /** 顶部折出「加载更早」加载态。 */
  transcriptLoadingOlder: boolean
  /** 空会话：正文区换成 Hero，输入条抬到 dock 位。 */
  sessionState: "session" | "idle"
  /** 拖拽态：显示「松手添加文件」引导层。 */
  dropActive: boolean
  /** 对话列两侧的宽度手柄。 */
  showContentHandles: boolean
  /** 强制显示「回到底部」浮钮便于打磨；关闭时用 TranscriptView 的真实信号。 */
  scrollToLatestVisible: boolean
  /** 启动错误：正文区换成错误条。 */
  pageError: boolean
  /** 顶部告警条。 */
  toast: boolean
  /** 预填输入框文本。 */
  composerText: string
  /** 运行态：有文本时主钮变入队，空白时变停止。 */
  composerRunning: boolean
  /** 显示上下文用量环与面板。 */
  composerUsage: boolean
  /** 队列里预置两条待发。 */
  composerQueue: boolean
  settingsOpen: boolean
  settingsPane: "general" | "skills" | "extensions" | "usage"
  dark: boolean
}

/** 行脚注只认 state；SessionCardExtra 是超集，就地裁成 SidebarRowFoot。 */
export const SIDEBAR_CARD_FEET = new Map(
  Object.entries(SIDEBAR_SESSION_STATES).map(([id, state]) => [id, { state }]),
) as ReadonlyMap<string, SidebarRowFoot>
/** 首帧高亮的会话：顶部标题与置顶态都从它派生。 */
export const HIGHLIGHTED_SESSION_ID = "sess-sidebar-sort"
/** 项目筛选项：空串代表全部。控制面板只列初始目录。 */
export const SCOPE_OPTIONS = ["", ...SIDEBAR_WORKSPACES.map(workspaceName)]
/** 资源页要的 cwd，取侧栏样本的主工作区。 */
export const SETTINGS_CWD = SIDEBAR_SESSIONS[0]?.cwd
/** 启动错误条示例详情。 */
export const STARTUP_DETAIL = "连接 Gateway 失败：ECONNREFUSED 127.0.0.1:7788"
/** 告警条示例文案。 */
export const TOAST_MESSAGE = "Gateway 连接中断，正在重连。"

/** 新增目录的提示文案：故事只把目录追加到本地名单。 */
export function addedWorkspaceMessage(path: string): string {
  return `已添加工作目录 ${workspaceName(path)}`
}

/** 侧栏目录分组：本地目录名单在前，空目录也留着给项目筛选。 */
export function workbenchGroups(
  sessions: readonly SessionMetadata[],
  localWorkspaces: readonly string[],
  sort: SidebarSort,
): SessionGroup[] {
  return groupSessionsByCwd(sessions, localWorkspaces, sort)
}

/** 搜索弹层的会话池：与侧栏同源，但不按项目筛选。 */
export function workbenchListed(
  sessions: readonly SessionMetadata[],
  sort: SidebarSort,
): SessionMetadata[] {
  return listSessionsForSidebar(sessions, sort)
}

/** 与容器一致：先按项目筛掉会话，再按分组、排序与翻页算分区。 */
export function workbenchSections(input: {
  sessions: readonly SessionMetadata[]
  pinnedOrder: readonly string[]
  grouping: SidebarGrouping
  sort: SidebarSort
  scope: string | undefined
  localWorkspaces: readonly string[]
  expandedByGroup: Record<string, number>
}): SidebarSection[] {
  const { scope, ...rest } = input
  const sessions = scope
    ? input.sessions.filter((session) => workspaceName(session.cwd ?? "") === scope)
    : input.sessions
  return sidebarSections({ ...rest, sessions, now: SIDEBAR_NOW })
}

/** 本地新会话：id 用真实草稿前缀，侧栏画占位行、标题回落「新会话」。 */
export function draftSession(path: string): SessionMetadata {
  const at = Date.now()
  return { id: draftSessionId(path), cwd: path, createdAt: at, updatedAt: at }
}

/** 新增目录兜底路径：故事不发系统选目录请求，用本地路径充数。 */
export function nextWorkspacePath(index: number): string {
  return `G:\\AICode\\story-workspace-${index}`
}

/** 列宽夹紧与真实 hook 一致：最小 640，上限为列宽减两侧留白。 */
const CONTENT_WIDTH_DEFAULT = 680
const CONTENT_WIDTH_MIN = 640
const CONTENT_EDGE_BUDGET = 176

/** column 传列宽，拖拽预览与键盘微调都走这里。 */
function clampContentWidth(width: number, column: number): number {
  const max = Math.max(CONTENT_WIDTH_MIN, column - CONTENT_EDGE_BUDGET)
  return Math.min(Math.max(width, CONTENT_WIDTH_MIN), max)
}

/** 列宽本地状态：拖动中预览、松手落定、键盘 ±16，夹紧规则与真实 hook 一致。 */
export function createContentWidth(column: () => number) {
  const width = ref(CONTENT_WIDTH_DEFAULT)
  const resizing = ref(false)
  const clamp = (value: number) => clampContentWidth(value, column())
  return {
    width,
    resizing,
    /** 把手拿当前内容宽做拖拽基准。 */
    measure: () => width.value,
    preview: (value: number) => (width.value = clamp(value)),
    commit: (value: number) => (width.value = clamp(value)),
    nudge: (delta: number) => (width.value = clamp(width.value + delta)),
    start: () => (resizing.value = true),
    end: () => (resizing.value = false),
  }
}

/** 更早的一页：正文与轮次时间一起拼，滚动锚点才不跳。 */
export type EarlierPage = { items: TranscriptItem[]; timings: TurnTiming[] }

/** 还能往回翻几页历史，翻完「加载更早」消失。 */
export const MAX_EARLIER_PAGES = 2
const EARLIER_TURNS = 3
const EARLIER_WINDOW = 40 * 60 * 1000

/** 更早一页正文：时间戳逐页往前提，拼到顶部时间线不倒流。 */
export function earlierPage(index: number): EarlierPage {
  const items = createTranscript({
    turns: EARLIER_TURNS,
    start: TRANSCRIPT_EPOCH - (index + 1) * EARLIER_WINDOW,
    withTools: true,
  })
  return { items, timings: transcriptTimings(items) }
}

/** 更早分页拼到样本前面，本地追加的消息接在末尾，轮次时间一起拼。 */
export function mergeTranscript(
  sample: TranscriptSample,
  earlier: readonly EarlierPage[],
  appended: readonly TranscriptItem[] = [],
) {
  const { sessionId, transcript: items, timings = [], running } = sample
  // 样本时间基准固定，运行中那一轮对齐到当下，否则计时器算出天文数字
  const start = Date.now() - 12_000
  const live = timings.map((item, index, all) =>
    running && index === all.length - 1 ? { ...item, startedAt: start } : item,
  )
  return {
    sessionId,
    transcript: [...earlier.flatMap((page) => page.items), ...items, ...appended],
    timings: [...earlier.flatMap((page) => page.timings), ...live, ...transcriptTimings(appended)],
    running,
  }
}
