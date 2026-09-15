<template>
  <div class="startup-gate" :inert="visible || undefined">
    <slot />
  </div>

  <StartupOverlay v-if="visible" :dismiss="settled" :progress="progress" @finished="finish" />
</template>

<script setup lang="ts">
import { onMounted } from "vue"
import StartupOverlay from "./components/StartupOverlay.vue"
import { useStartupSequence } from "@features/startup/hooks/use-startup-sequence.js"

const props = defineProps<{
  connect: () => Promise<unknown>
  initialize: () => Promise<unknown>
}>()

const { visible, settled, progress, finish, start } = useStartupSequence(props)

onMounted(() => {
  void start()
})
</script>

<style scoped>
.startup-gate {
  height: 100%;
}
</style>
