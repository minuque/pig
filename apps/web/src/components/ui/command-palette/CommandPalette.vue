<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogBackdrop class="glass-backdrop" />

    <DialogContent data-command-palette class="glass-panel">
      <DialogTitle class="sr-only">{{ title }}</DialogTitle>

      <Command v-model:query="query" class="body" :filter="false">
        <slot />
      </Command>

      <footer class="footer">
        <span class="hint">
          <Kbd size="s"><ArrowUpIcon /></Kbd>
          <Kbd size="s"><ArrowDownIcon /></Kbd>
          {{ t("common.navigate") }}
        </span>

        <span class="hint">
          <Kbd size="s">Enter</Kbd>
          {{ t("common.select") }}
        </span>

        <span class="hint">
          <Kbd size="s">Esc</Kbd>
          {{ t("common.close") }}
        </span>
      </footer>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { Command } from "@ui-sdk/vue/command"
import { Dialog, DialogBackdrop, DialogContent, DialogTitle } from "@ui-sdk/vue/dialog"
import { useI18n } from "@i18n/index.js"
import { Kbd } from "@components/ui/kbd/index.js"
import { ArrowDownIcon, ArrowUpIcon } from "@components/icons/index.js"

defineProps<{ open: boolean; title: string }>()

const emit = defineEmits<{ "update:open": [open: boolean] }>()
const query = defineModel<string>("query", { default: "" })
const { t } = useI18n()
</script>

<style scoped>
[data-command-palette] {
  position: fixed;
  inset-block: max(10vh, var(--space-md)) auto;
  inset-inline: var(--space-md);
  display: flex;
  max-width: 36rem;
  max-height: 26.25rem;
  min-height: 0;
  flex-direction: column;
  margin-inline: auto;
  overflow: hidden;
}

.body {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
}

.footer {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2xs) var(--space-sm);
  padding: calc(var(--spacing) * 2.5) var(--space-md);
  border-block-start: var(--border-width) solid var(--glass-footer-border);
  background: var(--glass-footer-bg);
  color: var(--fg-secondary);
  font-size: var(--text-body);
  font-weight: var(--font-weight-medium);
}

.hint {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2xs);
}

.hint [data-slot="kbd"] {
  min-width: 20px;
  height: 20px;
  padding-inline: var(--space-2xs);
  border-radius: calc(var(--radius-control) - 2px);
  background: var(--glass-kbd-bg);
  box-shadow: none;
  color: var(--fg);
  font-family: var(--font-sans);
  font-size: var(--text-meta);
  font-weight: var(--font-weight-medium);
}

.hint [data-slot="kbd"] svg {
  width: var(--icon-sm);
  height: var(--icon-sm);
}
</style>
