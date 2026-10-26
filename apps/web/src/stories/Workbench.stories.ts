import type { Decorator, Meta, StoryObj } from "@storybook/vue3-vite"
import { computed, watch } from "vue"

import type { SessionMetadata } from "@/types/common-type.js"
import AppLayout from "@components/layout/AppLayout.vue"
import SidebarView from "@features/session-nav/components/SidebarView.vue"
import { workspaceName } from "@features/session-nav/index.js"
import { groupSessionsByCwd, sidebarSections } from "@features/session-nav/lib/session-list.js"
import type {
  SidebarGrouping,
  SidebarRowFoot,
  SidebarSection,
  SidebarSort,
} from "@features/session-nav/type.js"
import SettingsDialog from "@features/settings/components/SettingsDialog.vue"
import { useColorScheme } from "@features/theme/index.js"
import TranscriptBody from "@features/transcript-view/components/TranscriptBody.vue"
import { withMemoryRouter } from "@/stories/decorators.js"
import {
  SIDEBAR_DATE_SECTIONS,
  SIDEBAR_NOW,
  SIDEBAR_PINNED_IDS,
  SIDEBAR_SESSION_STATES,
  SIDEBAR_SESSIONS,
  SIDEBAR_WORKSPACE_SECTIONS,
  SIDEBAR_WORKSPACES,
  TRANSCRIPT_SAMPLES,
} from "@/stories/fixtures/sessions.js"

type SampleKind = "short" | "long" | "streaming" | "error"

type Pane = "general" | "skills" | "extensions" | "usage"

type WorkbenchArgs = {
  /** 侧栏分组：「日期」桶或「工作目录」组。 */
  sidebarGrouping: SidebarGrouping
  /** 项目筛选；空串映射成 undefined。 */
  sidebarScope: string
  /** 打开搜索弹层。 */
  sidebarSearch: boolean
  /** 正文样本；streaming 顺带置 running。 */
  transcriptSample: SampleKind
  /** 顶部折出「加载更早」占位。 */
  transcriptLoadingOlder: boolean
  settingsOpen: boolean
  settingsPane: Pane
  dark: boolean
}

/** 资源页要的 cwd，取侧栏样本的主工作区。 */
const SETTINGS_CWD = SIDEBAR_SESSIONS[0]?.cwd
/** 行脚注只认 state；SessionCardExtra 是超集，就地裁成 SidebarRowFoot。 */
const CARD_FOOT_BY_ID: ReadonlyMap<string, SidebarRowFoot> = new Map(
  Object.entries(SIDEBAR_SESSION_STATES).map(([id, state]) => [id, { state }]),
)
const SCOPE_OPTIONS = ["", ...SIDEBAR_WORKSPACES.map(workspaceName)]
const SIDEBAR_BASE = {
  groups: groupSessionsByCwd(SIDEBAR_SESSIONS, SIDEBAR_WORKSPACES, "updated"),
  connected: true,
  sbExpanded: true,
  sort: "updated" as SidebarSort,
  cardFootById: CARD_FOOT_BY_ID,
  listedSessions: SIDEBAR_SESSIONS,
  pinnedIds: new Set(SIDEBAR_PINNED_IDS),
  highlightedSessionId: "sess-sidebar-sort",
  expandedByGroup: {},
}

/** 故事里默认全展开：收起的分区只显示计数，看不到行。 */
function expandedKeys(sections: readonly SidebarSection[]): ReadonlySet<string> {
  return new Set(sections.map((section) => section.key))
}

/** 与容器一致：命中的项目只留自己的会话，分区随之重算。 */
function sectionsOf(grouping: SidebarGrouping, scope: string): SidebarSection[] {
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

/** 壳高按 100vh 定，容器只锁宽；高度由 viewport 预设的 800 决定。 */
const withWorkbenchFrame: Decorator = (_story) => ({
  template: `<div style="width:1280px;height:100vh;overflow:hidden"><story /></div>`,
})
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
  argTypes: {
    sidebarGrouping: { control: "select", options: ["date", "cwd"] },
    sidebarScope: {
      control: "select",
      options: SCOPE_OPTIONS,
      labels: { "": "全部项目" },
    },
    sidebarSearch: { control: "boolean" },
    transcriptSample: { control: "select", options: ["short", "long", "streaming", "error"] },
    transcriptLoadingOlder: { control: "boolean" },
    settingsOpen: { control: "boolean" },
    settingsPane: { control: "select", options: ["general", "skills", "extensions", "usage"] },
    dark: { control: "boolean" },
  },
  args: {
    sidebarGrouping: "date",
    sidebarScope: "",
    sidebarSearch: false,
    transcriptSample: "long",
    transcriptLoadingOlder: false,
    settingsOpen: false,
    settingsPane: "general",
    dark: false,
  },
  render: (args) => ({
    components: { AppLayout, SettingsDialog, SidebarView, TranscriptBody },
    setup: () => {
      const { setScheme } = useColorScheme()

      watch(
        () => args.dark,
        (dark) => setScheme(dark ? "dark" : "light"),
        { immediate: true },
      )
      const sections = computed(() => sectionsOf(args.sidebarGrouping, args.sidebarScope))
      const sidebar = computed(() => ({
        ...SIDEBAR_BASE,
        grouping: args.sidebarGrouping,
        scopeFilter: args.sidebarScope || undefined,
        searchOpen: args.sidebarSearch,
        sections: sections.value,
        expandedSections: expandedKeys(sections.value),
      }))
      const sample = computed(() => TRANSCRIPT_SAMPLES[args.transcriptSample])
      const transcript = computed(() => ({
        sessionId: sample.value.sessionId,
        transcript: sample.value.transcript,
        timings: sample.value.timings,
        running: sample.value.running,
      }))
      return {
        args,
        cwd: SETTINGS_CWD,
        sidebar,
        transcript,
        phase: computed(() => (args.transcriptSample === "streaming" ? "turn" : "idle")),
        // 分页开关：hasMore 与 loadingOlder 同时置位，视口顶部才是加载占位。
        loadingOlder: computed(() => args.transcriptLoadingOlder),
      }
    },
    template: `
      <AppLayout>
        <template #sidebar="{ onNavigate }">
          <SidebarView v-bind="sidebar" @navigate="onNavigate()" />
        </template>

        <TranscriptBody
          v-bind="transcript"
          :phase="phase"
          :has-more="loadingOlder"
          :loading-older="loadingOlder"
        />
      </AppLayout>

      <SettingsDialog
        v-if="args.settingsOpen"
        :key="args.settingsPane"
        :open="true"
        :cwd="cwd"
        :initial-pane="args.settingsPane"
      />
    `,
  }),
} satisfies Meta<WorkbenchArgs>

export default meta

type Story = StoryObj<typeof meta>

/** 整页默认：日期分组侧栏 + 长会话正文，正文可滚动、卡片可点、工具卡可展开。 */
export const Page: Story = {}
/** 整页暗色：与 Page 同一份状态，只换配色。 */
export const PageDark: Story = { args: { dark: true } }
/** 设置打开：整页之上叠一层设置弹窗，默认落在技能页。 */
export const SettingsOpen: Story = { args: { settingsOpen: true, settingsPane: "skills" } }
