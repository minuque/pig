<template>
  <Popover :open="open">
    <PopoverAnchor as-child>
      <div ref="anchor" class="hover-anchor" @pointerenter="onEnter" @pointerleave="onLeave">
        <slot />
      </div>
    </PopoverAnchor>

    <PopoverContent
      side="right"
      align="start"
      @open-auto-focus.prevent
      @pointerenter="onEnter"
      @pointerleave="onLeave"
    >
      <slot name="preview" />
    </PopoverContent>
  </Popover>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, useTemplateRef, watch } from "vue"
import { Popover, PopoverAnchor, PopoverContent } from "@components/ui/popover/index.js"

const props = defineProps<{
  disabled?: boolean
}>()

const OPEN_MS = 200

const CLOSE_MS = 120

const open = ref(false)

let openTimer: ReturnType<typeof setTimeout> | undefined

let closeTimer: ReturnType<typeof setTimeout> | undefined

let hideActive: (() => void) | undefined

const anchor = useTemplateRef<HTMLElement>("anchor")

function canHover() {
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches
}

function clearTimers() {
  if (openTimer !== undefined) clearTimeout(openTimer)

  if (closeTimer !== undefined) clearTimeout(closeTimer)
  openTimer = undefined
  closeTimer = undefined
}

function hide() {
  clearTimers()
  open.value = false

  if (hideActive === hide) hideActive = undefined
}

function reveal() {
  if (hideActive && hideActive !== hide) hideActive()
  hideActive = hide
  open.value = true
}

function onEnter() {
  if (props.disabled || !canHover()) return

  if (closeTimer !== undefined) clearTimeout(closeTimer)
  closeTimer = undefined

  if (open.value) return

  if (hideActive && hideActive !== hide) {
    reveal()
    return
  }

  if (openTimer !== undefined) clearTimeout(openTimer)
  openTimer = setTimeout(() => {
    openTimer = undefined

    if (!props.disabled) reveal()
  }, OPEN_MS)
}

function onCardActivate(event: Event) {
  const target = event.target

  if (!(target instanceof Element) || !target.closest(".session-card")) return
  hide()
}

function onLeave() {
  if (openTimer !== undefined) clearTimeout(openTimer)
  openTimer = undefined

  if (!open.value) return

  if (closeTimer !== undefined) clearTimeout(closeTimer)
  closeTimer = setTimeout(() => {
    closeTimer = undefined
    hide()
  }, CLOSE_MS)
}

watch(
  () => props.disabled,
  (disabled) => {
    if (disabled) hide()
  },
)

onMounted(() => {
  anchor.value?.addEventListener("pointerdown", onCardActivate, true)
})

onUnmounted(() => {
  anchor.value?.removeEventListener("pointerdown", onCardActivate, true)
  hide()
})
</script>

<style scoped>
.hover-anchor {
  width: 100%;
  min-width: 0;
}
</style>
