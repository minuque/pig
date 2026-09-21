<template>
  <div class="tool-header-pin">
    <div class="tool-header">
      <div class="heading">
        <slot>
          <span class="label" :title="label">{{ label }}</span>
        </slot>
      </div>

      <div class="actions">
        <slot name="meta" />

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
  </div>
</template>

<script setup lang="ts">
import { computed, shallowRef } from "vue"
import { useTimeoutFn } from "@vueuse/core"
import { Check, Copy } from "@lucide/vue"
import { Button } from "@components/ui/button/index.js"

const props = defineProps<{
  label: string
  text: string
}>()
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
.tool-header-pin {
  position: sticky;
  top: var(--size-icon-button);
  z-index: 1;
  width: 100%;
  min-width: 0;
  container-type: scroll-state;
}

.tool-header {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
  min-width: 0;
  min-height: 36px;
  padding: var(--spacing-xs) var(--spacing-sm);
  border-bottom: var(--border-width) solid var(--border);
  border-start-start-radius: var(--radius-lg);
  border-start-end-radius: var(--radius-lg);
  background: var(--code-header);
  font-size: var(--text-caption);
  transition:
    border-start-start-radius var(--duration-fast) var(--ease-out),
    border-start-end-radius var(--duration-fast) var(--ease-out);
}

@container scroll-state(stuck: top) {
  .tool-header {
    border-start-start-radius: 0;
    border-start-end-radius: 0;
    border-block-start: var(--border-width) solid var(--border);
  }
}

@media (prefers-reduced-motion: reduce) {
  .tool-header {
    transition: none;
  }
}

.heading {
  flex: 1;
  min-width: 0;
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
