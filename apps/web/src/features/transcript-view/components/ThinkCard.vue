<template>
  <div class="thought">
    <Button type="button" static class="toggle" @click="open = !open">
      <Lightbulb :stroke-width="1.5" data-icon="inline-start" />
      <span :class="{ shimmer: streaming }">{{ streaming ? "思考中" : "思考" }}</span>
      <ChevronRight
        class="motion-turn motion-hint"
        :class="{ 'is-on': open }"
        :stroke-width="1.5"
        data-icon="inline-end"
      />
    </Button>
    <div class="fold-height with-enter" :class="{ 'is-open': open }" :inert="!open">
      <div>
        <ToolStepCard v-if="text && open" variant="thought" :text="text" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ChevronRight, Lightbulb } from "lucide-vue-next"
import { Button } from "@components/ui/button/index.js"
import ToolStepCard from "./ToolStepCard.vue"

defineProps<{ text: string; streaming: boolean }>()
const open = defineModel<boolean>("open", { required: true })
</script>

<style scoped>
.thought {
  min-width: 0;
}
.toggle {
  height: auto;
  min-height: 28px;
  padding: 2px 0;
  gap: var(--spacing-xs);
  background: transparent;
  color: var(--ink-muted);
  border-radius: 0;
  font-size: var(--text-body-sm);
  font-weight: var(--font-weight-regular);
}
.toggle:hover {
  background: transparent;
  color: var(--ink-secondary);
}
</style>
