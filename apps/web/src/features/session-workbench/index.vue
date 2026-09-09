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
        <Transition name="stage-layer">
          <div v-if="showHero" key="hero" class="idle-hero">
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
          <TranscriptView
            v-else-if="displaySessionId"
            :key="displaySessionId"
            ref="transcriptView"
            :session-id="displaySessionId"
            :transcript="transcript"
            :running="running"
            :timings="turnTimings"
          />
        </Transition>

        <Transition name="fade-layer">
          <SessionLoading v-if="showLoading" />
        </Transition>
      </div>

      <div class="composer-bar">
        <div ref="inputStack" class="composer-stack">
          <div class="session-floating-controls" :class="{ shown: showScrollToLatest }">
            <Button
              class="scroll-latest-control"
              type="button"
              variant="outline"
              size="icon-sm"
              title="滚动到底部"
              @click="scrollToLatest('smooth')"
            >
              <span class="icon-swap">
                <Ellipsis :data-visible="running" />
                <ArrowDown :data-visible="!running" />
              </span>
            </Button>
          </div>
          <Composer
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
import Composer from "@features/composer/index.vue"
import { useNav } from "@features/session-nav/index.js"
import { useSession } from "@features/session-workbench/index.js"
import ContentWidthHandle from "@features/session-workbench/components/ContentWidthHandle.vue"
import SessionLoading from "@features/session-workbench/components/SessionLoading.vue"
import WorkbenchHeader from "@features/session-workbench/components/WorkbenchHeader.vue"
import WorkbenchHero from "@features/session-workbench/components/WorkbenchHero.vue"
import { useConversationWidth } from "@features/session-workbench/hooks/use-conversation-width.js"
import { PENDING_SESSION_ID } from "@features/session-workbench/lib/session-state.js"
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
const { groups, lastCwd, addingWorkspace, addWorkspace } = useNav()
/** 与侧栏同一份目录：已授权 local + 会话 cwd。 */
const workspaces = computed(() => groups.value.map((group) => group.canonicalPath))

const pageError = computed(() => {
  if (connectionError.value && connected.value) {
    return { title: "连接失败", detail: connectionError.value.message }
  }
  return route.name === "error" ? {} : null
})

const displaySessionId = computed(
  () => sessionId.value ?? (transcript.value.length > 0 ? PENDING_SESSION_ID : undefined),
)
const showHero = computed(() => {
  if (transcript.value.length > 0 || running.value) return false
  if (sessionId.value === undefined) return true
  if (sessionPending.value && !creating.value) return false
  return true
})
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
  scrollToLatest: (behavior?: "auto" | "smooth") => void
}>("transcriptView")
const showScrollToLatest = computed(() => transcriptView.value?.showScrollToLatest ?? false)

function scrollToLatest(behavior: "auto" | "smooth" = "auto") {
  transcriptView.value?.scrollToLatest(behavior)
}

function onSend(text: string) {
  if (sessionId.value) {
    scrollToLatest("auto")
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

function publishOverlayHeight(height: number) {
  const column = columnEl.value
  if (!column) return
  const next = Math.round(height)
  if (column.style.getPropertyValue("--size-composer-overlay") === `${next}px`) return
  column.style.setProperty("--size-composer-overlay", `${next}px`)
}

watch(
  [columnEl, inputStack],
  ([column, stack]) => {
    overlayObserver?.disconnect()
    overlayObserver = undefined
    if (!column || !stack) return
    overlayObserver = new ResizeObserver((entries) => {
      const box = entries[0]?.contentBoxSize?.[0]
      const height = box?.blockSize ?? entries[0]?.contentRect.height
      if (height == null) return
      publishOverlayHeight(height)
    })
    overlayObserver.observe(stack)
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
  --size-composer: calc(var(--size-content) + var(--spacing-md));
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
  display: grid;
  flex: 1;
  place-items: center;
  min-height: 0;
  padding: 0 var(--spacing-md) var(--size-composer-overlay);
}

.composer-bar {
  position: absolute;
  z-index: 2;
  right: 0;
  bottom: 0;
  left: 0;
  pointer-events: none;
}

.composer-stack {
  position: relative;
  width: 100%;
  max-width: var(--size-composer);
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
  cursor: pointer;
  transform: translateY(calc(-100% - var(--spacing-sm)));
}

.scroll-latest-control:hover {
  background: var(--hover-strong);
  color: var(--ink);
  border-width: 2px;
}

.composer-bar :deep(.prompt) {
  pointer-events: auto;
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
}
</style>
