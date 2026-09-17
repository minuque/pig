<template>
  <WorkbenchHeader />

  <div
    :ref="bindColumn"
    class="conversation-column"
    :class="{ 'is-content-resizing': contentResizing }"
  >
    <StartupError v-if="pageError" v-bind="pageError" />

    <template v-else>
      <div class="session-stage">
        <KeepAlive :max="SESSION_VIEW_CACHE">
          <TranscriptView
            v-if="sessionId && !showHero"
            :key="sessionId"
            ref="transcriptView"
            :session-id="sessionId ?? ''"
            :transcript="transcript"
            :running="running"
            :timings="turnTimings"
            :has-more="historyHasMore"
            :loading-older="loadingOlder"
            @load-older="loadOlderHistory"
          />
        </KeepAlive>

        <Transition name="stage-layer">
          <div v-if="showHero" key="hero" class="idle-hero">
            <WorkbenchHero
              v-model:workspace-id="heroWorkspaceId"
              title-id="workbench-hero-title"
              class="stagger-in"
              :workspaces="workspaces"
              :selectable="sessionId === undefined"
              :adding="addingWorkspace"
              :ready="connected"
              @add="addWorkspace()"
            />
          </div>
        </Transition>
      </div>

      <div class="composer-bar">
        <div class="composer-stack">
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
            :cwd="composerCwd"
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
import { computed, defineAsyncComponent, onMounted, shallowRef, useTemplateRef, watch } from "vue"
import { useRoute } from "vue-router"
import { ArrowDown, Ellipsis } from "@lucide/vue"
import { Button } from "@components/ui/button/index.js"
import Composer from "@features/composer/index.vue"
import { useNav } from "@features/session-nav/index.js"
import { useSession } from "@features/session-workbench/index.js"
import ContentWidthHandle from "@features/session-workbench/components/ContentWidthHandle.vue"
import StartupError from "@features/session-workbench/components/StartupError.vue"
import WorkbenchHeader from "@features/session-workbench/components/WorkbenchHeader.vue"
import WorkbenchHero from "@features/session-workbench/components/WorkbenchHero.vue"
import { SESSION_VIEW_CACHE } from "@features/session-workbench/lib/session-history-cache.js"
import { useConversationWidth } from "@features/session-workbench/hooks/use-conversation-width.js"
import SessionLoading from "@features/transcript-view/components/SessionLoading.vue"

const TranscriptView = defineAsyncComponent({
  loader: () => import("@features/transcript-view/index.vue"),
  loadingComponent: SessionLoading,
  delay: 120,
})

onMounted(() => {
  const prefetch = () => {
    void import("@features/transcript-view/index.vue")
  }

  if (typeof requestIdleCallback === "function") requestIdleCallback(prefetch)
  else setTimeout(prefetch, 1)
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

const transcriptView = useTemplateRef<{
  showScrollToLatest: boolean
  scrollToLatest: (behavior?: "auto" | "smooth") => void
}>("transcriptView")

const showScrollToLatest = computed(() => transcriptView.value?.showScrollToLatest ?? false)

function scrollToLatest(behavior: "auto" | "smooth" = "auto") {
  transcriptView.value?.scrollToLatest(behavior)
}

function onSend(text: string) {
  if (sessionId.value) scrollToLatest("auto")
  else if (!welcomeWorkspaceId.value) return
  void sendPrompt(text, sessionId.value ? undefined : welcomeWorkspaceId.value)
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
  padding-inline: var(--spacing-md);
}

.composer-bar {
  position: relative;
  z-index: 2;
  flex-shrink: 0;
}

.composer-stack {
  position: relative;
  width: 100%;
  max-width: var(--size-composer);
  margin-inline: auto;
  background: var(--surface);
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
