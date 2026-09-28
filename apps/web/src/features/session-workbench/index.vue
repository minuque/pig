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
        <FilePlus class="drop-guide-icon" />
        松开鼠标添加附件
      </span>
    </div>

    <WorkbenchHeader :cwd="composerCwd" />

    <div
      :ref="bindColumn"
      class="conversation-column"
      :class="{ 'is-content-resizing': contentResizing }"
    >
      <StartupError v-if="pageError" v-bind="pageError" />

      <template v-else>
        <div class="session-stage">
          <Transition name="dock-thread">
            <TranscriptView
              v-if="!showHero"
              ref="transcriptView"
              :session-id="sessionId ?? ''"
              :transcript="transcript"
              :running="turnPending"
              :timings="turnTimings"
              :has-more="historyHasMore"
              :loading-older="loadingOlder"
              @load-older="loadOlderHistory"
            />
          </Transition>

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
                    aria-label="滚动到底部"
                    variant="outline"
                    size="icon-sm"
                    @click="scrollToLatest('smooth')"
                  >
                    <span class="icon-swap">
                      <Ellipsis :data-visible="turnPending" />
                      <ArrowDown :data-visible="!turnPending" />
                    </span>
                  </Button>
                </TooltipTrigger>

                <TooltipContent>滚动到底部</TooltipContent>
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
import { computed, onMounted, ref, shallowRef, useTemplateRef, watch } from "vue"
import { useEventListener, useResizeObserver } from "@vueuse/core"
import { useRoute } from "vue-router"
import { ArrowDown, Ellipsis, FilePlus } from "@lucide/vue"
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

onMounted(() => {
  if (typeof requestIdleCallback === "function") requestIdleCallback(prefetchTranscriptView)
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

const route = useRoute()
const {
  sessionId,
  transcript,
  historyHasMore,
  loadingOlder,
  loadOlderHistory,
  turnTimings,
  running,
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
} = useSession()
const { groups, lastCwd, addingWorkspace, addWorkspace } = useNav()
/** 与侧栏同一份目录：已授权 local + 会话 cwd。 */
const workspaces = computed(() => groups.value.map((group) => group.canonicalPath))
const pageError = computed(() => {
  if (connectionError.value && connected.value) {
    return { title: "连接失败", detail: connectionError.value.message }
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

watch(
  [workspaces, lastCwd],
  ([items, last]) => {
    welcomeWorkspaceId.value = nextWelcomeWorkspaceId(items, welcomeWorkspaceId.value, last)
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

const transcriptView = useTemplateRef<{
  showScrollToLatest: boolean
  scrollToLatest: (behavior?: "auto" | "smooth") => void
}>("transcriptView")
const composerBar = useTemplateRef<HTMLElement>("composerBar")
/** 首屏挂载时输入条随 Hero 一起落位；之后的切换走停靠滑动。 */
const settleIn = showHero.value

useComposerDock(composerBar, showHero)

/** 输入条脱离文档流后，把占位高度写给对话列，转录和空态都靠它留白。 */
function publishComposerReserve(entries: readonly ResizeObserverEntry[]) {
  const bar = composerBar.value
  const column = bar?.closest(".conversation-column")
  const box = entries[0]?.borderBoxSize?.[0]
  const height = box?.blockSize ?? bar?.getBoundingClientRect().height ?? 0

  if (!(column instanceof HTMLElement) || height <= 0) return
  const next = `${Math.ceil(height)}px`

  if (column.style.getPropertyValue("--composer-reserve") === next) return
  column.style.setProperty("--composer-reserve", next)
}

useResizeObserver(composerBar, publishComposerReserve, { box: "border-box" })

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
  void sound.play("send")
  const batch = composerAttachments.consumeForSend()

  void deliverPrompt(text, batch).then((sent) => {
    // 只移走这次发出的附件；发送途中新加的留着，被中止或切走时 chips 也留着
    if (sent && batch) composerAttachments.settle(batch)
  })
}

/** 发送成功才出队：被拒（提交中、中止、切走）时条目留在队列里。 */
function onQueueSendNow(item: QueuedPrompt) {
  void sound.play("send")
  void deliverPrompt(item.text, item.attachments).then((sent) => {
    if (sent) composerQueue.remove(item.id)
  })
}

function onQueue(text: string) {
  void sound.play("send")
  const batch = composerAttachments.consumeForSend()

  composerQueue.enqueue(text, batch)

  // 附件归队列持有：入队同时清掉输入卡暂存，否则同一批文件会再传一次
  if (batch) composerAttachments.settle(batch)
  prompt.value = ""
}

function onAbort() {
  void sound.play("stop")
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
  gap: var(--spacing-xs);
  padding: var(--spacing-sm) var(--spacing-md);
  border: var(--border-width) dashed var(--primary);
  border-radius: var(--radius-full);
  background: var(--composer-bg);
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
  /* 无偏好时正文宽：680 / 列宽 64% / 920 */
  --size-content: var(
    --chat-user-width,
    clamp(680px, calc(var(--conversation-column-width, 0px) * 0.64), 920px)
  );
  --size-composer: calc(var(--size-content) + var(--spacing-md));
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

.session-stage::before {
  pointer-events: none;
  position: absolute;
  /* 让开滚动条列，否则渐隐会压住两端的三角按钮 */
  inset-inline: 0 var(--size-scrollbar);
  top: 0;
  z-index: 1;
  height: var(--spacing-sm);
  background: linear-gradient(to bottom, var(--surface), transparent);
  content: "";
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
  padding-inline: var(--spacing-md);
  padding-bottom: var(--spacing-xl);
}

.composer-bar {
  position: absolute;
  inset-inline: 0;
  bottom: 0;
  z-index: 2;
  padding-bottom: calc(var(--spacing-sm) + env(safe-area-inset-bottom, 0px));
  pointer-events: none;
}

.composer-bar.is-hero {
  bottom: var(--hero-dock);
}

.composer-bar.is-hero::before,
.composer-bar.is-hero::after {
  content: none;
}

/* 让开滚动条列；下半做实色脚，半透区不留残字。挂在上沿，停靠/入场位移时不会裂开 */
.composer-bar::before {
  pointer-events: none;
  position: absolute;
  inset-inline: 0 var(--size-scrollbar);
  bottom: 100%;
  height: calc(var(--spacing-xxl) + var(--spacing-md));
  background: linear-gradient(to bottom, transparent, var(--surface) 50%);
  content: "";
}

/* 悬浮输入条下方的留白条带补底色：滚动中的正文不该从胶囊下沿透出 */
.composer-bar::after {
  content: "";
  position: absolute;
  inset-inline: 0;
  bottom: 0;
  height: calc(var(--spacing-sm) + env(safe-area-inset-bottom, 0px));
  background: var(--surface);
  pointer-events: none;
}

.composer-stack {
  position: relative;
  width: 100%;
  max-width: var(--size-composer);
  margin-inline: auto;
  background: transparent;
  pointer-events: auto;
}

.session-floating-controls {
  position: absolute;
  inset-block-start: 0;
  inset-inline-end: var(--spacing-sm);
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
  color: var(--ink-secondary);
  box-shadow: none;
  cursor: pointer;
  transform: translateY(calc(-100% - var(--spacing-sm)));
}

.scroll-latest-control:hover {
  background: var(--hover-strong);
  color: var(--ink);
  border-width: 2px;
}

@media (max-width: 900px) {
  .composer-bar {
    padding-inline: var(--spacing-sm);
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
