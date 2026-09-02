<template>
  <div class="startup-wait" :class="{ leaving }">
    <div class="startup-veil"></div>
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
const LEAVE_MS = 280
let finished = false
let leaveTimer = 0
let reducedMotion = false
let splashGone = false
let motionQuery: MediaQueryList | undefined

function finish() {
  if (finished) return
  finished = true
  emit("finished")
}

function beginLeave() {
  if (!splashGone || leaving.value || finished) return
  if (reducedMotion || document.hidden) {
    finish()
    return
  }
  leaving.value = true
  leaveTimer = window.setTimeout(finish, LEAVE_MS)
}

function markSplashGone() {
  splashGone = true
  if (props.dismiss) beginLeave()
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

function releaseSplash() {
  const splash = document.getElementById("startup-splash")
  if (!splash) {
    markSplashGone()
    return
  }
  const run = () => {
    splash.remove()
    markSplashGone()
  }
  if (reducedMotion) {
    run()
    return
  }
  const animations =
    typeof splash.getAnimations === "function" ? splash.getAnimations({ subtree: true }) : []
  const pending = animations.filter((a) => a.playState === "running")
  if (!pending.length) {
    run()
    return
  }
  void Promise.all(pending.map((a) => a.finished.catch(() => {}))).then(run)
}

onMounted(() => {
  motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
  motionQuery.addEventListener("change", onMotionChange)
  reducedMotion = motionQuery.matches
  releaseSplash()
})

onBeforeUnmount(() => {
  window.clearTimeout(leaveTimer)
  motionQuery?.removeEventListener("change", onMotionChange)
  document.getElementById("startup-splash")?.remove()
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
  -webkit-app-region: no-drag;
}
.startup-wait.leaving {
  pointer-events: none;
}
.startup-veil {
  position: absolute;
  z-index: 0;
  inset: 0;
  background: color-mix(in srgb, var(--chat-input) var(--glass-opacity), var(--canvas-soft));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturation));
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturation));
}
.startup-wait.leaving .startup-veil {
  opacity: 0;
  transition-property: opacity;
  transition-duration: var(--duration-normal);
  transition-timing-function: var(--ease-out);
  transition-delay: 80ms;
}
.drag-strip {
  position: absolute;
  z-index: 2;
  inset: 0 0 auto;
  height: var(--titlebar-inset);
  -webkit-app-region: drag;
}
.startup-logo {
  position: relative;
  z-index: 1;
  width: 96px;
  height: 96px;
  object-fit: contain;
  border-radius: var(--radius-xs);
  box-shadow: var(--shadow-logo);
  pointer-events: none;
}
.startup-wait.leaving .startup-logo {
  opacity: 0;
  transform: translateY(-12px);
  filter: blur(4px);
  transition-property: opacity, transform, filter;
  transition-duration: var(--duration-fast);
  transition-timing-function: var(--ease-out);
}
@media (prefers-reduced-transparency: reduce) {
  .startup-veil {
    background: var(--surface);
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .startup-wait.leaving .startup-veil,
  .startup-wait.leaving .startup-logo {
    transition: none;
  }
}
</style>
