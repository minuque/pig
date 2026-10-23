<template>
  <span ref="root" class="flow">
    <span v-if="leaving !== null" class="flow-slot" data-stage="leave" aria-hidden="true">
      {{ leaving }}
    </span>

    <span class="flow-slot" :data-stage="entering ? 'enter' : undefined">{{ current }}</span>
  </span>
</template>

<script setup lang="ts">
import { onBeforeUnmount, shallowRef, useTemplateRef, watch } from "vue"

/** 旧值留在 DOM 里的时长：--duration-fast 150ms 加一帧余量。 */
const LEAVE_HOLD_MS = 180
const props = defineProps<{ text: string }>()
const reduced =
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
const root = useTemplateRef("root")
const current = shallowRef(props.text)
const leaving = shallowRef<string | null>(null)
const entering = shallowRef(false)
let frame = 0
let timer: ReturnType<typeof setTimeout> | undefined

watch(
  () => props.text,
  (next, previous) => {
    cancelAnimationFrame(frame)
    clearTimeout(timer)

    if (reduced || next === previous) {
      leaving.value = null
      entering.value = false
      current.value = next
      return
    }

    leaving.value = previous
    current.value = next
    entering.value = true
    frame = requestAnimationFrame(() => {
      // 先落定 enter 样式，否则首帧即终态，过渡不启动
      root.value?.getBoundingClientRect()
      entering.value = false
      timer = setTimeout(() => {
        leaving.value = null
      }, LEAVE_HOLD_MS)
    })
  },
  { flush: "sync" },
)

onBeforeUnmount(() => {
  cancelAnimationFrame(frame)
  clearTimeout(timer)
})
</script>

<style scoped>
.flow {
  display: inline-grid;
  align-items: baseline;
  justify-items: start;
  max-width: 100%;
}

.flow-slot {
  grid-column-start: 1;
  grid-row-start: 1;
  min-width: 0;
  max-width: 100%;
  opacity: 1;
  translate: 0 0;
  transition:
    opacity var(--duration-fast) var(--ease-icon),
    translate var(--duration-fast) var(--ease-icon);
}

.flow-slot[data-stage="enter"] {
  opacity: 0;
  translate: 0 3px;
}

.flow-slot[data-stage="leave"] {
  opacity: 0;
  translate: 0 -3px;
}

@media (prefers-reduced-motion: reduce) {
  .flow-slot {
    transition: none;
  }
}
</style>
