<template>
  <WorkbenchHeader />
  <div
    :ref="bindColumn"
    class="conversation-column"
    :class="{ 'is-content-resizing': contentResizing }"
  >
    <StartupError v-if="pageError" v-bind="pageError" />

    <!-- 1. 无 session -->
    <SessionWelcome v-else-if="!sessionId" />

    <div v-else class="session-stage">
      <SessionLoading v-if="sessionPending" />

      <!-- 2. 空会话 -->
      <SessionEmptyCanvas v-if="emptyCanvas" />

      <!-- 3. 有 transcript：对话列 -->
      <template v-else-if="!sessionPending">
        <TranscriptView
          :session-id="sessionId"
          :transcript="transcript"
          :running="running"
          :thread-state="threadState"
          @thread-state="applyThreadState"
        />
      </template>
    </div>

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

<script lang="ts">
/** 无 transcript 且未运行：居中空画布。加载中、运行中即使无行也不走空画布。 */
export function isEmptyCanvas(
  transcriptLength: number,
  running: boolean,
  pending = false,
): boolean {
  if (pending) return false
  return transcriptLength === 0 && !running
}
</script>

<script setup lang="ts">
import { computed } from "vue"
import { useRoute } from "vue-router"
import { useSession } from "@features/session-workbench/index.js"
import ContentWidthHandle from "@features/session-workbench/components/ContentWidthHandle.vue"
import SessionEmptyCanvas from "@features/session-workbench/components/SessionEmptyCanvas.vue"
import SessionLoading from "@features/session-workbench/components/SessionLoading.vue"
import SessionWelcome from "@features/session-workbench/components/SessionWelcome.vue"
import { useConversationWidth } from "@features/session-workbench/hooks/use-conversation-width.js"
import TranscriptView from "@features/transcript-view/index.vue"
import WorkbenchHeader from "@features/session-workbench/components/WorkbenchHeader.vue"
import StartupError from "@features/startup/components/StartupError.vue"

const route = useRoute()
const {
  sessionId,
  transcript,
  running,
  sessionPending,
  clientState,
  applyThreadState,
  connectionError,
  connected,
} = useSession()

const pageError = computed(() => {
  if (connectionError.value && connected.value) {
    return { title: "连接失败", detail: connectionError.value.message }
  }
  return route.name === "error" ? {} : null
})
const emptyCanvas = computed(() =>
  isEmptyCanvas(transcript.value.length, running.value, sessionPending.value),
)
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
  () => Boolean(sessionId.value) && !emptyCanvas.value && !sessionPending.value,
)
const contentHandleSides = ["left", "right"] as const
const threadState = computed(() => clientState.value?.threadState ?? null)
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
  --size-chat-input: calc(var(--size-content) + 16px);
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
</style>
