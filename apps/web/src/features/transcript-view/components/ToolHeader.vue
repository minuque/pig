<template>
  <div class="tool-header">
    <div class="heading">
      <slot>
        <span class="label" :title="label">{{ label }}</span>
      </slot>
    </div>
    <div class="actions">
      <slot name="meta" />
      <button v-if="hiddenCount > 0" type="button" class="expand" @click="expanded = !expanded">
        {{ expanded ? `收起中间 ${hiddenCount} 行` : `展开其余 ${hiddenCount} 行` }}
      </button>
      <Button
        v-if="text"
        type="button"
        variant="outline"
        size="icon-2xs"
        class="copy"
        :class="{ 'is-copied': status === 'copied', 'is-error': status === 'error' }"
        :title="copyLabel"
        @click="copy"
      >
        <span class="icon-swap">
          <Copy class="size-3.5" :data-visible="status !== 'copied'" />
          <Check class="size-3.5" :data-visible="status === 'copied'" />
        </span>
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, shallowRef } from "vue"
import { useTimeoutFn } from "@vueuse/core"
import { Check, Copy } from "@lucide/vue"
import { Button } from "@components/ui/button/index.js"

const props = withDefaults(
  defineProps<{
    label: string
    text: string
    hiddenCount?: number
  }>(),
  { hiddenCount: 0 },
)
const expanded = defineModel<boolean>("expanded", { default: false })

const status = shallowRef<"idle" | "copied" | "error">("idle")
const copyLabel = computed(() =>
  status.value === "copied"
    ? "已复制"
    : status.value === "error"
      ? "复制失败，点击重试"
      : `复制${props.label}`,
)
const { start, stop } = useTimeoutFn(() => (status.value = "idle"), 1500, { immediate: false })

async function copy() {
  stop()
  try {
    await navigator.clipboard.writeText(props.text)
    status.value = "copied"
    start()
  } catch {
    status.value = "error"
  }
}
</script>

<style scoped>
.tool-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
  min-height: 36px;
  padding: var(--spacing-xxs) var(--spacing-sm);
  border-bottom: var(--border-width) solid var(--hairline);
  background: var(--code-header);
  font-size: var(--text-caption);
}

.heading {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.label {
  display: block;
  overflow: hidden;
  color: var(--ink);
  font-family: var(--font-mono);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.actions {
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--spacing-xs);
  color: var(--ink-muted);
  white-space: nowrap;
}

.expand {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ink-muted);
  font: inherit;
  cursor: pointer;
}
.expand:hover {
  color: var(--ink);
}

.copy {
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: var(--radius-xs);
  background: transparent;
  color: var(--ink-secondary);
  box-shadow: none;
  font-size: inherit;
  font-weight: var(--font-weight-regular);
}
.copy:hover {
  background: var(--hover-quiet);
  color: var(--ink);
}
.copy.is-copied {
  color: var(--success);
}
.copy.is-error {
  color: var(--danger);
}

.icon-swap {
  width: 14px;
  height: 14px;
}

@media (max-width: 480px) {
  .tool-header {
    flex-wrap: wrap;
  }

  .heading {
    flex-basis: 100%;
  }

  .actions {
    margin-inline-start: auto;
  }
}
</style>
