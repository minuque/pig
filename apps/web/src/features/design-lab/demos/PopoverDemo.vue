<template>
  <Story title="Popover">
    <Variant title="Default">
      <Popover>
        <PopoverTrigger as-child>
          <Button variant="secondary">Open popover</Button>
        </PopoverTrigger>

        <PopoverContent>
          <div class="demo-popover">
            <p class="demo-popover-title">Session summary</p>
            <p class="demo-popover-desc">Lightweight floating panel anchored to a trigger.</p>

            <div class="demo-popover-actions">
              <PopoverClose as-child>
                <Button size="s" variant="secondary">Close</Button>
              </PopoverClose>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </Variant>

    <Variant title="Sizes">
      <div class="demo-row">
        <Popover>
          <PopoverTrigger as-child>
            <Button size="s" variant="outline">Small</Button>
          </PopoverTrigger>

          <PopoverContent size="s">
            <p class="demo-popover-desc">Compact popover padding and content.</p>
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger as-child>
            <Button size="m" variant="outline">Medium</Button>
          </PopoverTrigger>

          <PopoverContent size="m">
            <p class="demo-popover-desc">Default medium popover spacing.</p>
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger as-child>
            <Button size="l" variant="outline">Large</Button>
          </PopoverTrigger>

          <PopoverContent size="l">
            <p class="demo-popover-desc">Generous padding for structured details.</p>
          </PopoverContent>
        </Popover>
      </div>
    </Variant>
  </Story>
</template>

<script setup lang="ts">
import Story from "@features/design-lab/components/DemoStory.vue"
import Variant from "@features/design-lab/components/DemoVariant.vue"
import { Button } from "@components/ui/button/index.js"
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from "@components/ui/popover/index.js"
</script>

<style scoped>
.demo-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-xs);
}

.demo-popover {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  max-inline-size: 16rem;
}

.demo-popover-title {
  margin: 0;
  color: var(--fg);
  font-size: var(--text-body);
  font-weight: var(--font-weight-medium);
}

.demo-popover-desc {
  margin: 0;
  color: var(--fg-secondary);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
}

.demo-popover-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: var(--space-2xs);
}
</style>
