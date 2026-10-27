<!-- 整页故事：把工作台壳、侧栏、正文与输入卡拼一屏，交互全走故事内本地状态 -->
<template>
  <AppLayout>
    <template #sidebar="{ onNavigate }">
      <SidebarView
        v-model:search-open="searchOpen"
        v-model:scope-filter="scopeFilter"
        v-model:grouping="grouping"
        v-model:sort="sort"
        :groups="groups"
        :connected="true"
        :sb-expanded="true"
        :sections="sections"
        :card-foot-by-id="SIDEBAR_CARD_FEET"
        :listed-sessions="listedSessions"
        :pinned-ids="pinnedIds"
        :highlighted-session-id="highlightedId"
        :expanded-sections="expandedSections"
        :expanded-by-group="expandedByGroup"
        @toggle-sidebar="chrome?.toggleSidebar()"
        @create="createSession"
        @add-project="addWorkspace"
        @settings="settingsOpen = true"
        @navigate="onNavigate()"
        @open="highlightedId = $event"
        @prime="highlightedId = $event"
        @toggle-pinned="togglePinned"
        @rename="renameSession"
        @delete="deleteSession"
        @reorder-pinned="reorderPinned"
        @toggle-section="toggleSection"
        @reveal-more="revealMore"
        @collapse-group="collapseGroup"
      />
    </template>

    <WorkbenchChrome
      ref="chrome"
      :content-width="contentWidth"
      :resizing="resizing"
      :drop-active="dropActive || dragOver"
      :idle="idle"
      :error="pageError"
      :show-handles="showHandles"
      :scroll-shown="scrollShown"
      :measure="sizing.measure"
      @start="sizing.start()"
      @drag="sizing.preview"
      @commit="sizing.commit"
      @end="sizing.end()"
      @nudge="sizing.nudge"
    >
      <template #header="{ sidebarExpanded, sidebarOpen, toggleSidebar }">
        <WorkbenchHeaderView
          :title="active.title"
          :session-id="highlightedId"
          :pinned="active.pinned"
          :cwd-label="active.cwdLabel"
          :cwd-path="active.session?.cwd"
          :sidebar-expanded="sidebarExpanded"
          :sidebar-open="sidebarOpen"
          @toggle-sidebar="toggleSidebar()"
          @rename="renameSession(highlightedId, $event)"
          @toggle-pinned="togglePinned(highlightedId)"
          @delete="deleteSession(highlightedId)"
        />
      </template>

      <template #error>
        <StartupError :detail="STARTUP_DETAIL" />
      </template>

      <template #hero>
        <WorkbenchHero
          v-model:workspace-id="heroWorkspaceId"
          title-id="workbench-hero-title"
          :workspaces="workspaces"
          @add="addWorkspace()"
        />
      </template>

      <template #body>
        <TranscriptView
          ref="transcriptView"
          v-bind="transcript"
          :phase="phase"
          :has-more="hasMore"
          :loading-older="loadingOlder"
          @load-older="loadOlder"
        />
      </template>

      <template #floating>
        <Tooltip>
          <TooltipTrigger as-child>
            <IconButton
              class="scroll-latest-control"
              type="button"
              :aria-label="scrollLabel"
              variant="outline"
              size="1"
              @click="transcriptView?.scrollToLatest('smooth')"
            >
              <span class="icon-swap">
                <LoaderIcon
                  :data-visible="running"
                  :class="{ 'animate-spin motion-reduce:animate-none': running }"
                />

                <ArrowDownIcon :data-visible="!running" />
              </span>
            </IconButton>
          </TooltipTrigger>

          <TooltipContent>{{ scrollLabel }}</TooltipContent>
        </Tooltip>
      </template>

      <template #composer>
        <Composer
          v-model:prompt="prompt"
          v-model:preset="preset"
          :catalog="COMPOSER_CATALOG"
          :attachments="attachments"
          :running="running"
          :content-resizing="resizing"
          :usage="usage"
          :cwd="SETTINGS_CWD"
          :queue="queue"
          :hero="idle"
          @send="live.send"
          @queue="live.enqueue"
          @abort="live.abort"
        />
      </template>
    </WorkbenchChrome>
  </AppLayout>

  <AlertToaster />

  <SettingsDialog
    v-if="settingsOpen"
    :key="settingsPane"
    :open="settingsOpen"
    :cwd="SETTINGS_CWD"
    :initial-pane="settingsPane"
    @update:open="settingsOpen = $event"
  />
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, useTemplateRef, watch } from "vue"
import { useEventListener } from "@vueuse/core"

import { t } from "@i18n/index.js"
import AlertToaster from "@components/layout/AlertToaster.vue"
import AppLayout from "@components/layout/AppLayout.vue"
import { dismissNotice, noticeQueue, notifyAction } from "@components/layout/notify.js"
import { IconButton } from "@components/ui/button/index.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"
import { ArrowDownIcon, LoaderIcon } from "@components/icons/index.js"
import Composer from "@features/composer/index.vue"
import { defaultPresetFrom } from "@features/composer/lib/model-preset.js"
import type { ComposerPreset } from "@features/composer/type.js"
import { sessionTitle, workspaceName } from "@features/session-nav/index.js"
import SidebarView from "@features/session-nav/components/SidebarView.vue"
import type { SidebarGrouping, SidebarSort } from "@features/session-nav/type.js"
import SettingsDialog from "@features/settings/components/SettingsDialog.vue"
import StartupError from "@features/session-workbench/components/StartupError.vue"
import WorkbenchHeaderView from "@features/session-workbench/components/WorkbenchHeaderView.vue"
import WorkbenchHero from "@features/session-workbench/components/WorkbenchHero.vue"
import { useColorScheme } from "@features/theme/index.js"
import TranscriptView from "@features/transcript-view/index.vue"
import type { SessionMetadata } from "@/types/common-type.js"
import {
  COMPOSER_CATALOG,
  COMPOSER_QUEUE_SEED,
  COMPOSER_USAGE,
  createComposerAttachments,
  createComposerQueue,
} from "@/stories/fixtures/composer.js"
import { createLiveTurn } from "@/stories/fixtures/live-turn.js"
import {
  SIDEBAR_PINNED_IDS,
  SIDEBAR_SESSIONS,
  SIDEBAR_WORKSPACES,
  TRANSCRIPT_SAMPLES,
  type TranscriptSample,
} from "@/stories/fixtures/sessions.js"
import {
  HIGHLIGHTED_SESSION_ID,
  MAX_EARLIER_PAGES,
  SETTINGS_CWD,
  SIDEBAR_CARD_FEET,
  STARTUP_DETAIL,
  TOAST_MESSAGE,
  addedWorkspaceMessage,
  createContentWidth,
  draftSession,
  earlierPage,
  mergeTranscript,
  nextWorkspacePath,
  workbenchGroups,
  workbenchListed,
  workbenchSections,
  type EarlierPage,
  type WorkbenchControls,
} from "@/stories/fixtures/workbench.js"
import WorkbenchChrome from "@/stories/WorkbenchChrome.vue"

const props = defineProps<WorkbenchControls>()
const { setScheme } = useColorScheme()

watch(
  () => props.dark,
  () => setScheme(props.dark ? "dark" : "light"),
  { immediate: true },
)

const chrome = useTemplateRef<InstanceType<typeof WorkbenchChrome>>("chrome")
const transcriptView = useTemplateRef<InstanceType<typeof TranscriptView>>("transcriptView")
/** 侧栏本地状态：controls 改了就覆盖，重挂载后回到 controls 给的值。 */
const grouping = ref<SidebarGrouping>(props.sidebarGrouping)
const scopeFilter = ref<string | undefined>(props.sidebarScope || undefined)
const searchOpen = ref(props.sidebarSearch)
const sort = ref<SidebarSort>("updated")
const sessions = ref<SessionMetadata[]>([...SIDEBAR_SESSIONS])
const workspaces = ref<string[]>([...SIDEBAR_WORKSPACES])
const pinnedOrder = ref<string[]>([...SIDEBAR_PINNED_IDS])
const highlightedId = ref<string | undefined>(HIGHLIGHTED_SESSION_ID)
const expandedByGroup = ref<Record<string, number>>({})
/** 只记被收起的分区：换分组后新分区默认仍然展开。 */
const collapsedKeys = ref<ReadonlySet<string>>(new Set())

watch(
  () => props.sidebarGrouping,
  (value) => (grouping.value = value),
)

watch(
  () => props.sidebarScope,
  (value) => (scopeFilter.value = value || undefined),
)

watch(
  () => props.sidebarSearch,
  (value) => (searchOpen.value = value),
)

const pinnedIds = computed(() => new Set(pinnedOrder.value))
const listedSessions = computed(() => workbenchListed(sessions.value, sort.value))
const groups = computed(() => workbenchGroups(sessions.value, workspaces.value, sort.value))
const sections = computed(() =>
  workbenchSections({
    sessions: sessions.value,
    pinnedOrder: pinnedOrder.value,
    grouping: grouping.value,
    sort: sort.value,
    scope: scopeFilter.value,
    localWorkspaces: workspaces.value,
    expandedByGroup: expandedByGroup.value,
  }),
)
const expandedSections = computed(() => {
  const keys = sections.value.map((section) => section.key)
  return new Set(keys.filter((key) => !collapsedKeys.value.has(key)))
})
/** 顶部标题、置顶态与目录名都跟着高亮会话走，与侧栏同一份状态。 */
const active = computed(() => {
  const session = sessions.value.find((row) => row.id === highlightedId.value)
  return {
    session,
    title: session ? sessionTitle(session) : "",
    pinned: Boolean(session && pinnedIds.value.has(session.id)),
    cwdLabel: session?.cwd ? workspaceName(session.cwd) : "",
  }
})

function createSession(cwd?: string): void {
  const path = cwd ?? heroWorkspaceId.value ?? workspaces.value[0]

  if (!path) {
    addWorkspace()
    return
  }

  const draft = draftSession(path)

  if (!sessions.value.some((session) => session.id === draft.id))
    sessions.value = [draft, ...sessions.value]
  highlightedId.value = draft.id
}

/** 新增项目：故事不发系统选目录请求，本地追加一个目录并提示。 */
function addWorkspace(): void {
  const path = nextWorkspacePath(workspaces.value.length)

  workspaces.value = [...workspaces.value, path]
  heroWorkspaceId.value = path
  notifyAction(addedWorkspaceMessage(path))
}

function renameSession(id: string | undefined, name: string): void {
  const next = name.trim()

  if (!id || !next) return
  sessions.value = sessions.value.map((session) =>
    session.id === id ? { ...session, sessionName: next } : session,
  )
}

function deleteSession(id: string | undefined): void {
  if (!id) return
  sessions.value = sessions.value.filter((session) => session.id !== id)
  pinnedOrder.value = pinnedOrder.value.filter((item) => item !== id)

  if (highlightedId.value === id) highlightedId.value = sessions.value[0]?.id
}

function togglePinned(id: string | undefined): void {
  if (!id) return
  pinnedOrder.value = pinnedOrder.value.includes(id)
    ? pinnedOrder.value.filter((item) => item !== id)
    : [...pinnedOrder.value, id]
}

function reorderPinned(id: string, toIndex: number): void {
  if (!pinnedOrder.value.includes(id)) return
  const next = pinnedOrder.value.filter((item) => item !== id)

  next.splice(Math.min(toIndex, next.length), 0, id)
  pinnedOrder.value = next
}

function toggleSection(key: string): void {
  const next = new Set(collapsedKeys.value)

  if (next.has(key)) next.delete(key)
  else next.add(key)
  collapsedKeys.value = next
}

function revealMore(key: string): void {
  const extra = expandedByGroup.value[key] ?? 0

  expandedByGroup.value = { ...expandedByGroup.value, [key]: extra + 1 }
}

function collapseGroup(key: string): void {
  const next = { ...expandedByGroup.value }

  delete next[key]
  expandedByGroup.value = next
}

/** 正文分页：每点一次把更早一页拼到顶部，加载期间走占位。 */
const sample = computed<TranscriptSample>(() => TRANSCRIPT_SAMPLES[props.transcriptSample])
const earlier = shallowRef<EarlierPage[]>([])
const olderLoading = ref(false)
const olderLeft = ref(MAX_EARLIER_PAGES)
let olderTimer = 0
const hasMore = computed(
  () => props.transcriptLoadingOlder || (props.transcriptSample === "long" && olderLeft.value > 0),
)
const loadingOlder = computed(() => props.transcriptLoadingOlder || olderLoading.value)
const transcript = computed(() => mergeTranscript(sample.value, earlier.value, live.items.value))

function loadOlder(): void {
  if (!hasMore.value || loadingOlder.value) return
  olderLoading.value = true
  olderTimer = window.setTimeout(() => {
    earlier.value = [earlierPage(MAX_EARLIER_PAGES - olderLeft.value), ...earlier.value]
    olderLeft.value -= 1
    olderLoading.value = false
  }, 600)
}

watch(
  () => props.transcriptSample,
  () => {
    earlier.value = []
    olderLeft.value = MAX_EARLIER_PAGES
    olderLoading.value = false
    live.reset()
  },
)

/** 输入卡状态全在本地：故事不发请求，send / queue / abort 只改这几处。 */
const prompt = ref("")
const preset = ref<ComposerPreset | undefined>(defaultPresetFrom(COMPOSER_CATALOG))
const attachments = createComposerAttachments()
const queue = createComposerQueue()
/** 发送侧全在本地：清空输入、结算附件、跑一轮模拟回复，运行中再来的消息入队。 */
const live = createLiveTurn({ prompt, attachments, queue })
const running = live.running
const usage = computed(() => (props.composerUsage ? COMPOSER_USAGE : undefined))
const idle = computed(() => props.sessionState === "idle")
/** Hero 手选目录：真实页面来自 side nav，故事里只留本地值。 */
const heroWorkspaceId = ref<string | undefined>(SIDEBAR_WORKSPACES[0])

// PromptEditor 只在 prompt 变化时回写 DOM；预填文本要等挂载后再赋值，否则编辑器是空的。
onMounted(() => (prompt.value = props.composerText))

watch(
  () => props.composerText,
  (text) => (prompt.value = text),
)

watch(
  () => props.composerRunning,
  (next) => (running.value = next),
)

/** 队列开关只换预置条目：先清空，打开时灌入两条待发。 */
function syncQueue(seed: boolean) {
  for (const item of [...queue.items.value]) queue.remove(item.id)

  if (seed) COMPOSER_QUEUE_SEED.forEach((text) => queue.enqueue(text))
}

watch(() => props.composerQueue, syncQueue, { immediate: true })

/** 附件拖入：故事壳只画引导层，落点交给本地附件夹具。 */
const dragOver = ref(false)

useEventListener(window, "dragenter", (event) => {
  if (event.dataTransfer?.types.includes("Files")) dragOver.value = true
})

useEventListener(window, "dragleave", (event) => {
  if (!event.relatedTarget) dragOver.value = false
})

useEventListener(
  window,
  "drop",
  (event) => {
    if (!event.dataTransfer?.types.includes("Files")) return
    event.preventDefault()
    dragOver.value = false
    attachments.addDropped(event.dataTransfer)
  },
  { capture: true },
)

const settingsOpen = ref(props.settingsOpen)

watch(
  () => props.settingsOpen,
  (open) => (settingsOpen.value = open),
)

/** 告警条走真实模块级队列：关掉开关就清空，避免残留到下一个故事。 */
function syncToast(on: boolean) {
  for (const item of [...noticeQueue.value]) dismissNotice(item.id)

  if (on) notifyAction(TOAST_MESSAGE)
}

watch(() => props.toast, syncToast, { immediate: true })

onBeforeUnmount(() => {
  window.clearTimeout(olderTimer)
  live.reset()
  syncToast(false)
})

/** 「回到底部」浮钮：真实信号来自 TranscriptView，开关可强制显示。 */
const scrollShown = computed(
  () => props.scrollToLatestVisible || (transcriptView.value?.showScrollToLatest ?? false),
)
/** 列宽：拖动中预览、松手落定、键盘 ±16，夹紧规则与真实 hook 一致。 */
const sizing = createContentWidth(columnWidth)
const contentWidth = sizing.width
const resizing = sizing.resizing

/** 夹紧上限看列宽：列本身不被 --chat-user-width 改宽度。 */
function columnWidth(): number {
  const root = chrome.value?.$el
  const column = root instanceof HTMLElement ? root.querySelector(".conversation-column") : null
  return column instanceof HTMLElement ? column.clientWidth : 0
}

const phase = computed(() =>
  props.transcriptSample === "streaming" || live.running.value ? "turn" : "idle",
)
const showHandles = computed(() => props.showContentHandles && !props.pageError && !idle.value)
const scrollLabel = t("transcript.scrollToBottom")
</script>
