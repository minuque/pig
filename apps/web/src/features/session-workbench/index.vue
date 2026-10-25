<template>
  <div
    class="session-panel"
    :class="{ 'is-drop-active': dropActive }"
    @dragenter="onDragEnter"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <div class="drop-guide" aria-hidden="true">
      <span class="drop-guide-label">
        <DocumentAddIcon class="drop-guide-icon" />
        {{ t("composer.dropGuide") }}
      </span>
    </div>

    <WorkbenchHeader />

    <div
      ref="columnEl"
      class="conversation-column"
      :class="{ 'is-content-resizing': contentResizing }"
    >
      <StartupError v-if="pageError" v-bind="pageError" />

      <template v-else>
        <div class="session-stage" ref="stage">
          <Transition name="dock-hero" appear>
            <div v-if="showHero" key="hero" class="idle-hero">
              <WorkbenchHero
                v-model:workspace-id="heroWorkspaceId"
                title-id="workbench-hero-title"
                :workspaces="workspaces"
                :selectable="sessionId === undefined"
                :adding="addingWorkspace"
                :ready="connected"
                @add="addWorkspace()"
              />
            </div>
          </Transition>

          <TranscriptView
            v-if="!showHero"
            ref="transcriptView"
            :session-id="sessionId ?? ''"
            :transcript="transcript"
            :running="turnPending"
            :phase="phase"
            :sending="submitting"
            :stopping="aborting"
            :timings="turnTimings"
            :has-more="historyHasMore"
            :loading-older="loadingOlder"
            @load-older="loadOlderHistory"
          />
        </div>

        <div
          ref="composerBar"
          class="composer-bar"
          :class="{ 'is-hero': showHero, 'settle-in': settleIn }"
        >
          <div class="composer-stack">
            <div class="session-floating-controls" :class="{ shown: showScrollToLatest }">
              <Tooltip>
                <TooltipTrigger as-child>
                  <Button
                    class="scroll-latest-control"
                    type="button"
                    :aria-label="t('transcript.scrollToBottom')"
                    variant="outline"
                    size="icon-sm"
                    @click="scrollToLatest('smooth')"
                  >
                    <span class="icon-swap">
                      <LoaderIcon
                        :data-visible="turnPending"
                        :class="{ 'animate-spin motion-reduce:animate-none': turnPending }"
                      />

                      <ArrowDownIcon :data-visible="!turnPending" />
                    </span>
                  </Button>
                </TooltipTrigger>

                <TooltipContent>{{ t("transcript.scrollToBottom") }}</TooltipContent>
              </Tooltip>
            </div>

            <Composer
              v-model:prompt="prompt"
              v-model:preset="preset"
              :catalog="catalog"
              :attachments="composerAttachments"
              :running="turnPending"
              :aborting="aborting"
              :usage="sessionId ? contextUsage : undefined"
              :session-id="sessionId"
              :cwd="composerCwd"
              :send-disabled="sendDisabled"
              :content-resizing="contentResizing"
              :hero="showHero"
              :queue="composerQueue"
              @send="onSend"
              @send-now="onQueueSendNow"
              @queue="onQueue"
              @abort="onAbort"
            />
          </div>
        </div>
      </template>

      <template v-if="showContentHandles">
        <ContentWidthHandle
          v-for="side in contentHandleSides"
          :key="side"
          :side="side"
          :measure="snapshotWidth"
          @start="beginResize"
          @drag="previewWidth"
          @commit="commitWidth"
          @end="endResize"
          @nudge="nudgeWidth"
        />
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"
import Composer from "@features/composer/index.vue"
import {
  useComposerAttachments,
  type ComposerAttachmentBatch,
} from "@features/composer/hooks/use-composer-attachments.js"
import { useComposerQueue, type QueuedPrompt } from "@features/composer/hooks/use-composer-queue.js"
import { useSound } from "@features/click-sound/index.js"
import { useI18n } from "@i18n/index.js"
import { useNav } from "@features/session-nav/index.js"
import { useSession } from "@features/session-workbench/index.js"
import ContentWidthHandle from "@features/session-workbench/components/ContentWidthHandle.vue"
import StartupError from "@features/session-workbench/components/StartupError.vue"
import WorkbenchHeader from "@features/session-workbench/components/WorkbenchHeader.vue"
import WorkbenchHero from "@features/session-workbench/components/WorkbenchHero.vue"
import { useComposerDock } from "@features/session-workbench/hooks/use-composer-dock.js"
import { useConversationWidth } from "@features/session-workbench/hooks/use-conversation-width.js"
import { useTurnFinish } from "@features/session-workbench/hooks/use-turn-finish.js"
import TranscriptView from "@features/transcript-view/index.vue"
import { prefetchTranscriptView } from "@features/transcript-view/index.js"
import { useTranscriptHold } from "@features/transcript-view/hooks/use-transcript-hold.js"
import { ArrowDownIcon, DocumentAddIcon, LoaderIcon } from "@components/icons/index.js"

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
  historyHasMore,
  loadingOlder,
  loadOlderHistory,
  turnTimings,
  running,
  phase,
  submitting,
  turnPending,
  sessionPending,
  connectionError,
  connected,
  catalog,
  preset,
  prompt,
  aborting,
  sessionCwd,
  contextUsage,
  creating,
  abortSession,
  sendPrompt,
  sendBackgroundPrompt,
  setBackgroundIdleHandler,
  transcriptFor,
  historyFresh,
} = useSession()
const { groups, lastCwd, addingWorkspace, addWorkspace } = useNav()
/** 与侧栏同一份目录：已授权 local + 会话 cwd。 */
const workspaces = computed(() => groups.value.map((group) => group.canonicalPath))
const pageError = computed(() => {
  if (connectionError.value && connected.value) {
    return { title: t("startup.connectFailed"), detail: connectionError.value.message }
  }

  return route.name === "error" ? {} : null
})
const showHero = computed(() => {
  if (transcript.value.length > 0 || running.value) return false

  if (sessionId.value === undefined) return true

  if (sessionPending.value && !creating.value) return false
  return true
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
  () => !composerCwd.value || preset.value === undefined || Boolean(creating.value),
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
const settleIn = showHero.value

useComposerDock(composerBar, showHero)

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
  if (prev && !showHero.value) {
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
const composerQueue = useComposerQueue()

watch(
  sessionId,
  (id) => {
    composerQueue.setKey(id)
    composerAttachments.setKey(id)
  },
  { immediate: true },
)

/* 会话切换过渡：sessionId 变前把当前 transcript 克隆成静态层盖上，
   新内容渲染后该层淡出。旧画面驻留，不瞬切。 */
const stage = useTemplateRef("stage")
const hold = useTranscriptHold()
let probeRaf = 0

watch(
  sessionId,
  (next, prev) => {
    if (!next || prev === next) return

    /* 缓存命中直接切，不盖旧画面。 */
    if (historyFresh(next)) return
    const vp = stage.value?.querySelector<HTMLElement>(".transcript-viewport")
    /* flush:pre 在 DOM 更新前跑，此刻 .transcript 还是旧内容。 */
    const gen = hold.hold(vp)

    if (!gen) return
    const start = performance.now()
    const MIN_HOLD = 80
    const MAX_HOLD = 600
    const probe = () => {
      if (gen !== hold.epoch()) return
      const rows = stage.value?.querySelectorAll(".transcript .turn").length ?? 0
      const elapsed = performance.now() - start
      const ready = historyFresh(next)
      const incoming = transcriptFor(next).length

      /* 历史已就绪且本来就没有轮次：直接拿掉，不淡出到空屏。 */
      if (ready && incoming === 0) {
        hold.dropNow(gen)
        return
      }

      if (rows > 0 && elapsed >= MIN_HOLD) {
        hold.release(gen)
        return
      }

      /* 超时直接拿掉克隆，交给菊花，不播淡出。 */
      if (elapsed >= MAX_HOLD) {
        hold.dropNow(gen)
        return
      }

      probeRaf = requestAnimationFrame(probe)
    }

    probeRaf = requestAnimationFrame(probe)
  },
  { flush: "pre" },
)

onBeforeUnmount(() => cancelAnimationFrame(probeRaf))

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

const {
  resizing: contentResizing,
  bindColumn,
  snapshotWidth,
  beginResize,
  previewWidth,
  commitWidth,
  endResize,
  nudgeWidth,
} = useConversationWidth()
const columnEl = useTemplateRef("columnEl")

watch(columnEl, (el) => bindColumn(el), { flush: "post" })

const showContentHandles = computed(
  () => Boolean(sessionId.value) && !showHero.value && !sessionPending.value,
)
const contentHandleSides = ["left", "right"] as const
</script>

<style scoped>
.session-panel {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.drop-guide {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: grid;
  place-items: center;
  pointer-events: none;
  opacity: 0;
  transition: opacity var(--duration-fast) var(--ease-smooth);
}

.session-panel.is-drop-active .drop-guide {
  opacity: 1;
}

.drop-guide-label {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-sm) var(--space-md);
  border: var(--border-width) dashed var(--primary);
  border-radius: var(--radius-full);
  background: var(--composer-background);
  color: var(--primary);
  font-size: var(--text-body-md);
  line-height: var(--text-body-md--line-height);
}

.drop-guide-icon {
  width: var(--size-icon);
  height: var(--size-icon);
}

.conversation-column {
  position: relative;
  min-width: 0;
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  /* 测量前占位，挂上后由输入条边框盒覆盖 */
  --composer-reserve: 7rem;
  --size-content: var(--chat-user-width, 680px);
  /* 首屏输入条底边离列底的距离 */
  --hero-dock: 34%;
}

.conversation-column.is-content-resizing {
  cursor: col-resize;
  user-select: none;
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

.composer-bar {
  position: absolute;
  inset-inline: 0;
  bottom: 0;
  z-index: 2;
  padding-bottom: calc(var(--space-sm) + env(safe-area-inset-bottom, 0px));
  pointer-events: none;
}

.composer-bar.is-hero {
  bottom: var(--hero-dock);
}

/* 输入条下方留白缝的蒙层：盖住滚动露出的 transcript；右侧让出滚动条槽位 */
.session-stage::after {
  content: "";
  position: absolute;
  inset-inline-start: 0;
  inset-inline-end: var(--space-sm);
  inset-block-end: 0;
  z-index: 1;
  height: calc(var(--space-sm) + env(safe-area-inset-bottom, 0px) + var(--edge-fade-band));
  pointer-events: none;
  background: linear-gradient(
    to top,
    var(--background) calc(var(--space-sm) + env(safe-area-inset-bottom, 0px)),
    transparent
  );
  backdrop-filter: blur(var(--glass-blur, 16px)) saturate(var(--glass-saturation, 1.08));
  mask-image: linear-gradient(
    to top,
    black calc(var(--space-sm) + env(safe-area-inset-bottom, 0px)),
    transparent
  );
}

.composer-stack {
  position: relative;
  width: 100%;
  max-width: calc(var(--size-content) + var(--space-sm));
  margin-inline: auto;
  background: transparent;
  pointer-events: auto;
}

.session-floating-controls {
  position: absolute;
  inset-block-start: 0;
  inset-inline-end: var(--space-sm);
  z-index: 1;
  display: flex;
  justify-content: flex-end;
  height: 0;
  overflow: visible;
  pointer-events: none;
  opacity: 0;
  transition: opacity var(--duration-fast) var(--ease-out);
}

.session-floating-controls.shown {
  opacity: 1;
}

.session-floating-controls.shown .scroll-latest-control {
  pointer-events: auto;
}

.scroll-latest-control {
  width: var(--size-scroll-control);
  height: var(--size-scroll-control);
  border-radius: var(--radius-full);
  background: var(--popover);
  color: var(--contrast-foreground-secondary);
  box-shadow: none;
  cursor: pointer;
  transform: translateY(calc(-100% - var(--space-sm)));
}

.scroll-latest-control:hover {
  background: var(--interaction-hover);
  color: var(--contrast-foreground);
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
