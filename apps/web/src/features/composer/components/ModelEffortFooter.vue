<template>
  <div class="effort-footer">
    <span class="effort-label">思考强度</span>

    <DropdownMenu v-model:open="open" :modal="false">
      <Tooltip>
        <TooltipTrigger as-child>
          <DropdownMenuTrigger as-child>
            <Button
              type="button"
              static
              class="effort-trigger"
              :aria-label="`思考强度：${currentLabel}`"
              @pointerdown.stop
              @click.stop
            >
              {{ currentLabel }}
              <ChevronRight class="effort-caret" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>

        <TooltipContent>思考强度：{{ currentLabel }}</TooltipContent>
      </Tooltip>

      <DropdownMenuContent side="top" align="end" :side-offset="4" data-model-effort-menu>
        <DropdownMenuItem
          v-for="item in levels"
          :key="item"
          class="effort-option"
          :data-current="item === current ? '' : undefined"
          @select="onSelect(item)"
        >
          <span class="effort-option-name">{{ formatThinkingLevel(item) }}</span>
          <span v-if="item === levels[0]" class="effort-default">默认</span>
          <Check v-if="item === current" class="effort-check" :size="14" aria-hidden="true" />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</template>

<script setup lang="ts">
import { Check, ChevronRight } from "@lucide/vue"
import { computed, ref } from "vue"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@components/ui/dropdown-menu/index.js"
import { Button } from "@components/ui/button/index.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"
import { displayThinkingLevel, formatThinkingLevel } from "@features/composer/lib/thinking-level.js"

const props = defineProps<{
  levels: readonly string[]
  level: string
}>()
const emit = defineEmits<{
  "update:level": [value: string]
}>()
const open = ref(false)
const current = computed(() => displayThinkingLevel(props.level, props.levels))
const currentLabel = computed(() => formatThinkingLevel(current.value))

function onSelect(item: string) {
  if (item !== current.value) emit("update:level", item)
}
</script>

<style scoped>
.effort-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-xs);
  min-height: var(--size-control);
  padding: 0 var(--spacing-xs);
  border-top: var(--border-width) solid var(--border);
}

.effort-label {
  color: var(--ink-faint);
  font-size: var(--text-eyebrow);
  font-weight: var(--font-weight-medium);
  line-height: var(--text-eyebrow--line-height);
}

.effort-trigger {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xxs);
  min-width: 0;
  min-height: 0;
  height: auto;
  padding: var(--spacing-xxs) var(--spacing-xs);
  border: 0;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--ink-muted);
  font-size: var(--text-eyebrow);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition:
    background var(--duration-fast) var(--ease-smooth),
    color var(--duration-fast) var(--ease-smooth);
}

.effort-trigger:hover,
.effort-trigger[data-state="open"] {
  background: var(--hover-tint);
  color: var(--ink);
}

.effort-trigger:focus-visible {
  outline: var(--border-width) solid var(--primary);
  outline-offset: -2px;
}

.effort-caret {
  flex: none;
  width: 1em;
  height: 1em;
}

.effort-option {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.effort-option-name {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.effort-default {
  flex: none;
  color: var(--ink-faint);
  font-size: var(--text-eyebrow);
  font-weight: var(--font-weight-regular);
}

.effort-check {
  flex: none;
  color: var(--primary);
}
</style>
