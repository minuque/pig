<template>
  <Blobatar
    ref="blob"
    class="hero-mascot"
    name="pig"
    animate="always"
    :size="128"
    aria-hidden="true"
  />
</template>

<script setup lang="ts">
import { shallowRef, useTemplateRef } from "vue"
import { useEventListener } from "@vueuse/core"
import { Blobatar } from "@blobatar/vue"
import { useGaze } from "@blobatar/vue/gaze"
import "blobatar/motion.css"
import "blobatar/gaze.css"

function promptField(): HTMLElement | null {
  return document.querySelector("[data-prompt-field]")
}

function caretPoint(field: HTMLElement): { x: number; y: number } | null {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return null
  const node = sel.anchorNode
  if (!node || (node !== field && !field.contains(node))) return null
  const range = sel.getRangeAt(0).cloneRange()
  range.collapse(true)
  const rect = range.getBoundingClientRect()
  if (!rect.width && !rect.height) return null
  return { x: rect.left, y: rect.top + rect.height / 2 }
}

const blob = useTemplateRef("blob")
const { lookAt } = useGaze(blob, { travel: 16, target: "pointer" })
const focused = shallowRef(false)

function aim() {
  if (focused.value) {
    const field = promptField()
    if (field) {
      lookAt(caretPoint(field) ?? field)
      return
    }
  }
  lookAt("pointer")
}

function syncFocus(event: FocusEvent) {
  const field = promptField()
  const target = event.type === "focusout" ? event.relatedTarget : event.target
  focused.value =
    field !== null && target instanceof Node && (target === field || field.contains(target))
  aim()
}

useEventListener(document, "focusin", syncFocus)
useEventListener(document, "focusout", syncFocus)
useEventListener(document, "selectionchange", () => {
  if (focused.value) aim()
})
useEventListener(
  window,
  "scroll",
  () => {
    if (focused.value) aim()
  },
  { capture: true, passive: true },
)
useEventListener(window, "resize", () => {
  if (focused.value) aim()
})
</script>
