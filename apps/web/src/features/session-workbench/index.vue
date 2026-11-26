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

    <div class="conversation-column">
      <StartupError v-if="pageError" v-bind="pageError" />

      <template v-else>
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
            :stopping="aborting || stopPhase === 'pending'"
            :timings="turnTimings"
            :jump-target="pendingJump"
            :history-ready="!sessionPending"
            @jump-settled="onJumpSettled"
          >
            <SessionRail />

            <template #queue>
              <QueuedPanel
                :queue="composerQueue"
                :editing-id="editingQueueId"
                @edit="beginQueueEdit"
                @send-now="sendQueued"
                @remove="removeQueued"
              />
            </template>
          </TranscriptView>
        </div>

        <div
          ref="composerBar"
          class="composer-bar"
          :class="{ 'is-hero': welcome, 'settle-in': settleIn, 'beside-rail': railDocked }"
        >
          <div class="composer-stack">
            <ScrollLatestButton
              :shown="showScrollToLatest"
              :pending="turnPending"
              @click="scrollToLatest('smooth')"
            />

            <ExternalTurnNotice />

            <QuestionBoard :prompt="prompt" :active="!welcome && host.view.value === 'chat'" />

            <Composer
              ref="composer"
              v-model:prompt="prompt"
              v-model:preset="preset"
              :catalog="catalog"
              :attachments="composerAttachments"
              :running="turnPending"
              :switch-locked="switchLocked"
              :editing-queue="editingQueueId !== null"
              :stop-phase="stopPhase"
              :session-id="sessionId"
              :cwd="composerCwd"
              :usage="welcome ? undefined : contextUsage"
              :reload-revision="reloadRevision"
              :send-disabled="sendDisabled"
              :answer="questionBoard.composer.value"
              :class="{ 'is-answering': Boolean(questionBoard.board.value) }"
              @send="questionBoard.board.value ? questionBoard.submit() : sendNow($event)"
              @steer="steer"
              @queue="enqueue"
              @save-edit="commitQueueEdit"
              @cancel-queue-edit="cancelQueueEdit"
              @history-prev="historyPrev"
              @history-next="historyNext"
              @open-file="filePane.openFile($event)"
              @jump-reply="jumpToReply"
              @abort="abort"
            >
              <template v-if="transcriptStatus && !questionBoard.board.value" #plate>
                <TranscriptStatus v-bind="transcriptStatus" :activity="snapshot?.activity" />
              </template>
            </Composer>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, useTemplateRef, watch } from "vue"
import { useResizeObserver } from "@vueuse/core"
import { useRoute } from "vue-router"
import Composer from "@features/composer/index.vue"
import { useComposerPreset } from "@features/composer/index.js"
import { useComposerAttachments } from "@features/composer/hooks/use-composer-attachments.js"
import { useComposerDraft } from "@features/composer/hooks/use-composer-draft.js"
import { useComposerQueue } from "@features/composer/hooks/use-composer-queue.js"
import { useFilePane } from "@features/file-pane/index.js"
import QueuedPanel from "@features/session-workbench/components/QueuedPanel.vue"
import ScrollLatestButton from "@features/session-workbench/components/ScrollLatestButton.vue"
import { useSound } from "@features/click-sound/index.js"
import { useI18n } from "@i18n/index.js"
import { sessionDropTargetAttrs, useNav } from "@features/session-nav/index.js"
import { useSession } from "@features/session/index.js"
import QuestionBoard from "@features/extension-ui/components/QuestionBoard.vue"
import { useQuestionBoard } from "@features/extension-ui/hooks/use-question-board.js"
import ExternalTurnNotice from "@features/session-workbench/components/ExternalTurnNotice.vue"
import StartupError from "@features/session-workbench/components/StartupError.vue"
import WorkbenchHero from "@features/session-workbench/components/WorkbenchHero.vue"
import { useComposerDock } from "@features/session-workbench/hooks/use-composer-dock.js"
import { useComposerReserve } from "@features/session-workbench/hooks/use-composer-reserve.js"
import { useComposerSubmit } from "@features/session-workbench/hooks/use-composer-submit.js"
import { useFileDrop } from "@features/session-workbench/hooks/use-file-drop.js"
import { useReplyNavigation } from "@features/session-workbench/hooks/use-reply-navigation.js"
import { useSessionDrop } from "@features/session-workbench/hooks/use-session-drop.js"
import { useTurnFinish } from "@features/session-workbench/hooks/use-turn-finish.js"
import { useWelcomeWorkspace } from "@features/session-workbench/hooks/use-welcome-workspace.js"
import TranscriptView from "@features/transcript-view/index.vue"
import SessionRail from "@features/session-rail/index.vue"
import { useSessionRail } from "@features/session-rail/index.js"
import { prefetchTranscriptView, TranscriptStatus } from "@features/transcript-view/index.js"
import { FilePlusIcon } from "@components/icons/index.js"
import { notify } from "@pig/ui/toast"
import { usePanelHost, type PaneAlert } from "@features/panel-host/index.js"

onMounted(() => {
  if (typeof requestIdleCallback === "function")
    requestIdleCallback(prefetchTranscriptView, { timeout: 2000 })
  else setTimeout(prefetchTranscriptView, 1)
})

const { t } = useI18n()
const route = useRoute()
const host = usePanelHost()
const questionBoard = useQuestionBoard()
const {
  sessionId,
  transcript,
  turnTimings,
  running,
  phase,
  submitting,
  turnPending,
  sessionPending,
  connectionError,
  connected,
  prompt,
  aborting,
  steer: sessionSteer,
  sessionCwd,
  creating,
  abortSession,
  sendPrompt,
  setWelcomeHandoff,
  contextUsage,
  welcome,
  externalTurn,
  snapshot,
  reloadRevision,
} = useSession()
const { catalog, preset, switchLocked } = useComposerPreset()
const { groups, lastCwd, addingWorkspace, addWorkspace } = useNav()
const workspaces = computed(() => groups.value.map((group) => group.canonicalPath))
const pageError = computed(() => {
  if (connectionError.value && connected.value) {
    return { title: t("startup.connectFailed"), detail: connectionError.value.message }
  }

  return route.name === "error" ? {} : null
})
const rail = useSessionRail()
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
const settleIn = welcome.value

useComposerDock(composerBar, welcome)

useComposerReserve(composerBar, () => welcome.value)

const showScrollToLatest = computed(() => transcriptView.value?.showScrollToLatest ?? false)
const transcriptStatus = computed(() => (welcome.value ? undefined : transcriptView.value?.status))

function scrollToLatest(behavior: "auto" | "smooth" = "auto") {
  transcriptView.value?.scrollToLatest(behavior)
}

const sound = useSound()
const composerAttachments = useComposerAttachments()
const composerDraft = useComposerDraft(prompt)
const filePane = useFilePane()
const composer = useTemplateRef("composer")
const { pendingJump, jumpToReply, onJumpSettled } = useReplyNavigation({
  sessionId,
  onQuote: (request) => composer.value?.insertReply(request),
})

useSessionDrop(panel, (markdown) => composer.value?.insertMarkdown(markdown))

watch(filePane.mention, (request) => {
  if (request) composer.value?.insertMarkdown(request.markdown)
})

const composerQueue = useComposerQueue()

watch(
  sessionId,
  (id) => {
    composerQueue.setKey(id)
    composerAttachments.setKey(id)
    composerDraft.setKey(id)
  },
  { immediate: true },
)

const {
  deliver,
  sendNow,
  sendQueued,
  enqueue,
  steer,
  abort,
  stopPhase,
  editingQueueId,
  beginQueueEdit,
  commitQueueEdit,
  cancelQueueEdit,
  removeQueued,
  historyPrev,
  historyNext,
} = useComposerSubmit({
  sessionId: () => sessionId.value,
  welcomeCwd: () => welcomeWorkspaceId.value,
  running: () => turnPending.value,
  prompt,
  draft: composerDraft,
  queue: composerQueue,
  attachments: composerAttachments,
  scrollToLatest: () => scrollToLatest("auto"),
  submit: sendPrompt,
  steer: sessionSteer,
  abort: onAbort,
})
const { markAborted } = useTurnFinish({
  sessionId: () => sessionId.value,
  running: () => running.value,
  pending: () => turnPending.value,
  transcript: () => transcript.value,
  queue: composerQueue,
  sound,
  sendForeground: deliver,
  announce,
})

function announce(kind: "done" | "error", message?: string) {
  const id = sessionId.value

  if (!id) return

  const alert: PaneAlert =
    kind === "done"
      ? { kind, tone: "success", title: t("views.turnDone") }
      : { kind, tone: "error", title: t("session.turnFailed"), body: message }

  if (host.alerts.route(id, alert) === "toast")
    notify(message || alert.title, "error", { transient: true })
}

setWelcomeHandoff((id) => {
  composerQueue.handOff(id)
  composerAttachments.handOff(id)
  composerDraft.handOff(id)
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
  z-index: var(--z-overlay);
  display: grid;
  place-items: center;
  pointer-events: none;
  opacity: 0;
  transition: opacity var(--duration-fast) var(--ease-out);
}

.session-panel.is-drop-active .drop-guide {
  opacity: 1;
}

.drop-guide-label {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-sm) var(--space-md);
  border: var(--border-width) dashed var(--accent-solid);
  border-radius: var(--radius-pill);
  corner-shape: round;
  background: var(--bg-surface);
  color: var(--accent-text);
  font-size: var(--text-body);
  line-height: var(--text-body--line-height);
}

.drop-guide-icon {
  width: var(--icon-md);
  height: var(--icon-md);
}

.conversation-column {
  grid-area: conversation;
  position: relative;
  min-width: 0;
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
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
  z-index: var(--z-sticky);
}

.idle-hero {
  position: absolute;
  inset: 0 0 calc(55% + var(--composer-reserve) / 2 - 2rem);
  display: grid;
  place-items: end center;
  padding-inline: var(--space-md);
  padding-bottom: var(--space-xl);
}

.composer-bar {
  position: absolute;
  inset-inline: 0;
  bottom: 0;
  z-index: var(--z-sticky);
  padding-bottom: calc(var(--space-sm) + env(safe-area-inset-bottom, 0px));
  pointer-events: none;
}

.composer-bar.beside-rail {
  inset-inline-end: var(--rail-width);
}

.composer-bar.is-hero {
  bottom: calc(55% - var(--composer-reserve) / 2 - 2rem);
}

.session-stage :deep(.transcript-viewport) {
  mask-image:
    linear-gradient(
      to top,
      transparent calc(var(--space-sm) + env(safe-area-inset-bottom, 0px)),
      black calc(var(--space-sm) + env(safe-area-inset-bottom, 0px) + var(--edge-fade-band))
    ),
    linear-gradient(to right, transparent calc(100% - var(--space-sm)), black 0);
}

.composer-stack :deep(.prompt.is-answering) {
  border-radius: var(--radius-card);
  box-shadow: 0 0 0 var(--border-width) var(--accent-solid);
}

.composer-stack {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: min(calc(var(--content-width) + var(--space-sm)), calc(100% - 2 * var(--space-md)));
  max-block-size: calc(100dvh - var(--header-height) - 2 * var(--space-sm));
  margin-inline: auto;
  background: transparent;
  pointer-events: auto;
}

@media (max-width: 900px) {
  .composer-bar {
    padding-inline: var(--space-sm);
  }
}

@media (prefers-reduced-motion: reduce) {
  .drop-guide {
    transition: none;
  }
}
</style>
