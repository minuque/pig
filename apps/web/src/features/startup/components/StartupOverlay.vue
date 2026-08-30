<template>
  <div class="startup-wait" :class="{ leaving }" role="status" aria-label="正在启动">
    <div class="drag-strip" aria-hidden="true"></div>
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
  overflow: hidden;
  background: color-mix(in srgb, var(--glass-surface) var(--glass-opacity), transparent);
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
  width: clamp(80px, 12vw, 112px);
  height: auto;
  aspect-ratio: 1;
  object-fit: contain;
  pointer-events: none;
}
.startup-wait.leaving .startup-logo {
  transform: translateY(-4px);
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
