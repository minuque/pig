<template>
  <TranscriptBody
    ref="body"
    :session-id="sessionId"
    :transcript="transcript"
    :running="running"
    :timings="timings"
    :has-more="hasMore"
    :loading-older="loadingOlder"
    @load-older="emit('loadOlder')"
  />
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, useTemplateRef } from "vue"
import SessionLoading from "@features/transcript-view/components/SessionLoading.vue"
import type { TranscriptItem } from "@/types/common-type.js"
import type { TurnTiming } from "@/types/turn-type.js"

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
    timings?: readonly TurnTiming[] | undefined
    hasMore?: boolean
    loadingOlder?: boolean
  }>(),
  { hasMore: false, loadingOlder: false },
)

const emit = defineEmits<{
  loadOlder: []
}>()
const body = useTemplateRef<{
  showScrollToLatest: boolean
  scrollToLatest: (behavior?: "auto" | "smooth") => void
}>("body")
const showScrollToLatest = computed(() => body.value?.showScrollToLatest ?? false)

function scrollToLatest(behavior?: "auto" | "smooth") {
  body.value?.scrollToLatest(behavior)
}

defineExpose({ showScrollToLatest, scrollToLatest })
</script>
