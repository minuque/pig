import type { Decorator, Meta, StoryObj } from "@storybook/vue3-vite"

import AppLayout from "@components/layout/AppLayout.vue"
import SidebarView from "@features/session-nav/components/SidebarView.vue"
import { groupSessionsByCwd } from "@features/session-nav/lib/session-list.js"
import type { SidebarGrouping, SidebarRowFoot, SidebarSort } from "@features/session-nav/type.js"
import SettingsDialog from "@features/settings/components/SettingsDialog.vue"
import TranscriptBody from "@features/transcript-view/components/TranscriptBody.vue"
import { withMemoryRouter } from "@/stories/decorators.js"
import {
  SIDEBAR_DATE_SECTIONS,
  SIDEBAR_PINNED_IDS,
  SIDEBAR_SESSION_STATES,
  SIDEBAR_SESSIONS,
  SIDEBAR_WORKSPACES,
  TRANSCRIPT_SAMPLES,
} from "@/stories/fixtures/sessions.js"

/** 资源页要的 cwd，取侧栏样本的主工作区。 */
const SETTINGS_CWD = SIDEBAR_SESSIONS[0]?.cwd
/** 行脚注只认 state；SessionCardExtra 是超集，就地裁成 SidebarRowFoot。 */
const CARD_FOOT_BY_ID: ReadonlyMap<string, SidebarRowFoot> = new Map(
  Object.entries(SIDEBAR_SESSION_STATES).map(([id, state]) => [id, { state }]),
)
const SIDEBAR_PROPS = {
  groups: groupSessionsByCwd(SIDEBAR_SESSIONS, SIDEBAR_WORKSPACES, "updated"),
  connected: true,
  sbExpanded: true,
  grouping: "date" as SidebarGrouping,
  sort: "updated" as SidebarSort,
  scopeFilter: undefined,
  searchOpen: false,
  sections: SIDEBAR_DATE_SECTIONS,
  cardFootById: CARD_FOOT_BY_ID,
  listedSessions: SIDEBAR_SESSIONS,
  pinnedIds: new Set(SIDEBAR_PINNED_IDS),
  highlightedSessionId: "sess-sidebar-sort",
  expandedSections: new Set(SIDEBAR_DATE_SECTIONS.map((section) => section.key)),
  expandedByGroup: {},
}
const TRANSCRIPT_PROPS = {
  sessionId: TRANSCRIPT_SAMPLES.long.sessionId,
  transcript: TRANSCRIPT_SAMPLES.long.transcript,
  timings: TRANSCRIPT_SAMPLES.long.timings,
  running: TRANSCRIPT_SAMPLES.long.running,
}
/** 壳高按 100vh 定，容器只锁宽；高度由 viewport 预设的 800 决定。 */
const withWorkbenchFrame: Decorator = (_story) => ({
  template: `<div style="width:1280px;height:100vh;overflow:hidden"><story /></div>`,
})

type WorkbenchArgs = { settingsOpen: boolean }

const meta = {
  title: "Features/Shell/Workbench",
  tags: ["autodocs"],
  decorators: [withWorkbenchFrame, withMemoryRouter],
  parameters: {
    layout: "fullscreen",
    viewport: {
      defaultViewport: "workbench",
      viewports: {
        workbench: { name: "整页 1280×800", styles: { width: "1280px", height: "800px" } },
      },
    },
  },
  argTypes: { settingsOpen: { control: "boolean" } },
  args: { settingsOpen: false },
  render: (args) => ({
    components: { AppLayout, SettingsDialog, SidebarView, TranscriptBody },
    setup: () => ({
      args,
      cwd: SETTINGS_CWD,
      sidebar: SIDEBAR_PROPS,
      transcript: TRANSCRIPT_PROPS,
    }),
    template: `
      <AppLayout>
        <template #sidebar="{ onNavigate }">
          <SidebarView v-bind="sidebar" @navigate="onNavigate()" />
        </template>

        <TranscriptBody v-bind="transcript" phase="idle" />
      </AppLayout>

      <SettingsDialog v-if="args.settingsOpen" :open="true" :cwd="cwd" />
    `,
  }),
} satisfies Meta<WorkbenchArgs>

export default meta

type Story = StoryObj<typeof meta>

/** 整页默认：日期分组侧栏 + 长会话正文，正文可滚动、卡片可点、工具卡可展开。 */
export const Page: Story = {}
/** 设置打开：整页之上叠一层设置弹窗，资源页的 cwd 取侧栏主工作区。 */
export const SettingsOpen: Story = {
  args: { settingsOpen: true },
}
