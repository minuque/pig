<template>
  <div class="rail-child">
    <TranscriptView
      :session-id="child.sessionId"
      :transcript="items"
      :running="false"
      :timings="timings"
    />
  </div>
</template>

<script setup lang="ts">
import { shallowRef, watch } from "vue"
import { sessionTranscript } from "@client/platform.js"
import TranscriptView from "@features/transcript-view/index.vue"
import type { OpenChild } from "@features/session-rail/index.js"
import type { TranscriptItem, TurnTiming } from "@/types/common-type.js"

const props = defineProps<{
  child: OpenChild
  /** 子任务进展的指纹（状态 + 最近一步）；变了就重读子会话。 */
  progress: string
}>()
const items = shallowRef<readonly TranscriptItem[]>([])
const timings = shallowRef<readonly TurnTiming[]>([])

watch(
  () => [props.child.sessionId, props.progress] as const,
  async ([sessionId]) => {
    // 子会话第一条助手消息之前还没落盘：先空着，下次进展时再读
    const page = await sessionTranscript(sessionId).catch(() => undefined)

    if (page && props.child.sessionId === sessionId) {
      items.value = page.items
      timings.value = page.timings
    }
  },
  { immediate: true },
)
</script>

<style scoped>
.rail-child {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-block-size: 0;
}
</style>
