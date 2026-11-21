<template>
  <DialogRoot :open="open" @update:open="emit('update:open', $event)">
    <DialogPortal>
      <DialogOverlay class="glass-backdrop" />

      <div class="viewport">
        <DialogContent
          data-slot="command-palette"
          class="glass-panel"
          :aria-describedby="undefined"
        >
          <DialogTitle class="sr-only">{{ title }}</DialogTitle>

          <ListboxRoot ref="listbox" class="body" highlight-on-hover>
            <slot />
          </ListboxRoot>

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
      </div>
    </DialogPortal>
  </DialogRoot>
</template>

<script setup lang="ts">
import { nextTick, useTemplateRef, watch } from "vue"
import {
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  ListboxRoot,
} from "reka-ui"
import { useI18n } from "@i18n/index.js"
import { Kbd } from "@components/ui/kbd/index.js"
import { ArrowDownIcon, ArrowUpIcon } from "@components/icons/index.js"

const props = defineProps<{ open: boolean; title: string }>()
const emit = defineEmits<{ "update:open": [open: boolean] }>()
const { t } = useI18n()
const listbox = useTemplateRef<{ highlightFirstItem: () => void }>("listbox")

watch(
  () => props.open,
  (open) => open && nextTick(() => listbox.value?.highlightFirstItem()),
)
</script>

<style scoped>
.viewport {
  position: fixed;
  z-index: var(--z-modal);
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: max(10vh, var(--space-md)) var(--space-md) 10vh;
  pointer-events: none;
}

[data-slot="command-palette"] {
  display: flex;
  width: 100%;
  max-width: 36rem;
  max-height: 26.25rem;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  pointer-events: auto;
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
