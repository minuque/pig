<template>
  <TranscriptBody
    ref="body"
    :session-id="sessionId"
    :transcript="transcript"
    :running="running"
    :phase="phase"
    :sending="sending"
    :stopping="stopping"
    :timings="timings"
    :jump-target="jumpTarget"
    :history-ready="historyReady"
    @jump-settled="emit('jumpSettled', $event)"
  >
    <slot />
    <template #queue><slot name="queue" /></template>
  </TranscriptBody>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, useTemplateRef } from "vue"
import SessionLoading from "@features/transcript-view/components/SessionLoading.vue"
import type { ReplyJumpTarget } from "@features/transcript-view/index.js"
import type { SessionPhase, TranscriptItem } from "@/types/common-type.js"
import type { TurnTiming } from "@/types/common-type.js"

const TranscriptBody = defineAsyncComponent({
  loader: () => import("@features/transcript-view/components/TranscriptBody.vue"),
  loadingComponent: SessionLoading,
  delay: 120,
})

withDefaults(
  defineProps<{
    sessionId: string
    transcript: readonly TranscriptItem[]
    running: boolean
    phase?: SessionPhase | undefined
    sending?: boolean
    stopping?: boolean
    timings?: readonly TurnTiming[] | undefined
    jumpTarget?: ReplyJumpTarget | null
    historyReady?: boolean
  }>(),
  { jumpTarget: null, historyReady: true },
)

const emit = defineEmits<{
  jumpSettled: [seq: number]
}>()
const body = useTemplateRef("body")
const showScrollToLatest = computed(() => body.value?.showScrollToLatest ?? false)

function scrollToLatest(behavior?: "auto" | "smooth") {
  body.value?.scrollToLatest(behavior)
}

const status = computed(() => body.value?.status)

defineExpose({ showScrollToLatest, scrollToLatest, status })
</script>
