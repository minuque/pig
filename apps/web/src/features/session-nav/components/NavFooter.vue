<template>
  <div class="nav-footer">
    <button
      v-if="canAdd"
      class="footer-identity"
      type="button"
      :disabled="addingWorkspace"
      @click="emit('addWorkspace')"
    >
      <img src="/pwa-icon-192.png" alt="" width="24" height="24" />
      <span class="footer-label">{{ label }}</span>
    </button>

    <div v-else class="footer-identity">
      <img src="/pwa-icon-192.png" alt="" width="24" height="24" />
      <span class="footer-label">{{ label }}</span>
    </div>

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
import { Settings } from "@lucide/vue"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"

defineProps<{
  label: string
  canAdd: boolean
  addingWorkspace?: boolean
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
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--nav-inline, var(--spacing-xs));
  border-top: var(--border-width) solid var(--border-subtle);
}

.footer-identity {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  min-width: 0;
  flex: 1;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ink);
  text-align: start;
}

button.footer-identity {
  border-radius: var(--radius-md);
}

button.footer-identity:hover:not(:disabled) {
  background: var(--hover-quiet);
}

button.footer-identity:disabled {
  opacity: var(--opacity-disabled);
}

.footer-identity img {
  width: 24px;
  height: 24px;
  flex: none;
  object-fit: cover;
  border-radius: var(--radius-full);
}

.footer-label {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  font-size: var(--text-caption);
  line-height: var(--text-caption--line-height);
  text-overflow: ellipsis;
  white-space: nowrap;
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

.footer-action:hover {
  background: var(--hover-quiet);
  color: var(--ink);
}

@media (prefers-reduced-motion: reduce) {
  .footer-action {
    transition: none;
  }
}
</style>
