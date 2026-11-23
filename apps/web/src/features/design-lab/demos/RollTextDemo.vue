<template>
  <Story title="RollText">
    <Variant title="Interactive">
      <div class="demo-row">
        <Button size="s" variant="secondary" @click="nextLabel">Cycle label</Button>
        <RollText :text="labels[index]!" class="demo-roll" />
      </div>
    </Variant>

    <Variant title="Live shimmer">
      <div class="demo-row">
        <Button size="s" variant="secondary" @click="live = !live">
          {{ live ? "Stop shimmer" : "Start shimmer" }}
        </Button>

        <RollText :text="live ? 'Thinking through changes' : 'Completed'" :live="live" />
      </div>
    </Variant>
  </Story>
</template>

<script setup lang="ts">
import { ref } from "vue"
import Story from "@features/design-lab/components/DemoStory.vue"
import Variant from "@features/design-lab/components/DemoVariant.vue"
import { Button } from "@components/ui/button/index.js"
import { RollText } from "@components/ui/roll-text/index.js"

const labels = ["Reading files", "Running checks", "All checks passed"]
const index = ref(0)
const live = ref(true)

function nextLabel() {
  index.value = (index.value + 1) % labels.length
}
</script>

<style scoped>
.demo-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.demo-roll {
  color: var(--fg);
  font-size: var(--text-body);
}
</style>
