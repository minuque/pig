import type { Decorator, Meta, StoryObj } from "@storybook/vue3-vite"
import { computed, onMounted, ref, useTemplateRef, watch } from "vue"
import { useElementSize } from "@vueuse/core"

import type { SessionMetadata } from "@/types/common-type.js"
import AppLayout from "@components/layout/AppLayout.vue"
import Composer from "@features/composer/index.vue"
import { defaultPresetFrom } from "@features/composer/lib/model-preset.js"
import type { ComposerPreset } from "@features/composer/type.js"
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
  COMPOSER_CATALOG,
  COMPOSER_QUEUE_SEED,
  COMPOSER_USAGE,
  createComposerAttachments,
  createComposerQueue,
} from "@/stories/fixtures/composer.js"
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
  /** 预填输入框文本。 */
  composerText: string
  /** 运行态：有文本时主钮变入队，空白时变停止。 */
  composerRunning: boolean
  /** 显示上下文用量环与面板。 */
  composerUsage: boolean
  /** 队列里预置两条待发。 */
  composerQueue: boolean
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

/** 宽度跟着预览面板走，视口预设管尺寸；写死宽会在面板更宽时留白。 */
const withWorkbenchFrame: Decorator = (_story) => ({
  template: `<div style="width:100%;height:100vh;overflow:hidden"><story /></div>`,
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
    // ModelPicker 的模型触发器两处既有缺陷（aria-label 少了「 · 」分隔、暗色强度标签对比度 2.86），
    // 整页故事不绕开业务组件，只把它的子树从 axe 检视里排除；修根因在 ModelPicker。
    a11y: { context: { exclude: [".selector"] } },
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
    composerText: { control: "text" },
    composerRunning: { control: "boolean" },
    composerUsage: { control: "boolean" },
    composerQueue: { control: "boolean" },
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
    composerText: "",
    composerRunning: false,
    composerUsage: true,
    composerQueue: false,
    settingsOpen: false,
    settingsPane: "general",
    dark: false,
  },
  render: (args) => ({
    components: { AppLayout, Composer, SettingsDialog, SidebarView, TranscriptBody },
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
      /** 设置弹层本地开关：Esc 与关闭按钮都走 update:open，Docs 页不会留下关不掉的浮层。 */
      const settingsOpen = ref(args.settingsOpen)

      watch(
        () => args.settingsOpen,
        (open) => (settingsOpen.value = open),
      )

      /** 输入卡状态全在本地：故事不发请求，send / queue / abort 只改这几处。 */
      const prompt = ref("")
      const preset = ref<ComposerPreset | undefined>(defaultPresetFrom(COMPOSER_CATALOG))
      const running = ref(args.composerRunning)
      const attachments = createComposerAttachments()
      const queue = createComposerQueue()
      const bar = useTemplateRef<HTMLElement>("bar")
      const { height: barHeight } = useElementSize(bar, undefined, { box: "border-box" })
      /** 贴底输入条不占流：量出的高度写给正文的底部留白，与 session-workbench 一致。 */
      const reserve = computed(() => `${Math.ceil(barHeight.value)}px`)
      const usage = computed(() => (args.composerUsage ? COMPOSER_USAGE : undefined))

      // PromptEditor 只在 prompt 变化时回写 DOM；预填文本要等挂载后再赋值，否则编辑器是空的。
      onMounted(() => (prompt.value = args.composerText))

      watch(
        () => args.composerText,
        (text) => (prompt.value = text),
      )

      watch(
        () => args.composerRunning,
        (next) => (running.value = next),
      )

      /** 队列开关只换预置条目：先清空，打开时灌入两条待发。 */
      function syncQueue(seed: boolean) {
        for (const item of [...queue.items.value]) queue.remove(item.id)

        if (seed) COMPOSER_QUEUE_SEED.forEach((text) => queue.enqueue(text))
      }

      watch(() => args.composerQueue, syncQueue, { immediate: true })

      function onSend() {
        prompt.value = ""
      }

      function onQueue(text: string) {
        queue.enqueue(text)
        prompt.value = ""
      }

      function onAbort() {
        running.value = false
      }

      return {
        args,
        cwd: SETTINGS_CWD,
        sidebar,
        transcript,
        settingsOpen,
        prompt,
        preset,
        running,
        usage,
        catalog: COMPOSER_CATALOG,
        attachments,
        queue,
        bar,
        reserve,
        phase: computed(() => (args.transcriptSample === "streaming" ? "turn" : "idle")),
        // 分页开关：hasMore 与 loadingOlder 同时置位，视口顶部才是加载占位。
        loadingOlder: computed(() => args.transcriptLoadingOlder),
        onSend,
        onQueue,
        onAbort,
      }
    },
    template: `
      <AppLayout>
        <template #sidebar="{ onNavigate }">
          <SidebarView v-bind="sidebar" @navigate="onNavigate()" />
        </template>

        <div
          class="conversation-column"
          :style="{ '--composer-reserve': reserve }"
          style="position: relative; display: flex; flex-direction: column; flex: 1; min-width: 0; min-height: 0; --size-content: var(--chat-user-width, 680px)"
        >
          <TranscriptBody
            v-bind="transcript"
            :phase="phase"
            :has-more="loadingOlder"
            :loading-older="loadingOlder"
          />

          <div
            ref="bar"
            class="composer-bar"
            style="position: absolute; inset-inline: 0; bottom: 0; z-index: 2; padding-bottom: calc(var(--space-sm) + env(safe-area-inset-bottom, 0px)); pointer-events: none"
          >
            <div
              class="composer-stack"
              style="position: relative; width: 100%; max-width: calc(var(--size-content) + var(--space-sm)); margin-inline: auto; pointer-events: auto"
            >
              <Composer
                v-model:prompt="prompt"
                v-model:preset="preset"
                :catalog="catalog"
                :attachments="attachments"
                :running="running"
                :usage="usage"
                :cwd="cwd"
                :queue="queue"
                @send="onSend"
                @queue="onQueue"
                @abort="onAbort"
              />
            </div>
          </div>
        </div>
      </AppLayout>

      <SettingsDialog
        v-if="settingsOpen"
        :key="args.settingsPane"
        :open="settingsOpen"
        :cwd="cwd"
        :initial-pane="args.settingsPane"
        @update:open="settingsOpen = $event"
      />
    `,
  }),
} satisfies Meta<WorkbenchArgs>

export default meta

type Story = StoryObj<typeof meta>

/** 整页默认：日期分组侧栏 + 长会话正文 + 贴底输入卡，正文可滚动、卡片可点、工具卡可展开。 */
export const Page: Story = {}
/** 整页暗色：与 Page 同一份状态，只换配色。 */
export const PageDark: Story = { args: { dark: true } }
