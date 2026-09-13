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
      <div class="startup-progress" aria-hidden="true">
        <span class="startup-progress-track"><span></span></span>
        <span class="startup-progress-track"><span></span></span>
        <span class="startup-progress-track"><span></span></span>
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

let finished = false
let splashGone = false
const leaving = shallowRef(false)

function finish() {
  if (finished) return
  finished = true
  emit("finished")
}

function beginLeave() {
  if (!splashGone || finished || leaving.value) return
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
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
  if (props.dismiss) beginLeave()
}

watch(
  () => props.dismiss,
  (dismiss) => {
    if (dismiss) beginLeave()
  },
)

onMounted(() => {
  document.getElementById("startup-splash")?.remove()
  markSplashGone()
})

onBeforeUnmount(() => {
  document.getElementById("startup-splash")?.remove()
})
</script>
