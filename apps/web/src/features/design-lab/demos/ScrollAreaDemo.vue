<template>
  <Story title="ScrollArea">
    <Variant title="Vertical">
      <div class="demo-box">
        <ScrollArea scrollbars="vertical" size="s">
          <div class="demo-list">
            <div v-for="n in 18" :key="n" class="demo-row">Entry {{ n }}</div>
          </div>
        </ScrollArea>
      </div>
    </Variant>

    <Variant title="Always visible">
      <div class="demo-box">
        <ScrollArea type="always" scrollbars="both" size="m">
          <div class="demo-wide">
            <div v-for="n in 12" :key="n" class="demo-row">
              Long log line {{ n }}: verifying overlay scrollbar thumb contrast and alignment
            </div>
          </div>
        </ScrollArea>
      </div>
    </Variant>
  </Story>
</template>

<script setup lang="ts">
import Story from "@features/design-lab/components/DemoStory.vue"
import Variant from "@features/design-lab/components/DemoVariant.vue"
import { ScrollArea } from "@components/ui/scroll-area/index.js"
</script>

<style scoped>
.demo-box {
  inline-size: 18rem;
  block-size: 10rem;
  border: var(--border-width) solid var(--border);
  border-radius: var(--radius-card);
  background: var(--bg-surface);
  overflow: hidden;
}

.demo-list,
.demo-wide {
  display: grid;
  gap: var(--space-2xs);
  padding: var(--space-xs) var(--space-sm);
}

.demo-wide {
  inline-size: max-content;
}

.demo-row {
  color: var(--fg-secondary);
  font-size: var(--text-meta);
  white-space: nowrap;
}
</style>
