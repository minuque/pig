<template>
  <div class="startup-screen" :class="{ leaving }" role="status" aria-label="正在启动">
    <div class="startup-veil"></div>
    <div class="drag-strip"></div>

    <div class="startup-content" @animationend.self="handleLeaveEnd">
      <div class="startup-mark">
        <img
          class="startup-logo"
          src="/logo.png"
          alt=""
          width="88"
          height="88"
          fetchpriority="low"
        />
      </div>

      <div
        class="startup-progress"
        role="progressbar"
        aria-label="启动进度"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-valuenow="displayedProgress"
      >
        <span class="startup-progress-track">
          <span
            class="startup-progress-fill"
            :style="{ transform: `scaleX(${displayedProgress / 100})` }"
          ></span>
        </span>

        <span class="startup-progress-value">{{ displayedProgress }}%</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, shallowRef, watch } from "vue"

const props = defineProps<{
  dismiss: boolean
  progress: number
}>()

const emit = defineEmits<{
  finished: []
}>()

let finished = false

let splashGone = false

let progressFrame: number | undefined

const leaving = shallowRef(false)

const displayedProgress = shallowRef(0)

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

function maybeBeginLeave() {
  if (!props.dismiss) return

  if (props.progress < 100 || displayedProgress.value === 100) beginLeave()
}

function advanceProgress() {
  progressFrame = undefined

  if (displayedProgress.value < props.progress) displayedProgress.value += 1

  if (displayedProgress.value < props.progress) {
    progressFrame = window.requestAnimationFrame(advanceProgress)

    return
  }

  maybeBeginLeave()
}

function syncProgress() {
  if (prefersReducedMotion()) {
    displayedProgress.value = props.progress
    maybeBeginLeave()

    return
  }

  if (progressFrame === undefined && displayedProgress.value < props.progress) {
    progressFrame = window.requestAnimationFrame(advanceProgress)
  }
}

function finish() {
  if (finished) return
  finished = true
  emit("finished")
}

function beginLeave() {
  if (!splashGone || finished || leaving.value) return

  if (prefersReducedMotion()) {
    finish()

    return
  }

  leaving.value = true
}

function handleLeaveEnd() {
  if (leaving.value) finish()
}

function markSplashGone() {
  splashGone = true
  maybeBeginLeave()
}

watch(() => props.progress, syncProgress, { immediate: true })

watch(
  () => props.dismiss,
  (dismiss) => {
    if (dismiss) maybeBeginLeave()
  },
)

onMounted(() => {
  document.getElementById("startup-splash")?.remove()
  markSplashGone()
})

onBeforeUnmount(() => {
  if (progressFrame !== undefined) window.cancelAnimationFrame(progressFrame)
  document.getElementById("startup-splash")?.remove()
})
</script>
