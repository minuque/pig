<template>
  <div class="startup-screen" role="status" :aria-label="t('startup.starting')">
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
import { onBeforeUnmount, onMounted, watch } from "vue"

const props = defineProps<{
  dismiss: boolean
}>()
const emit = defineEmits<{
  finished: []
}>()
let finished = false
let splashGone = false

function finish() {
  if (finished) return
  finished = true
  emit("finished")
}

function beginLeave() {
  if (!props.dismiss || !splashGone) return
  // 离场第一帧就拆遮罩并开锁，不等淡出结束
  finish()
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
