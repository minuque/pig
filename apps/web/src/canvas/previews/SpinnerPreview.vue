<template>
  <Spinner :size="size" />
</template>

<script setup lang="ts">
import { Spinner } from "@components/ui/spinner/index.js"

withDefaults(defineProps<{ size?: number }>(), { size: 16 })
</script>
