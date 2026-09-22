<template>
  <div class="nav-footer">
    <Tooltip>
      <TooltipTrigger as-child>
        <button
          class="footer-action press-scale"
          :class="{ 'motion-pulse': hintAdd }"
          type="button"
          aria-label="新增工作区"
          :disabled="addingWorkspace"
          @click="emit('addWorkspace')"
        >
          <Plus class="size-icon" />
        </button>
      </TooltipTrigger>

      <TooltipContent>新增工作区</TooltipContent>
    </Tooltip>

    <Tooltip>
      <TooltipTrigger as-child>
        <button
          class="footer-action press-scale"
          type="button"
          aria-label="设置"
          @click="emit('settings')"
        >
          <Settings class="size-icon" />
        </button>
      </TooltipTrigger>

      <TooltipContent>设置</TooltipContent>
    </Tooltip>
  </div>
</template>

<script setup lang="ts">
import { Plus, Settings } from "@lucide/vue"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"

defineProps<{
  addingWorkspace?: boolean
  hintAdd?: boolean
}>()

const emit = defineEmits<{
  addWorkspace: []
  settings: []
}>()
</script>

<style scoped>
.nav-footer {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-xxs);
  padding: var(--spacing-xs) var(--nav-inline, var(--spacing-xs));
  border-top: var(--border-width) solid var(--border-subtle);
}

.footer-action {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: var(--size-icon-button);
  height: var(--size-icon-button);
  padding: 0;
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--ink-muted);
  transition:
    background-color var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out),
    scale var(--duration-fast) var(--ease-out);
}

.footer-action:hover:not(:disabled) {
  background: var(--hover-quiet);
  color: var(--ink);
}

.footer-action:disabled {
  opacity: 0.45;
}

@media (prefers-reduced-motion: reduce) {
  .footer-action {
    transition: none;
  }
}
</style>
