<template>
  <button
    type="button"
    class="icon-toggle press-scale"
    :aria-pressed="enabled"
    :aria-label="label"
    :title="label"
    :data-sound="enabled ? 'release' : 'pulse'"
    @click="toggle"
  >
    <span class="size-icon icon-swap" aria-hidden="true">
      <Volume2 class="size-icon" :data-visible="enabled" />
      <VolumeX class="size-icon" :data-visible="!enabled" />
    </span>
  </button>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { Volume2, VolumeX } from "@lucide/vue"
import { useClickSound } from "@features/click-sound/index.js"

const { enabled, toggle } = useClickSound()
const label = computed(() => (enabled.value ? "关闭点击音效" : "开启点击音效"))
</script>
