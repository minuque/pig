<template>
  <div class="thought">
    <Button type="button" static class="toggle" @click="open = !open">
      <Lightbulb :stroke-width="1.5" data-icon="inline-start" />
      <span>{{ streaming ? "思考中" : "思考" }}</span>
      <span v-if="previewing" class="hint">展开全文</span>
      <ChevronRight
        class="motion-turn"
        :class="{ 'is-on': open }"
        :stroke-width="1.5"
        data-icon="inline-end"
      />
    </Button>
    <div
      class="fold-height with-enter"
      :class="{ 'is-open': open || previewing }"
      :inert="!open && !previewing"
    >
      <div>
        <ToolStepCard v-if="text" variant="thought" :text="text" :previewing="!open" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { ChevronRight, Lightbulb } from "lucide-vue-next"
import { Button } from "@components/ui/button/index.js"
import ToolStepCard from "./ToolStepCard.vue"

const props = defineProps<{ text: string; streaming: boolean }>()
const open = defineModel<boolean>("open", { required: true })
const previewing = computed(() => props.streaming && !open.value)
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
.hint {
  font-size: var(--text-caption);
}
</style>
