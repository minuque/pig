<template>
  <div class="startup-wait" :class="{ leaving }">
    <div class="drag-strip"></div>
    <img class="startup-logo" src="/logo.png" alt="" width="96" height="96" />
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, shallowRef, watch } from "vue"

const props = defineProps<{
  dismiss: boolean
}>()

const emit = defineEmits<{
  finished: []
}>()

const leaving = shallowRef(false)
const LEAVE_MS = 200
let finished = false
let leaveTimer = 0
let reducedMotion = false
let motionQuery: MediaQueryList | undefined

function finish() {
  if (finished) return
  finished = true
  emit("finished")
}

function beginLeave() {
  if (leaving.value || finished) return
  if (reducedMotion || document.hidden) {
    finish()
    return
  }
  leaving.value = true
  leaveTimer = window.setTimeout(finish, LEAVE_MS)
}

function onMotionChange() {
  reducedMotion = motionQuery?.matches ?? false
  if (reducedMotion && props.dismiss) beginLeave()
}

watch(
  () => props.dismiss,
  (dismiss) => {
    if (dismiss) beginLeave()
  },
)

onMounted(() => {
  document.getElementById("startup-splash")?.remove()
  motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
  motionQuery.addEventListener("change", onMotionChange)
  reducedMotion = motionQuery.matches
  if (props.dismiss) beginLeave()
})

onBeforeUnmount(() => {
  window.clearTimeout(leaveTimer)
  motionQuery?.removeEventListener("change", onMotionChange)
})
</script>

<style scoped>
.startup-wait {
  position: fixed;
  z-index: var(--z-modal);
  inset: 0;
  display: grid;
  place-items: center;
  overflow: visible;
  background: color-mix(in srgb, var(--glass-surface) var(--glass-opacity), var(--canvas-soft));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturation));
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturation));
  opacity: 1;
  -webkit-app-region: no-drag;
}
.startup-wait.leaving {
  pointer-events: none;
  opacity: 0;
  transition: opacity var(--duration-normal) var(--ease-out);
}
.drag-strip {
  position: absolute;
  z-index: 1;
  inset: 0 0 auto;
  height: var(--titlebar-inset);
  -webkit-app-region: drag;
}
.startup-logo {
  width: 96px;
  height: 96px;
  object-fit: contain;
  border-radius: var(--radius-xs);
  box-shadow:
    0 1px 2px rgba(15, 17, 21, 0.06),
    0 8px 20px rgba(15, 17, 21, 0.08);
  pointer-events: none;
}
:global(html.dark) .startup-logo {
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.28),
    0 10px 24px rgba(0, 0, 0, 0.36);
}
.startup-wait.leaving .startup-logo {
  transform: translateY(-12px);
  transition: transform var(--duration-normal) var(--ease-out);
}
@media (prefers-reduced-transparency: reduce) {
  .startup-wait {
    background: var(--surface);
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .startup-wait.leaving,
  .startup-wait.leaving .startup-logo {
    transition: none;
  }
}
</style>
