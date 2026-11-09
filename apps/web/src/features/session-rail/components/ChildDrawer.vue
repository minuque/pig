<template>
  <Dialog :open="Boolean(child)" @update:open="(open) => !open && emit('close')">
    <DialogContent v-if="child" class="child-drawer" :aria-describedby="undefined">
      <DialogTitle class="child-drawer-title">
        <span>{{ child.agent }}</span>
        <span class="child-drawer-tag">{{ t("rail.readOnly") }}</span>
      </DialogTitle>

      <div class="child-drawer-body">
        <TranscriptView
          :session-id="child.sessionId"
          :transcript="items"
          :running="false"
          :timings="timings"
        />
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { shallowRef, watch } from "vue"
import { useI18n } from "@i18n/index.js"
import { sessionTranscript } from "@client/platform.js"
import { Dialog, DialogContent, DialogTitle } from "@components/ui/dialog/index.js"
import TranscriptView from "@features/transcript-view/index.vue"
import type { OpenChild } from "@features/session-rail/index.js"
import type { TranscriptItem } from "@/types/common-type.js"
import type { TurnTiming } from "@/types/turn-type.js"

const props = defineProps<{
  child: OpenChild | undefined
  /** 子任务进展的指纹（状态 + 最近一步）；变了就重读子会话。 */
  progress: string
}>()
const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()
const items = shallowRef<readonly TranscriptItem[]>([])
const timings = shallowRef<readonly TurnTiming[]>([])

watch(
  () => [props.child?.sessionId, props.progress] as const,
  async ([sessionId]) => {
    if (!sessionId) {
      items.value = []
      return
    }

    // 子会话第一条助手消息之前还没落盘：先空着，下次进展时再读
    const page = await sessionTranscript(sessionId).catch(() => undefined)

    if (page && props.child?.sessionId === sessionId) {
      items.value = page.items
      timings.value = page.timings
    }
  },
  { immediate: true },
)
</script>

<style>
/* 内容经 Portal 挂到 body，scoped 打不中，选择器统一挂在 .child-drawer 前缀下。 */
.child-drawer.rt-DialogContent {
  position: fixed;
  inset-block: 0;
  inset-inline-end: 0;
  display: flex;
  flex-direction: column;
  inline-size: min(88vw, var(--size-child-drawer));
  max-inline-size: none;
  block-size: 100dvh;
  max-block-size: none;
  margin: 0;
  padding: 0;
  border-radius: 0;
}

.child-drawer-title {
  display: flex;
  align-items: baseline;
  gap: var(--space-xs);
  margin: 0;
  padding: var(--space-md) var(--space-lg) var(--space-sm);
  border-block-end: 1px solid var(--border-soft);
}

.child-drawer-tag {
  font-size: var(--text-meta);
  font-weight: 400;
  color: var(--contrast-foreground-faint);
}

.child-drawer-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-block-size: 0;
}
</style>
