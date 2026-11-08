<template>
  <span ref="stack" class="roll-text" :class="{ 'is-gliding': gliding }">
    <TransitionGroup
      name="label-roll"
      tag="span"
      class="roll-text-slots"
      @after-leave="onLeaveDone"
    >
      <span
        v-for="slot in slots"
        :key="slot.id"
        :data-slot="slot.id"
        class="roll-text-slot"
        :class="{ shimmer: slot.live && plain }"
        :data-text="slot.live && plain ? slot.text : undefined"
      >
        <slot v-if="!plain" />
        <template v-else>{{ slot.text }}</template>
      </span>
    </TransitionGroup>
  </span>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, shallowRef, useSlots, useTemplateRef, watch } from "vue"

const ROLL_MS = 180
const props = defineProps<{
  text: string
  /** 纯文字时运行中显示 shimmer；富文本内容由调用方自己控制闪烁 */
  live?: boolean
}>()
/** 没给默认插槽就是纯文字模式；给了就渲染富文本，过渡帧沿用上一帧的 DOM。 */
const plain = !useSlots().default

type Slot = { id: number; text: string; live: boolean }

let slotId = 0
const slots = shallowRef<Slot[]>([{ id: slotId, text: props.text, live: Boolean(props.live) }])
const stack = useTemplateRef<HTMLElement>("stack")
const gliding = ref(false)
let glide: Animation | null = null
let settleTimer: ReturnType<typeof setTimeout> | undefined

/** 换字时宽度从旧值滑到新值，避免尾部元素跟着瞬间跳位；对齐 cc-wrapper 的 MorphSlots。 */
watch([() => props.text, () => Boolean(props.live)], async ([text, live]) => {
  const node = stack.value
  const from = node?.getBoundingClientRect().width ?? 0
  const slot = { id: ++slotId, text, live }
  slots.value = [slot]
  glide?.cancel()
  glide = null

  if (!node || from === 0) return
  // 旧字退场期间锁住当前宽度，否则卡片会在退场帧弹回旧字的自然宽度。
  node.style.width = `${from}px`
  gliding.value = true
  // 退场事件偶发缺失时的兜底，别让锁定宽度留到下一次换字。
  clearTimeout(settleTimer)
  settleTimer = setTimeout(() => {
    settleTimer = undefined

    if (stack.value) release(stack.value)
  }, ROLL_MS + 120)

  if (prefersReducedMotion()) {
    release(node)
    return
  }

  await nextTick()
  const target = node.querySelector<HTMLElement>(`[data-slot="${slot.id}"]`)
  const width = target?.getBoundingClientRect().width ?? 0

  if (!width || Math.abs(width - from) < 0.5) {
    release(node)
    return
  }

  const animation = node.animate([{ width: `${from}px` }, { width: `${width}px` }], {
    duration: ROLL_MS,
    easing: "cubic-bezier(0.2, 0, 0, 1)",
    fill: "forwards",
  })

  glide = animation
  animation.onfinish = () => {
    if (glide === animation && stack.value) release(stack.value)
  }
})

/** 退场元素还在时保持锁定宽度，等最后一个离场后再放回自然宽度。 */
function release(node: HTMLElement) {
  if (node.querySelector(".label-roll-leave-active")) return
  clearTimeout(settleTimer)
  settleTimer = undefined
  glide?.cancel()
  glide = null
  node.style.width = ""
  gliding.value = false
}

function onLeaveDone() {
  const node = stack.value

  if (!node || (glide && glide.playState === "running")) return
  release(node)
}

onBeforeUnmount(() => {
  clearTimeout(settleTimer)
  glide?.cancel()
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
