<template>
  <Tooltip>
    <TooltipTrigger as-child>
      <button
        type="button"
        class="icon-toggle press-scale"
        :aria-pressed="enabled"
        :aria-label="label"
        :data-sound="enabled ? 'release' : 'pulse'"
        @click="toggle"
      >
        <span class="size-icon icon-swap" aria-hidden="true">
          <Volume2 class="size-icon" :data-visible="enabled" />
          <VolumeX class="size-icon" :data-visible="!enabled" />
        </span>
      </button>
    </TooltipTrigger>

    <TooltipContent>{{ label }}</TooltipContent>
  </Tooltip>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { Volume2, VolumeX } from "@lucide/vue"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"
import { useClickSound } from "@features/click-sound/index.js"

const { enabled, toggle } = useClickSound()
const label = computed(() => (enabled.value ? "关闭音效" : "开启音效"))
</script>
