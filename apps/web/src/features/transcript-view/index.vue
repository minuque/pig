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
  />
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, useTemplateRef } from "vue"
import SessionLoading from "@features/transcript-view/components/SessionLoading.vue"
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
  }>(),
  {},
)

const body = useTemplateRef("body")
const showScrollToLatest = computed(() => body.value?.showScrollToLatest ?? false)

function scrollToLatest(behavior?: "auto" | "smooth") {
  body.value?.scrollToLatest(behavior)
}

defineExpose({ showScrollToLatest, scrollToLatest })
</script>
