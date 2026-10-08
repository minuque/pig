<template>
  <div
    class="startup-screen"
    :class="{ leaving }"
    role="status"
    :aria-label="t('startup.starting')"
    @animationend.self="handleLeaveEnd"
  >
    <div class="drag-strip"></div>

    <div class="startup-content">
      <div class="startup-mark">
        <img
          class="startup-logo"
          src="/logo-pig.png"
          alt=""
          width="88"
          height="88"
          fetchpriority="low"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "@i18n/index.js"

const { t } = useI18n()
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

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

function finish() {
  if (finished) return
  finished = true
  emit("finished")
}

function beginLeave() {
  if (!props.dismiss || !splashGone || finished || leaving.value) return

  if (prefersReducedMotion()) {
    finish()
    return
  }

  leaving.value = true
}

function handleLeaveEnd() {
  if (leaving.value) finish()
}

watch(
  () => props.dismiss,
  (dismiss) => {
    if (dismiss) beginLeave()
  },
)

onMounted(async () => {
  const splash = document.getElementById("startup-splash")
  // 等静态开屏探头播完再接管，避免中途跳帧
  await Promise.allSettled(splash?.getAnimations({ subtree: true }).map((a) => a.finished) ?? [])
  splash?.remove()
  splashGone = true
  beginLeave()
})

onBeforeUnmount(() => {
  document.getElementById("startup-splash")?.remove()
})
</script>
