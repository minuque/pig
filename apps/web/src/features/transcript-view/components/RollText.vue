<template>
  <span ref="stack" class="roll-text" :class="{ 'is-gliding': gliding }">
    <TransitionGroup name="label-roll" tag="span" class="roll-text-slots">
      <span
        v-for="slot in slots"
        :key="slot.id"
        :data-slot="slot.id"
        class="roll-text-slot"
        :class="{ shimmer: slot.live }"
        :data-text="slot.live ? slot.text : undefined"
      >
        {{ slot.text }}
      </span>
    </TransitionGroup>
  </span>
</template>

<script setup lang="ts">
import { nextTick, ref, shallowRef, useTemplateRef, watch } from "vue"

const ROLL_MS = 180
const props = defineProps<{
  text: string
  /** 运行中的文字用 shimmer，跟随换字一起过渡 */
  live?: boolean
}>()

type Slot = { id: number; text: string; live: boolean }

let slotId = 0
const slots = shallowRef<Slot[]>([{ id: slotId, text: props.text, live: Boolean(props.live) }])
const stack = useTemplateRef<HTMLElement>("stack")
const gliding = ref(false)
let glide: Animation | null = null

/** 换字时宽度从旧值滑到新值，避免尾部元素跟着瞬间跳位；对齐 cc-wrapper 的 MorphSlots。 */
watch([() => props.text, () => Boolean(props.live)], async ([text, live]) => {
  const node = stack.value
  const from = node?.getBoundingClientRect().width ?? 0
  const slot = { id: ++slotId, text, live }
  slots.value = [slot]
  glide?.cancel()
  glide = null
  gliding.value = false

  if (!node || from === 0 || prefersReducedMotion()) return
  await nextTick()
  const target = node.querySelector<HTMLElement>(`[data-slot="${slot.id}"]`)
  const width = target?.getBoundingClientRect().width ?? 0

  if (!width || Math.abs(width - from) < 0.5) return
  gliding.value = true
  glide = node.animate([{ width: `${from}px` }, { width: `${width}px` }], {
    duration: ROLL_MS,
    easing: "cubic-bezier(0.2, 0, 0, 1)",
  })
  glide.onfinish = () => {
    glide = null
    gliding.value = false
  }
})

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}
</script>

<style scoped>
.roll-text {
  display: inline-flex;
  min-width: 0;
  max-width: 100%;
  overflow: clip;
}

.roll-text-slots {
  display: inline-grid;
  align-items: center;
  justify-items: start;
  min-width: 0;
}

.roll-text-slot {
  grid-area: 1 / 1;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.roll-text.is-gliding .roll-text-slot {
  max-width: none;
}
</style>
