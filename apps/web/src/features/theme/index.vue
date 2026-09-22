<template>
  <button type="button" class="icon-toggle press-scale" @click="toggle">
    <span class="size-icon icon-swap">
      <Sun class="size-icon" :data-visible="!isDark" />
      <Moon class="size-icon" :data-visible="isDark" />
    </span>
  </button>
</template>

<script setup lang="ts">
import { Moon, Sun } from "@lucide/vue"
import { useColorScheme } from "@features/theme/index.js"

const { isDark, toggle } = useColorScheme()
</script>
