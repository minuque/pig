<template>
  <div
    ref="panel"
    class="session-panel"
    :class="{ 'is-drop-active': dropActive }"
    v-bind="sessionDropTargetAttrs"
    @dragenter="onDragEnter"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <div class="drop-guide" aria-hidden="true">
      <span class="drop-guide-label">
        <FilePlusIcon class="drop-guide-icon" />
        {{ t("composer.dropGuide") }}
      </span>
    </div>

    <RemoteWorkspaceDialog v-model:open="remoteOpen" :add="addRemoteWorkspace" />

    <div class="conversation-column">
      <StartupError v-if="pageError" v-bind="pageError" />

      <template v-else>
        <Transition name="welcome-field" appear>
          <WelcomeField v-if="welcome && welcomeField !== 'off'" />
        </Transition>

        <div class="session-stage">
          <Transition name="dock-hero" appear>
            <div v-if="welcome" key="hero" class="idle-hero">
              <WorkbenchHero
                v-model:workspace-id="heroWorkspaceId"
                title-id="workbench-hero-title"
                :workspaces="workspaces"
                :selectable="sessionId === undefined"
                :adding="addingWorkspace"
                :ready="connected"
                @add="addWorkspace()"
                @add-remote="remoteOpen = true"
              />
            </div>
          </Transition>

          <TranscriptView
            v-if="!welcome"
            ref="transcriptView"
            :session-id="sessionId ?? ''"
            :transcript="transcript"
            :running="turnPending"
            :phase="phase"
            :sending="submitting"
            :stopping="aborting"
            :timings="turnTimings"
          >
            <SessionRail />
          </TranscriptView>
        </div>

        <div
          ref="composerBar"
          class="composer-bar"
          :class="{ 'is-hero': welcome, 'settle-in': settleIn, 'beside-rail': railDocked }"
        >
          <div class="composer-stack">
            <div class="session-floating-controls" :class="{ shown: showScrollToLatest }">
              <span class="scroll-latest">
                <Button
                  class="scroll-latest-button"
                  type="button"
                  variant="soft"
                  size="s"
                  radius="full"
                  @click="scrollToLatest('smooth')"
                >
                  <LoaderIcon v-if="turnPending" class="size-icon is-spinning" />
                  <ArrowDownIcon v-else class="size-icon" />
                  {{ t("transcript.scrollToBottom") }}
                </Button>
              </span>
            </div>

            <ExternalTurnNotice />

            <Composer
              v-model:prompt="prompt"
              v-model:preset="preset"
              :catalog="catalog"
              :attachments="composerAttachments"
              :running="turnPending"
              :aborting="aborting"
              :session-id="sessionId"
              :cwd="composerCwd"
              :usage="welcome ? undefined : contextUsage"
              :send-disabled="sendDisabled"
              :queue="composerQueue"
              @send="onSend"
              @send-now="onQueueSendNow"
              @queue="onQueue"
              @abort="onAbort"
            />
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, useTemplateRef, watch } from "vue"
import { useEventListener, useResizeObserver } from "@vueuse/core"
import { useRoute } from "vue-router"
import { warmWorkspace } from "@client/platform.js"
import { Button } from "@components/ui/button/index.js"
import Composer from "@features/composer/index.vue"
import { useComposerPreset } from "@features/composer/index.js"
import type { ComposerAttachmentBatch } from "@/types/attachment-type.js"
import { useComposerAttachments } from "@features/composer/hooks/use-composer-attachments.js"
import { useComposerQueue, type QueuedPrompt } from "@features/composer/hooks/use-composer-queue.js"
import { useSound } from "@features/click-sound/index.js"
import { useI18n } from "@i18n/index.js"
import { sessionDropTargetAttrs, useNav } from "@features/session-nav/index.js"
import { useSession } from "@features/session/index.js"
import { useAppearancePrefs } from "@features/settings/index.js"
import ExternalTurnNotice from "@features/session-workbench/components/ExternalTurnNotice.vue"
import StartupError from "@features/session-workbench/components/StartupError.vue"
import WelcomeField from "@features/session-workbench/components/WelcomeField.vue"
import WorkbenchHero from "@features/session-workbench/components/WorkbenchHero.vue"
import { useComposerDock } from "@features/session-workbench/hooks/use-composer-dock.js"
import { useSessionDrop } from "@features/session-workbench/hooks/use-session-drop.js"
import { useTurnFinish } from "@features/session-workbench/hooks/use-turn-finish.js"
import TranscriptView from "@features/transcript-view/index.vue"
import SessionRail from "@features/session-rail/index.vue"
import { useSessionRail } from "@features/session-rail/index.js"
import RemoteWorkspaceDialog from "@features/remote-workspace/index.vue"
import { prefetchTranscriptView } from "@features/transcript-view/index.js"
import { ArrowDownIcon, FilePlusIcon, LoaderIcon } from "@components/icons/index.js"

onMounted(() => {
  if (typeof requestIdleCallback === "function")
    requestIdleCallback(prefetchTranscriptView, { timeout: 2000 })
  else setTimeout(prefetchTranscriptView, 1)
})

function nextWelcomeWorkspaceId(
  items: readonly string[],
  current: string | undefined,
  lastCwd: string | undefined,
): string | undefined {
  if (items.includes(current ?? "")) return current

  if (lastCwd !== undefined && items.includes(lastCwd)) return lastCwd
  return items[0]
}

const { t } = useI18n()
const route = useRoute()
const {
  sessionId,
  transcript,
  turnTimings,
  running,
  phase,
  submitting,
  turnPending,
  connectionError,
  connected,
  prompt,
  aborting,
  sessionCwd,
  creating,
  abortSession,
  sendPrompt,
  sendBackgroundPrompt,
  setBackgroundIdleHandler,
  setWelcomeHandoff,
  transcriptFor,
  contextUsage,
  welcome,
  externalTurn,
} = useSession()
const { catalog, preset } = useComposerPreset()
const { groups, lastCwd, addingWorkspace, addWorkspace, addRemoteWorkspace } = useNav()
const remoteOpen = ref(false)
const { welcomeField } = useAppearancePrefs()
/** 与侧栏同一份目录：已授权 local + 会话 cwd。 */
const workspaces = computed(() => groups.value.map((group) => group.canonicalPath))
const pageError = computed(() => {
  if (connectionError.value && connected.value) {
    return { title: t("startup.connectFailed"), detail: connectionError.value.message }
  }

  return route.name === "error" ? {} : null
})
/** 会话面板宽度写回 rail 状态：摘要在常驻与浮层之间切换靠它。 */
const rail = useSessionRail()
/** 摘要列占着正文右侧：输入条只在正文那一段居中。 */
const railDocked = computed(
  () => !welcome.value && Boolean(sessionId.value) && rail?.dockedShown.value,
)
const panel = useTemplateRef<HTMLElement>("panel")

useResizeObserver(panel, ([entry]) => {
  if (entry) rail?.setWidth(entry.contentRect.width)
})

const welcomeWorkspaceId = shallowRef<string>()
const heroWorkspaceId = computed({
  get: () => (sessionId.value ? sessionCwd.value : welcomeWorkspaceId.value),
  set: (id) => {
    if (!sessionId.value) welcomeWorkspaceId.value = id
  },
})
const composerCwd = computed(() => (sessionId.value ? sessionCwd.value : welcomeWorkspaceId.value))
const sendDisabled = computed(
  () =>
    !composerCwd.value ||
    preset.value === undefined ||
    Boolean(creating.value) ||
    externalTurn.value,
)

// 侧栏点目录会写 lastCwd，Hero 跟随；workspaces 变化只兜底失效项，保住 Hero 手选
watch(lastCwd, (last) => {
  if (last !== undefined) welcomeWorkspaceId.value = last
})

watch(
  workspaces,
  (items) => {
    welcomeWorkspaceId.value = nextWelcomeWorkspaceId(
      items,
      welcomeWorkspaceId.value,
      lastCwd.value,
    )
  },
  { immediate: true },
)

// 第一条 Prompt 用这个目录建会话；连上后让 Host 后台预热同一目录的扩展与技能
watch(
  [connected, welcomeWorkspaceId],
  ([live, id]) => {
    if (live && id) void warmWorkspace(id).catch(() => undefined)
  },
  { immediate: true },
)

type TranscriptViewRef = InstanceType<typeof TranscriptView>

const transcriptView = useTemplateRef<TranscriptViewRef>("transcriptView")
const composerBar = useTemplateRef("composerBar")
/** 首屏挂载时输入条随 Hero 一起落位；之后的切换走停靠滑动。 */
const settleIn = welcome.value

useComposerDock(composerBar, welcome)

const RESERVE_DEBOUNCE_MS = 120
let reserveTimer = 0

/** 输入条脱离文档流后，把占位高度写给对话列，转录和空态都靠它留白。 */
function publishComposerReserve(entries: readonly ResizeObserverEntry[]) {
  const bar = composerBar.value
  const column = bar?.closest(".conversation-column")
  const box = entries[0]?.borderBoxSize?.[0]
  const height = box?.blockSize ?? bar?.getBoundingClientRect().height ?? 0

  if (!(column instanceof HTMLElement) || height <= 0) return
  const next = `${Math.ceil(height)}px`
  const prev = column.style.getPropertyValue("--composer-reserve")

  if (prev === next) return
  window.clearTimeout(reserveTimer)

  // 动画逐帧回写会让转录列每帧重排，合到尾沿写一次；首屏没有转录，Hero 直接跟着输入卡长高
  if (prev && !welcome.value) {
    reserveTimer = window.setTimeout(() => {
      reserveTimer = 0
      column.style.setProperty("--composer-reserve", next)
    }, RESERVE_DEBOUNCE_MS)
    return
  }

  column.style.setProperty("--composer-reserve", next)
}

useResizeObserver(composerBar, publishComposerReserve, { box: "border-box" })

onBeforeUnmount(() => window.clearTimeout(reserveTimer))

const showScrollToLatest = computed(() => transcriptView.value?.showScrollToLatest ?? false)

function scrollToLatest(behavior: "auto" | "smooth" = "auto") {
  transcriptView.value?.scrollToLatest(behavior)
}

const sound = useSound()
const composerAttachments = useComposerAttachments()

useSessionDrop(panel, composerAttachments.addFiles)

const composerQueue = useComposerQueue()

watch(
  sessionId,
  (id) => {
    composerQueue.setKey(id)
    composerAttachments.setKey(id)
  },
  { immediate: true },
)

function deliverPrompt(text: string, batch?: ComposerAttachmentBatch) {
  if (sessionId.value) scrollToLatest("auto")
  else if (!welcomeWorkspaceId.value) return Promise.resolve(false)
  return sendPrompt(text, sessionId.value ? undefined : welcomeWorkspaceId.value, batch).catch(
    () => false,
  )
}

const { markAborted, onBackgroundIdle } = useTurnFinish({
  sessionId: () => sessionId.value,
  running: () => running.value,
  pending: () => turnPending.value,
  transcript: () => transcript.value,
  queue: composerQueue,
  sound,
  sendForeground: deliverPrompt,
  sendBackground: sendBackgroundPrompt,
  transcriptFor,
})

// lifecycle 不认队列：后台会话跑完后的泵队与完成音由这里注入
setBackgroundIdleHandler(onBackgroundIdle)

setWelcomeHandoff((id) => {
  composerQueue.handOff(id)
  composerAttachments.handOff(id)
})

function onSend(text: string) {
  const batch = composerAttachments.consumeForSend()

  void deliverPrompt(text, batch).then((sent) => {
    // 只移走这次发出的附件；发送途中新加的留着，被中止或切走时 chips 也留着
    if (sent && batch) composerAttachments.settle(batch)
  })
}

/** 发送成功才出队：被拒（提交中、中止、切走）时条目留在队列里。 */
function onQueueSendNow(item: QueuedPrompt) {
  void deliverPrompt(item.text, item.attachments).then((sent) => {
    if (sent) composerQueue.remove(item.id)
  })
}

function onQueue(text: string) {
  const batch = composerAttachments.consumeForSend()

  composerQueue.enqueue(text, batch)

  // 附件归队列持有：入队同时清掉输入卡暂存，否则同一批文件会再传一次
  if (batch) composerAttachments.settle(batch)
  prompt.value = ""
}

function onAbort() {
  markAborted()
  void abortSession()
}

const dropActive = ref(false)

function looksLikeFileDrag(event: DragEvent): boolean {
  const data = event.dataTransfer

  if (!data) return false
  const types = Array.from(data.types)

  if (types.includes("Files") || types.includes("application/x-moz-file")) return true

  if (Array.from(data.items).some((item) => item.kind === "file")) return true
  // Windows 资源管理器在进入窗口前 types 经常是空的
  return types.length === 0
}

function claimFileDrag(event: DragEvent) {
  if (!looksLikeFileDrag(event)) return false
  event.preventDefault()

  if (event.dataTransfer) event.dataTransfer.dropEffect = "copy"
  return true
}

function stillInsidePanel(event: DragEvent): boolean {
  const node = event.currentTarget

  if (!(node instanceof HTMLElement)) return false
  const to = event.relatedTarget

  if (to instanceof Node && node.contains(to)) return true

  if (to) return false
  const box = node.getBoundingClientRect()
  const x = event.clientX
  const y = event.clientY
  return x > box.left && x < box.right && y > box.top && y < box.bottom
}

function onDragEnter(event: DragEvent) {
  if (!claimFileDrag(event)) return
  dropActive.value = true
}

function onDragOver(event: DragEvent) {
  if (!claimFileDrag(event)) return
  dropActive.value = true
}

function onDragLeave(event: DragEvent) {
  if (stillInsidePanel(event)) return
  dropActive.value = false
}

function onDrop(event: DragEvent) {
  dropActive.value = false
  event.preventDefault()
  composerAttachments.addDropped(event.dataTransfer)
}

function onWindowFileDragOver(event: DragEvent) {
  claimFileDrag(event)
}

function onWindowFileDrop(event: DragEvent) {
  if (!looksLikeFileDrag(event)) return
  event.preventDefault()
}

useEventListener(window, "dragenter", onWindowFileDragOver, { capture: true })

useEventListener(window, "dragover", onWindowFileDragOver, { capture: true })

useEventListener(window, "drop", onWindowFileDrop, { capture: true })
</script>

<style scoped>
/* 正文一列；摘要卡浮在右上角，右侧面板在 workbench 的面板列里 */
.session-panel {
  position: relative;
  container-type: inline-size;
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template: "conversation" minmax(0, 1fr) / minmax(0, 1fr);
}

.drop-guide {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: grid;
  place-items: center;
  pointer-events: none;
  opacity: 0;
  transition: opacity var(--duration-fast) var(--ease-out);
}

.session-panel.is-drop-active .drop-guide,
.session-panel[data-session-drop-over] .drop-guide {
  opacity: 1;
}

.drop-guide-label {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-sm) var(--space-md);
  border: var(--border-width) dashed var(--primary);
  border-radius: var(--radius-pill);
  background: var(--surface);
  color: var(--primary);
  font-size: var(--text-body);
  line-height: var(--text-body--line-height);
}

.drop-guide-icon {
  width: var(--size-icon);
  height: var(--size-icon);
}

/* 正文列：右侧面板占的列不跨进来，滚动条跟着正文列 */
.conversation-column {
  grid-area: conversation;
  position: relative;
  min-width: 0;
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  /* 测量前占位，挂上后由输入条边框盒覆盖 */
  --composer-reserve: 7rem;
  /* 首屏输入条底边离列底的距离：标题加输入条整组的中线落在列高 45% 处 */
  --hero-dock: calc(55% - var(--composer-reserve) / 2 - 2rem);
}

.session-stage {
  position: relative;
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.session-stage :deep(.row-tools) {
  position: relative;
  z-index: 2;
}

/* 首屏：Hero 贴在输入条上沿，两者作为一组略高于垂直中线 */
.idle-hero {
  position: absolute;
  inset: 0 0 calc(var(--hero-dock) + var(--composer-reserve));
  display: grid;
  place-items: end center;
  padding-inline: var(--space-md);
  padding-bottom: var(--space-xl);
}

/* 与常驻摘要面板同一组门槛（见 session-rail） */
.composer-bar {
  position: absolute;
  inset-inline: 0;
  bottom: 0;
  z-index: 2;
  padding-bottom: calc(var(--space-sm) + env(safe-area-inset-bottom, 0px));
  pointer-events: none;
}

.composer-bar.beside-rail {
  inset-inline-end: var(--size-rail);
}

.composer-bar.is-hero {
  bottom: var(--hero-dock);
}

/* 输入条下方的渐隐直接淡出正文本身，不再叠一层底色，输入卡圆角和投影不受遮挡；
   第二层让右侧滚动条一列保持不透明 */
.session-stage :deep(.transcript-viewport) {
  --composer-gap: calc(var(--space-sm) + env(safe-area-inset-bottom, 0px));
  mask-image:
    linear-gradient(
      to top,
      transparent var(--composer-gap),
      black calc(var(--composer-gap) + var(--edge-fade-band))
    ),
    linear-gradient(to right, transparent calc(100% - var(--space-sm)), black 0);
}

.composer-stack {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: min(calc(var(--size-content) + var(--space-sm)), calc(100% - 2 * var(--space-md)));
  /* 整组最高到头部下沿：队列再长也从这里让位，不压住头部与窗控 */
  max-block-size: calc(100dvh - var(--header-height) - 2 * var(--space-sm));
  margin-inline: auto;
  background: transparent;
  pointer-events: auto;
}

.session-floating-controls {
  position: absolute;
  inset-block-start: 0;
  /* composer-bar 已经让出侧栏，这里再让一次会偏左 */
  inset-inline: 0;
  z-index: 1;
  display: flex;
  justify-content: center;
  height: 0;
  overflow: visible;
  pointer-events: none;
  opacity: 0;
  translate: 0 var(--space-xxs);
  transition:
    opacity var(--duration-fast) var(--ease-out),
    translate var(--duration-normal) var(--ease-spring);
}

.session-floating-controls.shown {
  opacity: 1;
  translate: 0 0;
}

.session-floating-controls.shown .scroll-latest {
  pointer-events: auto;
}

/* soft 按钮底色半透明，垫一层同形实底，悬停时不透出正文；浮在输入卡上方 */
.scroll-latest {
  display: flex;
  align-self: flex-start;
  border-radius: var(--radius-pill);
  background: var(--popover);
  translate: 0 calc(-100% - var(--space-sm));
}

/* 外边框沿用原圆形图标钮：盒内一圈 --border 细环 */
.scroll-latest-button {
  box-shadow: inset 0 0 0 var(--border-width) var(--border);
}

/* 不要按下反馈：按住时保持悬停的底色 */
.scroll-latest-button:active {
  background-color: var(--accent-a4);
}

@media (max-width: 900px) {
  .composer-bar {
    padding-inline: var(--space-sm);
  }
}

@media (prefers-reduced-motion: reduce) {
  .session-floating-controls {
    transition: none;
  }

  .drop-guide {
    transition: none;
  }
}
</style>
