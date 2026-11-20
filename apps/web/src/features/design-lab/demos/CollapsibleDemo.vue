<template>
  <Story title="Collapsible">
    <Variant title="Default">
      <Collapsible v-model:open="open" class="demo-collapsible">
        <div class="demo-head">
          <span class="demo-title">Tool output (12 lines)</span>

          <CollapsibleTrigger as-child>
            <Button variant="ghost" color="gray" size="s">
              {{ open ? "Hide" : "Show" }}
            </Button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent>
          <div class="demo-body">
            <div>> pnpm check:touched</div>
            <div>stylelint: 0 warnings</div>
            <div>vitest: 213 passed</div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Variant>
  </Story>
</template>

<script setup lang="ts">
import { ref } from "vue"
import Story from "@features/design-lab/components/DemoStory.vue"
import Variant from "@features/design-lab/components/DemoVariant.vue"
import { Button } from "@components/ui/button/index.js"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@components/ui/collapsible/index.js"

const open = ref(true)
</script>

<style scoped>
.demo-collapsible {
  inline-size: 20rem;
  border: var(--border-width) solid var(--border);
  border-radius: var(--radius-card);
  background: var(--bg-surface);
}

.demo-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-xs) var(--space-sm);
}

.demo-title {
  color: var(--fg);
  font-size: var(--text-meta);
  font-weight: var(--font-weight-medium);
}

.demo-body {
  display: grid;
  gap: var(--space-2xs);
  padding: var(--space-xs) var(--space-sm) var(--space-sm);
  border-top: var(--border-width) solid var(--border-subtle);
  color: var(--fg-secondary);
  font-family: var(--font-mono);
  font-size: var(--text-meta);
}
</style>
