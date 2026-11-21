<template>
  <div class="composer" @mousedown="onComposerMousedown">
    <Transition name="menu-reveal">
      <CommandMenu
        v-if="commandMenu.open.value"
        class="command-menu-float"
        :groups="commandMenu.groups.value"
        :active-id="commandMenu.activeId.value"
        :loading="commandMenu.loading.value"
        :empty-text="commandMenu.emptyText.value"
        :aria-label="commandMenuAriaLabel"
        @select="commandMenu.select"
        @highlight="(id) => (commandMenu.activeId.value = id)"
      />
    </Transition>

    <div class="composer-card">
      <div class="body">
        <div v-if="$slots.attachments" class="attachments">
          <slot name="attachments" />
        </div>

        <PromptField
          ref="field"
          v-model="prompt"
          :placeholder="placeholder"
          :aria-controls="commandMenu.open.value ? 'composer-command-menu' : undefined"
          :aria-activedescendant="commandMenuActiveId"
          @caret="caret = $event"
          @keydown="onEditorKeydown"
          @paste-files="emit('pasteFiles', $event)"
          @blur="commandMenu.close()"
        />
      </div>

      <div class="footer">
        <div class="cluster left">
          <slot name="left" />
        </div>

        <div class="cluster tools">
          <slot name="tools" />
        </div>

        <div class="cluster right">
          <slot name="right" />
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
export function shouldSubmitOnKeydown(e: {
  key: string
  shiftKey: boolean
  isComposing: boolean
}): boolean {
  return e.key === "Enter" && !e.shiftKey && !e.isComposing
}
</script>

<script setup lang="ts">
import { computed, ref, useTemplateRef } from "vue"
import { useCommandMenu } from "@features/composer/hooks/use-command-menu.js"
import CommandMenu from "@features/composer/components/CommandMenu.vue"
import PromptField from "@features/composer/components/PromptField.vue"
import { promptPlaceholder } from "@features/composer/index.js"

const props = withDefaults(
  defineProps<{
    placeholder?: string
    cwd?: string | undefined
  }>(),
  {
    placeholder: promptPlaceholder(),
    cwd: undefined,
  },
)
const prompt = defineModel<string>("prompt", { required: true })
const emit = defineEmits<{
  submit: []
  pasteFiles: [files: File[]]
}>()
const field = useTemplateRef("field")
const hasText = computed(() => prompt.value.length > 0)
const caret = ref(0)
const commandMenu = useCommandMenu(
  prompt,
  caret,
  () => props.cwd,
  (chip) => field.value?.insertChip(chip),
)
const commandMenuAriaLabel = computed(() => "输入卡命令")
const commandMenuActiveId = computed(() => {
  const id = commandMenu.activeId.value
  return id ? `composer-command-menu-row-${encodeURIComponent(id)}` : undefined
})

function focus() {
  field.value?.focus()
}

function onEditorKeydown(e: KeyboardEvent) {
  if (commandMenu.onKeydown(e)) return

  if (e.key === "Escape" && !e.isComposing && !hasText.value) field.value?.blur()

  if (shouldSubmitOnKeydown(e)) {
    e.preventDefault()
    emit("submit")
  }
}

function onComposerMousedown(e: MouseEvent) {
  const el = e.target

  if (!(el instanceof Element)) return

  if (el.closest("button, input, textarea, a, [role='menuitem']")) return
  e.preventDefault()
  focus()
}

defineExpose({ focus })
</script>

<style scoped>
.composer {
  position: relative;
  width: 100%;
  margin-inline: auto;
}

.command-menu-float {
  margin-bottom: var(--space-2xs);
}

.composer-card {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: var(--composer-radius);
  background: var(--composer-bg);
  box-shadow:
    inset 0 0 0 var(--border-width) var(--composer-border),
    var(--composer-inset),
    var(--composer-shadow);
  corner-shape: var(--composer-corner-shape);
  transition:
    background-color var(--duration-fast) var(--ease-out),
    box-shadow var(--duration-fast) var(--ease-out);
}

.composer-card:hover {
  box-shadow:
    inset 0 0 0 var(--border-width) var(--composer-border-hover),
    var(--composer-inset),
    var(--composer-shadow);
}

.composer-card:has(.field:focus) {
  background: var(--composer-focus-bg);
  box-shadow:
    inset 0 0 0 var(--border-width) var(--composer-border-hover),
    var(--composer-focus-shadow);
}

.body {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  min-width: 0;
  padding: var(--space-md) var(--space-md) var(--space-xs);
}

.attachments {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
}

.footer {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  min-width: 0;
  padding: 0 var(--space-xs) var(--space-xs);
}

.cluster {
  display: flex;
  align-items: center;
  gap: var(--space-2xs);
  flex: none;
  min-width: 0;
}

.cluster.tools {
  flex: 1 1 auto;
  justify-content: flex-end;
  margin-inline-end: var(--space-2xs);
}

.cluster.right {
  gap: var(--space-xs);
}

@media (prefers-reduced-motion: reduce) {
  .composer-card {
    transition: none;
  }
}
</style>
