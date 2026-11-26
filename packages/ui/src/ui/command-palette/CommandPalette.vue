<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogBackdrop class="glass-backdrop" />

    <DialogContent data-command-palette class="glass-panel">
      <DialogTitle class="sr-only">{{ title }}</DialogTitle>

      <Command v-model:query="query" data-command-palette-body :filter="false">
        <slot />
      </Command>

      <footer data-slot="command-palette-footer">
        <span data-slot="command-palette-hint">
          <Kbd size="s"><ArrowUpIcon /></Kbd>
          <Kbd size="s"><ArrowDownIcon /></Kbd>
          {{ labels.navigate }}
        </span>

        <span data-slot="command-palette-hint">
          <Kbd size="s">Enter</Kbd>
          {{ labels.select }}
        </span>

        <span data-slot="command-palette-hint">
          <Kbd size="s">Esc</Kbd>
          {{ labels.close }}
        </span>
      </footer>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ArrowDownIcon, ArrowUpIcon } from "@lucide/vue"
import { Command } from "@ui-sdk/vue/command"
import { Dialog, DialogBackdrop, DialogContent, DialogTitle } from "@ui-sdk/vue/dialog"
import { useUiLabels } from "../../core/config.js"
import { Kbd } from "../kbd/index.js"

defineProps<{ open: boolean; title: string }>()

const emit = defineEmits<{ "update:open": [open: boolean] }>()
const query = defineModel<string>("query", { default: "" })
const labels = useUiLabels()
</script>

<style>
:where([data-command-palette]) {
  position: fixed;
  inset-block: max(10vh, var(--space-md)) auto;
  inset-inline: var(--space-md);
  display: flex;
  max-width: 36rem;
  max-height: 26.25rem;
  min-height: 0;
  flex-direction: column;
  margin-inline: auto;
  padding: 0;
  overflow: hidden;
}

:where([data-command-palette-body]) {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
}

:where([data-slot="command-palette-footer"]) {
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

:where([data-slot="command-palette-hint"]) {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2xs);
}

:where([data-slot="command-palette-hint"] > [data-slot="kbd"]) {
  min-width: var(--control-2xs);
  height: var(--control-2xs);
  padding-inline: var(--space-2xs);
  border-radius: var(--radius-min);
  background: var(--glass-kbd-bg);
  box-shadow: none;
  color: var(--fg);
  font-family: var(--font-sans);
  font-size: var(--text-meta);
  font-weight: var(--font-weight-medium);
}

:where([data-slot="command-palette-hint"] > [data-slot="kbd"] svg) {
  width: var(--icon-sm);
  height: var(--icon-sm);
}
</style>
