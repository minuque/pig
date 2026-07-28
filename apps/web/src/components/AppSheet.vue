<script setup lang="ts">
import { nextTick, ref, useId, watch } from "vue";

/**
 * Accessible modal sheet/dialog. Focus enters the panel on open, Tab is
 * contained within it, Escape and backdrop clicks close it, and focus returns
 * to the trigger element on close. Used for narrow-width navigation sheets
 * and all modal flows (register workspace, provider auth).
 */
const props = defineProps<{ open: boolean; title: string }>();
const emit = defineEmits<{ close: [] }>();

const panel = ref<HTMLElement | null>(null);
const titleId = useId();
let previousFocus: HTMLElement | null = null;

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

watch(
  () => props.open,
  async (open) => {
    if (open) {
      previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      await nextTick();
      panel.value?.focus();
    } else {
      previousFocus?.focus();
      previousFocus = null;
    }
  },
);

function onKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    event.preventDefault();
    emit("close");
    return;
  }
  if (event.key !== "Tab") return;
  const root = panel.value;
  if (!root) return;
  const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));
  if (items.length === 0) {
    event.preventDefault();
    return;
  }
  const first = items[0]!;
  const last = items[items.length - 1]!;
  const active = document.activeElement;
  if (event.shiftKey && (active === first || active === root)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

function onBackdropClick(event: MouseEvent): void {
  if (event.target === event.currentTarget) emit("close");
}
</script>

<template>
  <Teleport to="body">
    <!-- biome-ignore lint/a11y/noStaticElementInteractions: The backdrop closes only on self-click; the dialog owns keyboard focus. -->
    <div v-if="open" class="sheet-backdrop" @click="onBackdropClick" @keydown="onKeydown">
      <div
        ref="panel"
        class="sheet-panel"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        tabindex="-1"
      >
        <header class="sheet-header">
          <h2 :id="titleId" class="sheet-title">{{ title }}</h2>
          <button type="button" class="sheet-close" aria-label="关闭" @click="emit('close')">
            ×
          </button>
        </header>
        <div class="sheet-body">
          <slot />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.sheet-backdrop {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: var(--color-backdrop);
}

.sheet-panel {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 560px;
  max-height: 85%;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-panel) var(--radius-panel) 0 0;
  box-shadow: var(--shadow-overlay);
  outline: none;
}

.sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-2) var(--space-2) var(--space-4);
  border-bottom: 1px solid var(--color-border);
}

.sheet-title {
  font-size: var(--text-md);
}

.sheet-close {
  min-width: var(--target-min);
  min-height: var(--target-min);
  border: 0;
  background: transparent;
  font-size: var(--text-lg);
  border-radius: var(--radius-control);
}

.sheet-close:hover {
  background: var(--color-surface-muted);
}

.sheet-body {
  padding: var(--space-4);
  overflow-y: auto;
}

@media (min-width: 901px) {
  .sheet-backdrop {
    align-items: center;
  }

  .sheet-panel {
    border-radius: var(--radius-panel);
  }
}
</style>
