<template>
  <Story title="Popover">
    <Variant title="Default">
      <Popover>
        <PopoverTrigger>
          <template #render="{ props: part }">
            <Button v-bind="part" variant="secondary">Open popover</Button>
          </template>
        </PopoverTrigger>

        <PopoverContent>
          <div class="demo-popover">
            <p class="demo-popover-title">Session summary</p>
            <p class="demo-popover-desc">Lightweight floating panel anchored to a trigger.</p>

            <div class="demo-popover-actions">
              <PopoverClose>
                <template #render="{ props: part }">
                  <Button v-bind="part" size="s" variant="secondary">Close</Button>
                </template>
              </PopoverClose>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </Variant>

    <Variant title="Sizes">
      <div class="demo-row">
        <Popover>
          <PopoverTrigger>
            <template #render="{ props: part }">
              <Button v-bind="part" size="s" variant="outline">Small</Button>
            </template>
          </PopoverTrigger>

          <PopoverContent size="s">
            <p class="demo-popover-desc">Compact popover padding and content.</p>
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger>
            <template #render="{ props: part }">
              <Button v-bind="part" size="m" variant="outline">Medium</Button>
            </template>
          </PopoverTrigger>

          <PopoverContent size="m">
            <p class="demo-popover-desc">Default medium popover spacing.</p>
          </PopoverContent>
        </Popover>
      </div>
    </Variant>
  </Story>
</template>

<script setup lang="ts">
import Story from "@features/design-lab/components/DemoStory.vue"
import Variant from "@features/design-lab/components/DemoVariant.vue"
import { Button } from "@pig/ui/button"
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "@pig/ui/popover"
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
