import type { Decorator, Meta, StoryObj } from "@storybook/vue3-vite"
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  useTemplateRef,
  watch,
  type Component,
} from "vue"

import { t } from "@i18n/index.js"
import AlertToaster from "@components/layout/AlertToaster.vue"
import AppLayout from "@components/layout/AppLayout.vue"
import { dismissNotice, noticeQueue, notifyAction } from "@components/layout/notify.js"
import { Button as ButtonBase } from "@components/ui/button/index.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"
import { ArrowDownIcon, LoaderIcon } from "@components/icons/index.js"
import Composer from "@features/composer/index.vue"
import { defaultPresetFrom } from "@features/composer/lib/model-preset.js"
import type { ComposerPreset } from "@features/composer/type.js"
import SidebarView from "@features/session-nav/components/SidebarView.vue"
import type { SidebarGrouping } from "@features/session-nav/type.js"
import SettingsDialog from "@features/settings/components/SettingsDialog.vue"
import StartupError from "@features/session-workbench/components/StartupError.vue"
import WorkbenchHeaderView from "@features/session-workbench/components/WorkbenchHeaderView.vue"
import WorkbenchHero from "@features/session-workbench/components/WorkbenchHero.vue"
import { useColorScheme } from "@features/theme/index.js"
import TranscriptView from "@features/transcript-view/index.vue"
import { withMemoryRouter } from "@/stories/decorators.js"
import {
  COMPOSER_CATALOG,
  COMPOSER_QUEUE_SEED,
  COMPOSER_USAGE,
  createComposerAttachments,
  createComposerQueue,
} from "@/stories/fixtures/composer.js"
import { SIDEBAR_WORKSPACES, TRANSCRIPT_SAMPLES } from "@/stories/fixtures/sessions.js"
import {
  ACTIVE_CWD_LABEL,
  ACTIVE_PINNED,
  ACTIVE_SESSION,
  SCOPE_OPTIONS,
  SETTINGS_CWD,
  SIDEBAR_BASE,
  STARTUP_DETAIL,
  TOAST_MESSAGE,
  expandedKeys,
  sectionsOf,
} from "@/stories/fixtures/workbench.js"
import WorkbenchChrome from "@/stories/WorkbenchChrome.vue"

type WorkbenchArgs = {
  /** 侧栏分组：「日期」桶或「工作目录」组。 */
  sidebarGrouping: SidebarGrouping
  /** 项目筛选；空串映射成 undefined。 */
  sidebarScope: string
  /** 打开搜索弹层。 */
  sidebarSearch: boolean
  /** 正文样本；streaming 顺带置 running。 */
  transcriptSample: "short" | "long" | "streaming" | "error"
  /** 顶部折出「加载更早」占位。 */
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

/** Button 的 Props 未导出，注册进 meta 会撞 TS4023，按 Component 收窄。 */
const Button = ButtonBase as Component
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
    sessionState: { control: "select", options: ["session", "idle"] },
    dropActive: { control: "boolean" },
    showContentHandles: { control: "boolean" },
    scrollToLatestVisible: { control: "boolean" },
    pageError: { control: "boolean" },
    toast: { control: "boolean" },
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
    sessionState: "session",
    dropActive: false,
    showContentHandles: true,
    scrollToLatestVisible: false,
    pageError: false,
    toast: false,
    composerText: "",
    composerRunning: false,
    composerUsage: true,
    composerQueue: false,
    settingsOpen: false,
    settingsPane: "general",
    dark: false,
  },
  render: (args) => ({
    components: {
      AlertToaster,
      AppLayout,
      Button,
      Composer,
      SettingsDialog,
      SidebarView,
      StartupError,
      Tooltip,
      TooltipContent,
      TooltipTrigger,
      TranscriptView,
      WorkbenchChrome,
      WorkbenchHeaderView,
      WorkbenchHero,
      ArrowDownIcon,
      LoaderIcon,
    },
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
        // 样本时间基准固定，运行中那一轮对齐到当下，否则计时器算出天文数字
        timings: sample.value.timings?.map((item, index, all) =>
          sample.value.running && index === all.length - 1
            ? { ...item, startedAt: Date.now() - 12_000 }
            : item,
        ),
        running: sample.value.running,
      }))
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
      const usage = computed(() => (args.composerUsage ? COMPOSER_USAGE : undefined))
      const idle = computed(() => args.sessionState === "idle")
      /** Hero 手选目录：真实页面来自 side nav，故事里只留本地值。 */
      const heroWorkspaceId = ref<string | undefined>(SIDEBAR_WORKSPACES[0])

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

      /** 告警条走真实模块级队列：关掉开关就清空，避免残留到下一个故事。 */
      function syncToast(on: boolean) {
        for (const item of [...noticeQueue.value]) dismissNotice(item.id)

        if (on) notifyAction(TOAST_MESSAGE)
      }

      watch(() => args.toast, syncToast, { immediate: true })
      onBeforeUnmount(() => syncToast(false))

      /** 「回到底部」浮钮：真实信号来自 TranscriptView，开关可强制显示。 */
      const transcriptView = useTemplateRef<InstanceType<typeof TranscriptView>>("transcriptView")
      const chrome = useTemplateRef<InstanceType<typeof WorkbenchChrome>>("chrome")
      const scrollShown = computed(
        () => args.scrollToLatestVisible || (transcriptView.value?.showScrollToLatest ?? false),
      )

      function onScrollToLatest() {
        transcriptView.value?.scrollToLatest("smooth")
      }

      /** 列宽基准：把手只读宽度，故事不落偏好。 */
      function measureContent(): number {
        const root = chrome.value?.$el
        const column =
          root instanceof HTMLElement ? root.querySelector(".conversation-column") : null
        return column instanceof HTMLElement ? column.clientWidth : 0
      }

      /** 手柄事件只做本地记录。 */
      const handleEvents = ref<string[]>([])

      function onHandle(name: string, width?: number) {
        handleEvents.value = [
          ...handleEvents.value,
          width === undefined ? name : `${name}:${Math.round(width)}`,
        ]
      }

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
        activeSession: ACTIVE_SESSION,
        pinned: ACTIVE_PINNED,
        cwdLabel: ACTIVE_CWD_LABEL,
        cwd: SETTINGS_CWD,
        startupDetail: STARTUP_DETAIL,
        scrollLabel: t("transcript.scrollToBottom"),
        sidebar,
        transcript,
        settingsOpen,
        prompt,
        preset,
        running,
        usage,
        idle,
        heroWorkspaceId,
        workspaces: SIDEBAR_WORKSPACES,
        catalog: COMPOSER_CATALOG,
        attachments,
        queue,
        chrome,
        transcriptView,
        handleEvents,
        scrollShown,
        onScrollToLatest,
        measureContent,
        onHandle,
        phase: computed(() => (args.transcriptSample === "streaming" ? "turn" : "idle")),
        // 分页开关：hasMore 与 loadingOlder 同时置位，视口顶部才是加载占位。
        loadingOlder: computed(() => args.transcriptLoadingOlder),
        showHandles: computed(
          () => args.showContentHandles && args.sessionState === "session" && !args.pageError,
        ),
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

        <WorkbenchChrome
          ref="chrome"
          :drop-active="args.dropActive"
          :idle="idle"
          :error="args.pageError"
          :show-handles="showHandles"
          :scroll-shown="scrollShown"
          :measure="measureContent"
          @start="onHandle('start')"
          @drag="onHandle('drag', $event)"
          @commit="onHandle('commit', $event)"
          @end="onHandle('end')"
          @nudge="onHandle('nudge', $event)"
        >
          <template #header="{ sidebarExpanded, sidebarOpen, toggleSidebar }">
            <WorkbenchHeaderView
              :title="activeSession?.sessionName ?? ''"
              :session-id="activeSession?.id"
              :pinned="pinned"
              :cwd-label="cwdLabel"
              :cwd-path="activeSession?.cwd"
              :sidebar-expanded="sidebarExpanded"
              :sidebar-open="sidebarOpen"
              @toggle-sidebar="toggleSidebar()"
            />
          </template>

          <template #error>
            <StartupError :detail="startupDetail" />
          </template>

          <template #hero>
            <WorkbenchHero
              v-model:workspace-id="heroWorkspaceId"
              title-id="workbench-hero-title"
              :workspaces="workspaces"
            />
          </template>

          <template #body>
            <TranscriptView
              ref="transcriptView"
              v-bind="transcript"
              :phase="phase"
              :has-more="loadingOlder"
              :loading-older="loadingOlder"
            />
          </template>

          <template #floating>
            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  class="scroll-latest-control"
                  type="button"
                  :aria-label="scrollLabel"
                  variant="outline"
                  size="icon-sm"
                  @click="onScrollToLatest"
                >
                  <span class="icon-swap">
                    <LoaderIcon
                      :data-visible="running"
                      :class="{ 'animate-spin motion-reduce:animate-none': running }"
                    />

                    <ArrowDownIcon :data-visible="!running" />
                  </span>
                </Button>
              </TooltipTrigger>

              <TooltipContent>{{ scrollLabel }}</TooltipContent>
            </Tooltip>
          </template>

          <template #composer>
            <Composer
              v-model:prompt="prompt"
              v-model:preset="preset"
              :catalog="catalog"
              :attachments="attachments"
              :running="running"
              :usage="usage"
              :cwd="cwd"
              :queue="queue"
              :hero="idle"
              @send="onSend"
              @queue="onQueue"
              @abort="onAbort"
            />
          </template>
        </WorkbenchChrome>
      </AppLayout>

      <AlertToaster />

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

/** 整页默认：日期分组侧栏 + 长会话正文 + 贴底输入卡 + 顶部工作台栏与宽度手柄。 */
export const Page: Story = {}
/** 整页暗色：与 Page 同一份状态，只换配色。 */
export const PageDark: Story = { args: { dark: true } }
/** 空会话首屏：正文区换成 Hero，输入卡抬到 dock 位。 */
export const PageIdle: Story = { args: { sessionState: "idle" } }
