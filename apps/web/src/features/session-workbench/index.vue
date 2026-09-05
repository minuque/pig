<template>
  <WorkbenchHeader />
  <div
    :ref="bindWorkbenchColumn"
    class="conversation-column"
    :class="{ 'is-content-resizing': contentResizing }"
  >
    <StartupError v-if="pageError" v-bind="pageError" />

    <template v-else>
      <div class="session-stage">
        <Transition name="fade-layer">
          <div v-if="showHero" class="idle-hero">
            <WorkbenchHero
              v-model:workspace-id="heroWorkspaceId"
              title-id="workbench-hero-title"
              class="stagger-in"
              :workspaces="workspaces"
              :selectable="sessionId === undefined"
              :adding="addingWorkspace"
              @add="addWorkspace()"
            />
          </div>
        </Transition>

        <Transition name="fade-layer">
          <SessionLoading v-if="showLoading" />
        </Transition>

        <TranscriptView
          v-if="sessionId"
          ref="transcriptView"
          :session-id="sessionId"
          :transcript="transcript"
          :running="running"
          :timings="turnTimings"
        />
      </div>

      <div class="chat-input-bar">
        <div ref="inputStack" class="chat-input-stack">
          <div class="session-floating-controls" :class="{ shown: showScrollToLatest }">
            <Button
              class="scroll-latest-control"
              type="button"
              variant="outline"
              size="icon-sm"
              title="滚动到底部"
              @click="scrollToLatest"
            >
              <span class="icon-swap">
                <Ellipsis :data-visible="running" />
                <ArrowDown :data-visible="!running" />
              </span>
            </Button>
          </div>
          <ChatInput
            v-model:prompt="prompt"
            v-model:preset="preset"
            :catalog="catalog"
            :running="running"
            :aborting="aborting"
            :error="sessionError"
            :cwd="sessionId ? sessionCwd : undefined"
            :usage="sessionId ? contextUsage : undefined"
            :session-id="sessionId"
            :send-disabled="sendDisabled"
            placeholder="do what you want ..."
            @send="onSend"
            @abort="abortSession"
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
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, shallowRef, useTemplateRef, watch } from "vue"
import { useRoute } from "vue-router"
import { ArrowDown, Ellipsis } from "@lucide/vue"
import { Button } from "@components/ui/button/index.js"
import ChatInput from "@features/chat-input/index.vue"
import { useNav } from "@features/session-nav/index.js"
import { useSession } from "@features/session-workbench/index.js"
import ContentWidthHandle from "@features/session-workbench/components/ContentWidthHandle.vue"
import SessionLoading from "@features/session-workbench/components/SessionLoading.vue"
import WorkbenchHeader from "@features/session-workbench/components/WorkbenchHeader.vue"
import WorkbenchHero from "@features/session-workbench/components/WorkbenchHero.vue"
import { useConversationWidth } from "@features/session-workbench/hooks/use-conversation-width.js"
import StartupError from "@features/startup/components/StartupError.vue"
import TranscriptView from "@features/transcript-view/index.vue"

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
  turnTimings,
  running,
  sessionPending,
  connectionError,
  connected,
  catalog,
  preset,
  prompt,
  aborting,
  sessionError,
  sessionCwd,
  contextUsage,
  creating,
  abortSession,
  submitText,
  createAndSubmit,
} = useSession()
const { workspaces, lastCwd, addingWorkspace, addWorkspace } = useNav()

const pageError = computed(() => {
  if (connectionError.value && connected.value) {
    return { title: "连接失败", detail: connectionError.value.message }
  }
  return route.name === "error" ? {} : null
})
const showHero = computed(() => transcript.value.length === 0 && !running.value)
const showLoading = computed(
  () =>
    Boolean(sessionId.value) &&
    sessionPending.value &&
    transcript.value.length === 0 &&
    !creating.value,
)
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

const transcriptView = useTemplateRef<{
  showScrollToLatest: boolean
  scrollToLatest: () => void
}>("transcriptView")
const showScrollToLatest = computed(() => transcriptView.value?.showScrollToLatest ?? false)
function scrollToLatest() {
  transcriptView.value?.scrollToLatest()
}

function onSend(text: string) {
  if (sessionId.value) {
    scrollToLatest()
    void submitText(text)
    return
  }
  const cwd = welcomeWorkspaceId.value
  if (!cwd) return
  void createAndSubmit(cwd, text)
}

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
const columnEl = shallowRef<HTMLElement | null>(null)
const inputStack = useTemplateRef<HTMLElement>("inputStack")
let overlayObserver: ResizeObserver | undefined

function bindWorkbenchColumn(el: unknown) {
  columnEl.value = el instanceof HTMLElement ? el : null
  bindColumn(el)
}

function publishOverlayHeight() {
  const column = columnEl.value
  const stack = inputStack.value
  if (!column || !stack) return
  column.style.setProperty("--size-chat-input-overlay", `${stack.offsetHeight}px`)
}

watch(
  [columnEl, inputStack],
  ([column, stack]) => {
    overlayObserver?.disconnect()
    overlayObserver = undefined
    if (!column || !stack) return
    overlayObserver = new ResizeObserver(publishOverlayHeight)
    overlayObserver.observe(stack)
    publishOverlayHeight()
  },
  { flush: "post" },
)
onBeforeUnmount(() => overlayObserver?.disconnect())

const showContentHandles = computed(
  () => Boolean(sessionId.value) && !showHero.value && !sessionPending.value,
)
const contentHandleSides = ["left", "right"] as const
</script>

<style scoped>
.conversation-column {
  position: relative;
  min-width: 0;
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  /* 无偏好时正文宽：680 / 列宽 64% / 920 */
  --size-content: var(
    --chat-user-width,
    clamp(680px, calc(var(--conversation-column-width, 0px) * 0.64), 920px)
  );
  --size-chat-input: calc(var(--size-content) + var(--spacing-md));
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
.idle-hero {
  position: absolute;
  z-index: 1;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 0 var(--spacing-md) var(--size-chat-input-overlay);
}
.chat-input-bar {
  position: absolute;
  z-index: 2;
  right: 0;
  bottom: 0;
  left: 0;
  pointer-events: none;
}
.chat-input-stack {
  position: relative;
  width: 100%;
  max-width: var(--size-chat-input);
  margin-inline: auto;
}
.session-floating-controls {
  position: absolute;
  top: 0;
  right: var(--spacing-sm);
  z-index: 11;
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
  background: var(--code-body);
  color: var(--ink-secondary);
  box-shadow: none;
  transform: translateY(calc(-100% - var(--spacing-sm)));
}
.chat-input-bar :deep(.prompt) {
  pointer-events: auto;
}
@media (max-width: 900px) {
  .chat-input-bar {
    padding-inline: var(--spacing-sm);
  }
}
@media (prefers-reduced-motion: reduce) {
  .session-floating-controls {
    transition: none;
  }
}
</style>
