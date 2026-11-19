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
                  variant="solid"
                  color="gray"
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
              @send="sendNow"
              @send-now="sendQueued"
              @queue="enqueue"
              @abort="onAbort"
            />
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef, watch } from "vue"
import { useResizeObserver } from "@vueuse/core"
import { useRoute } from "vue-router"
import { Button } from "@components/ui/button/index.js"
import Composer from "@features/composer/index.vue"
import { useComposerPreset } from "@features/composer/index.js"
import { useComposerAttachments } from "@features/composer/hooks/use-composer-attachments.js"
import { useComposerQueue } from "@features/composer/hooks/use-composer-queue.js"
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
import { useComposerReserve } from "@features/session-workbench/hooks/use-composer-reserve.js"
import { useComposerSubmit } from "@features/session-workbench/hooks/use-composer-submit.js"
import { useFileDrop } from "@features/session-workbench/hooks/use-file-drop.js"
import { useSessionDrop } from "@features/session-workbench/hooks/use-session-drop.js"
import { useTurnFinish } from "@features/session-workbench/hooks/use-turn-finish.js"
import { useWelcomeWorkspace } from "@features/session-workbench/hooks/use-welcome-workspace.js"
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
  setWelcomeHandoff,
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

const { welcomeWorkspaceId, heroWorkspaceId, composerCwd } = useWelcomeWorkspace({
  sessionId: () => sessionId.value,
  sessionCwd: () => sessionCwd.value,
  workspaces: () => workspaces.value,
  lastCwd: () => lastCwd.value,
  connected: () => connected.value,
})
const sendDisabled = computed(
  () =>
    !composerCwd.value ||
    preset.value === undefined ||
    Boolean(creating.value) ||
    externalTurn.value,
)

type TranscriptViewRef = InstanceType<typeof TranscriptView>

const transcriptView = useTemplateRef<TranscriptViewRef>("transcriptView")
const composerBar = useTemplateRef("composerBar")
/** 首屏挂载时输入条随 Hero 一起落位；之后的切换走停靠滑动。 */
const settleIn = welcome.value

useComposerDock(composerBar, welcome)

useComposerReserve(composerBar, () => welcome.value)

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

const { deliver, sendNow, sendQueued, enqueue } = useComposerSubmit({
  sessionId: () => sessionId.value,
  welcomeCwd: () => welcomeWorkspaceId.value,
  prompt,
  queue: composerQueue,
  attachments: composerAttachments,
  scrollToLatest: () => scrollToLatest("auto"),
  submit: sendPrompt,
})
const { markAborted } = useTurnFinish({
  sessionId: () => sessionId.value,
  running: () => running.value,
  pending: () => turnPending.value,
  transcript: () => transcript.value,
  queue: composerQueue,
  sound,
  sendForeground: deliver,
})

setWelcomeHandoff((id) => {
  composerQueue.handOff(id)
  composerAttachments.handOff(id)
})

function onAbort() {
  markAborted()
  void abortSession()
}

const { dropActive, onDragEnter, onDragOver, onDragLeave, onDrop } = useFileDrop(
  composerAttachments.addDropped,
)
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
  border: var(--border-width) dashed var(--accent-solid);
  border-radius: var(--radius-pill);
  background: var(--bg-surface);
  color: var(--accent-text);
  font-size: var(--text-body);
  line-height: var(--text-body--line-height);
}

.drop-guide-icon {
  width: var(--icon-md);
  height: var(--icon-md);
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
  inset-inline-end: var(--rail-width);
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
  max-width: min(calc(var(--content-width) + var(--space-sm)), calc(100% - 2 * var(--space-md)));
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
  translate: 0 var(--space-2xs);
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

/* 反色胶囊浮在输入卡上方，与发送键同一组反色 */
.scroll-latest {
  display: flex;
  align-self: flex-start;
  translate: 0 calc(-100% - var(--space-sm));
}

.scroll-latest-button {
  background-color: var(--bg-inverse);
  color: var(--fg-inverse);
}

.scroll-latest-button:hover {
  background-color: var(--bg-inverse-hover);
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
