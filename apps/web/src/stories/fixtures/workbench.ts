import type { SessionMetadata } from "@/types/common-type.js"
import { workspaceName } from "@features/session-nav/index.js"
import { groupSessionsByCwd, sidebarSections } from "@features/session-nav/lib/session-list.js"
import type {
  SidebarGrouping,
  SidebarRowFoot,
  SidebarSection,
  SidebarSort,
} from "@features/session-nav/type.js"
import {
  SIDEBAR_DATE_SECTIONS,
  SIDEBAR_NOW,
  SIDEBAR_PINNED_IDS,
  SIDEBAR_SESSION_STATES,
  SIDEBAR_SESSIONS,
  SIDEBAR_WORKSPACE_SECTIONS,
  SIDEBAR_WORKSPACES,
} from "@/stories/fixtures/sessions.js"

/** 侧栏 props 的固定部分：整页故事每一帧都一样，只有分组与筛选会变。 */
export const SIDEBAR_BASE = {
  groups: groupSessionsByCwd(SIDEBAR_SESSIONS, SIDEBAR_WORKSPACES, "updated"),
  connected: true,
  sbExpanded: true,
  sort: "updated" as SidebarSort,
  /** 行脚注只认 state；SessionCardExtra 是超集，就地裁成 SidebarRowFoot。 */
  cardFootById: new Map(
    Object.entries(SIDEBAR_SESSION_STATES).map(([id, state]) => [id, { state }]),
  ) as ReadonlyMap<string, SidebarRowFoot>,
  listedSessions: SIDEBAR_SESSIONS,
  pinnedIds: new Set(SIDEBAR_PINNED_IDS),
  highlightedSessionId: "sess-sidebar-sort",
  expandedByGroup: {},
}
/** 项目筛选项：空串代表全部。 */
export const SCOPE_OPTIONS = ["", ...SIDEBAR_WORKSPACES.map(workspaceName)]
/** 资源页要的 cwd，取侧栏样本的主工作区。 */
export const SETTINGS_CWD = SIDEBAR_SESSIONS[0]?.cwd
/** 顶部标题取侧栏高亮那条会话，与真实 header 同源。 */
export const ACTIVE_SESSION = SIDEBAR_SESSIONS.find(
  (row) => row.id === SIDEBAR_BASE.highlightedSessionId,
)
export const ACTIVE_PINNED = Boolean(
  ACTIVE_SESSION && SIDEBAR_PINNED_IDS.includes(ACTIVE_SESSION.id),
)
export const ACTIVE_CWD_LABEL = workspaceName(ACTIVE_SESSION?.cwd ?? "")
/** 启动错误条示例详情。 */
export const STARTUP_DETAIL = "连接 Gateway 失败：ECONNREFUSED 127.0.0.1:7788"
/** 告警条示例文案。 */
export const TOAST_MESSAGE = "Gateway 连接中断，正在重连。"

/** 故事里默认全展开：收起的分区只显示计数，看不到行。 */
export function expandedKeys(sections: readonly SidebarSection[]): ReadonlySet<string> {
  return new Set(sections.map((section) => section.key))
}

/** 与容器一致：命中的项目只留自己的会话，分区随之重算。 */
export function sectionsOf(grouping: SidebarGrouping, scope: string): SidebarSection[] {
  if (!scope) return grouping === "date" ? SIDEBAR_DATE_SECTIONS : SIDEBAR_WORKSPACE_SECTIONS

  const sessions: SessionMetadata[] = SIDEBAR_SESSIONS.filter(
    (session) => workspaceName(session.cwd ?? "") === scope,
  )
  return sidebarSections({
    sessions,
    pinnedOrder: SIDEBAR_PINNED_IDS,
    grouping,
    sort: "updated",
    localWorkspaces: SIDEBAR_WORKSPACES,
    expandedByGroup: {},
    now: SIDEBAR_NOW,
  })
}
