<template>
  <div class="startup-screen" :class="{ leaving }" role="status" aria-label="正在启动">
    <div class="startup-veil"></div>
    <div class="drag-strip"></div>
    <div class="startup-content">
      <div class="startup-mark">
        <img class="startup-logo" src="/logo.png" alt="" width="88" height="88" />
      </div>
    </div>
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
const LEAVE_MS = 220

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
  const pending = animations.filter(
    (a) => a.playState === "running" && a.effect?.getComputedTiming().iterations !== Infinity,
  )
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
