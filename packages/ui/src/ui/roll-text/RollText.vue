<template>
  <span ref="stack" data-slot="roll-text" :data-gliding="gliding || undefined">
    <TransitionGroup
      name="label-roll"
      tag="span"
      data-slot="roll-text-slots"
      @after-leave="onLeaveDone"
    >
      <span
        v-for="slot in slots"
        :key="slot.id"
        :data-roll-id="slot.id"
        data-slot="roll-text-slot"
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

const ROLL_MS = 200
const props = defineProps<{
  text: string
  live?: boolean
}>()
const plain = !useSlots().default

type Slot = { id: number; text: string; live: boolean }

let slotId = 0
const slots = shallowRef<Slot[]>([{ id: slotId, text: props.text, live: Boolean(props.live) }])
const stack = useTemplateRef<HTMLElement>("stack")
const gliding = ref(false)
let glide: Animation | null = null
let settleTimer: ReturnType<typeof setTimeout> | undefined

watch([() => props.text, () => Boolean(props.live)], async ([text, live]) => {
  const prev = slots.value.at(-1)

  if (prev && prev.live === live && text.startsWith(prev.text)) {
    slots.value = [{ ...prev, text }]
    return
  }

  const node = stack.value
  const from = node?.getBoundingClientRect().width ?? 0
  const slot = { id: ++slotId, text, live }
  slots.value = [slot]
  glide?.cancel()
  glide = null

  if (!node || from === 0) return
  node.style.width = `${from}px`
  gliding.value = true
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
  const target = node.querySelector<HTMLElement>(`[data-roll-id="${slot.id}"]`)
  const width = target?.getBoundingClientRect().width ?? 0

  if (!width || Math.abs(width - from) < 0.5) {
    release(node)
    return
  }

  const animation = node.animate([{ width: `${from}px` }, { width: `${width}px` }], {
    duration: ROLL_MS,
    easing: "cubic-bezier(0.17, 1, 0.32, 1)",
    fill: "forwards",
  })

  glide = animation
  animation.onfinish = () => {
    if (glide === animation && stack.value) release(stack.value)
  }
})

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

<style>
:where([data-slot="roll-text"]) {
  display: inline-flex;
  min-width: 0;
  max-width: 100%;
  overflow: clip;
}

:where([data-slot="roll-text-slots"]) {
  display: inline-grid;
  align-items: center;
  justify-items: start;
  min-width: 0;
}

:where([data-slot="roll-text-slot"]) {
  grid-area: 1 / 1;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:where([data-slot="roll-text"][data-gliding] [data-slot="roll-text-slot"]) {
  max-width: none;
}
</style>
