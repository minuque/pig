import type { Meta, StoryObj } from "@storybook/vue3-vite"

import type { SessionMetadata } from "@/types/common-type.js"
import SidebarView from "@features/session-nav/components/SidebarView.vue"
import { workspaceName } from "@features/session-nav/index.js"
import { groupSessionsByCwd, sidebarSections } from "@features/session-nav/lib/session-list.js"
import type {
  SidebarGrouping,
  SidebarRowFoot,
  SidebarSection,
  SidebarSort,
} from "@features/session-nav/type.js"
import { withDarkTheme, withMemoryRouter, withSidebarFrame } from "@/stories/decorators.js"
import {
  SIDEBAR_DATE_SECTIONS,
  SIDEBAR_NOW,
  SIDEBAR_PINNED_IDS,
  SIDEBAR_SESSIONS,
  SIDEBAR_SESSION_STATES,
  SIDEBAR_WORKSPACE_SECTIONS,
  SIDEBAR_WORKSPACES,
} from "@/stories/fixtures/sessions.js"

/** 行脚注只认 state；SessionCardExtra 是超集，就地裁成 SidebarRowFoot。 */
const ROW_FOOT_BY_ID: ReadonlyMap<string, SidebarRowFoot> = new Map(
  Object.entries(SIDEBAR_SESSION_STATES).map(([id, state]) => [id, { state }]),
)
const PINNED_IDS: ReadonlySet<string> = new Set(SIDEBAR_PINNED_IDS)
const GROUPS = groupSessionsByCwd(SIDEBAR_SESSIONS, SIDEBAR_WORKSPACES, "updated")

/** 故事里默认全展开：收起的分区只显示计数，看不到行。 */
function expandedKeys(sections: readonly SidebarSection[]): ReadonlySet<string> {
  return new Set(sections.map((section) => section.key))
}

/** 按分组重算分区，给筛选态用；常规样本直接用 fixtures 常量。 */
function sectionsOf(
  sessions: readonly SessionMetadata[],
  grouping: SidebarGrouping,
): SidebarSection[] {
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

/** 筛选态样本：项目筛选只留命中目录的会话，与容器里 sectionsFor(include) 一致。 */
const SCOPED_WORKSPACE = workspaceName(
  SIDEBAR_SESSIONS.find((session) => session.id === "sess-docs-storybook")?.cwd ?? "",
)
const SCOPED_SESSIONS = SIDEBAR_SESSIONS.filter(
  (session) => workspaceName(session.cwd ?? "") === SCOPED_WORKSPACE,
)
const SCOPED_SECTIONS = sectionsOf(SCOPED_SESSIONS, "date")
const BASE_ARGS = {
  groups: GROUPS,
  connected: true,
  sbExpanded: true,
  grouping: "date" as SidebarGrouping,
  sort: "updated" as SidebarSort,
  scopeFilter: undefined,
  searchOpen: false,
  sections: SIDEBAR_DATE_SECTIONS,
  cardFootById: ROW_FOOT_BY_ID,
  listedSessions: SIDEBAR_SESSIONS,
  pinnedIds: PINNED_IDS,
  highlightedSessionId: "sess-sidebar-sort",
  expandedSections: expandedKeys(SIDEBAR_DATE_SECTIONS),
  expandedByGroup: {},
}
const meta = {
  title: "Features/SessionNav/SidebarView",
  component: SidebarView,
  tags: ["autodocs"],
  decorators: [withSidebarFrame, withMemoryRouter],
  parameters: { layout: "centered" },
  argTypes: {
    groups: { control: false },
    sections: { control: false },
    cardFootById: { control: false },
    listedSessions: { control: false },
    pinnedIds: { control: false },
    expandedSections: { control: false },
    expandedByGroup: { control: false },
    scopeFilter: { control: "text" },
    highlightedSessionId: { control: "text" },
    grouping: { control: "inline-radio", options: ["date", "cwd"] },
    sort: { control: "inline-radio", options: ["updated", "created"] },
    connected: { control: "boolean" },
    sbExpanded: { control: "boolean" },
    searchOpen: { control: "boolean" },
  },
  args: BASE_ARGS,
  render: (args) => ({
    components: { SidebarView },
    setup: () => ({ args }),
    // 定高容器：侧栏靠列内滚动，没有高度就撑成一长条
    template:
      '<div style="display:flex;height:640px;width:100%"><SidebarView v-bind="args" /></div>',
  }),
} satisfies Meta<typeof SidebarView>

export default meta

type Story = StoryObj<typeof meta>

/** 日期分组：置顶段在前，其余按今天 / 昨天 / 近七天 / 更早分桶。 */
export const List: Story = {}
/** 空列表：没有会话也没有工作目录，只剩新建入口与空态文案。 */
export const Empty: Story = {
  args: {
    ...BASE_ARGS,
    connected: false,
    groups: [],
    sections: [],
    listedSessions: [],
    cardFootById: new Map(),
    pinnedIds: new Set(),
    highlightedSessionId: undefined,
    expandedSections: new Set(),
  },
}
/** 搜索弹层打开：结果行取 listedSessions，按当前排序。 */
export const SearchOpen: Story = {
  args: { ...BASE_ARGS, searchOpen: true },
}
/** 按目录分组：分区键换成 cwd，组头带项目图标与「在该项目新建」。 */
export const GroupedByCwd: Story = {
  args: {
    ...BASE_ARGS,
    grouping: "cwd",
    sections: SIDEBAR_WORKSPACE_SECTIONS,
    expandedSections: expandedKeys(SIDEBAR_WORKSPACE_SECTIONS),
  },
}
/** 项目筛选命中：分区只剩命中目录的会话，筛选按钮显示激活点。 */
export const ScopedToProject: Story = {
  args: {
    ...BASE_ARGS,
    scopeFilter: SCOPED_WORKSPACE,
    sections: SCOPED_SECTIONS,
    listedSessions: SCOPED_SESSIONS,
    expandedSections: expandedKeys(SCOPED_SECTIONS),
  },
}
/** 正常列表暗色：与 List 同一样本，只换配色。 */
export const ListDark: Story = {
  decorators: [withDarkTheme],
}
