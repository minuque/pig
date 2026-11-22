<template>
  <div class="composer" @mousedown="onComposerMousedown">
    <div class="composer-plates">
      <CommandMenu
        v-if="commandMenu.open.value"
        :groups="commandMenu.groups.value"
        :active-id="commandMenu.activeId.value"
        :loading="commandMenu.loading.value"
        :empty-text="commandMenu.emptyText.value"
        :aria-label="commandMenuAriaLabel"
        @select="commandMenu.select"
        @highlight="(id) => (commandMenu.activeId.value = id)"
      />

      <slot name="plate" />
    </div>

    <div class="composer-card">
      <div class="body">
        <div v-if="$slots.attachments" class="attachments">
          <slot name="attachments" />
        </div>

        <div class="field-wrap">
          <PromptField
            ref="field"
            v-model="prompt"
            :aria-placeholder="placeholderText"
            :aria-controls="commandMenu.open.value ? 'composer-command-menu' : undefined"
            :aria-activedescendant="commandMenuActiveId"
            @caret="caret = $event"
            @keydown="onEditorKeydown"
            @paste-files="emit('pasteFiles', $event)"
            @composing="composing = $event"
            @blur="commandMenu.close()"
          />

          <div v-if="showPlaceholder" class="field-placeholder" aria-hidden="true">
            <template v-if="props.placeholder">{{ props.placeholder }}</template>

            <template v-else>
              <span>{{ t("composer.placeholderPrefix") }}</span>
              <Kbd size="s" variant="surface" class="placeholder-key">/</Kbd>
              <span>{{ t("composer.placeholderCommand") }}</span>
              <Kbd size="s" variant="surface" class="placeholder-key">@</Kbd>
              <span>{{ t("composer.placeholderMention") }}</span>
            </template>
          </div>
        </div>
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
import { useI18n } from "@i18n/index.js"
import { Kbd } from "@components/ui/kbd/index.js"
import { useCommandMenu } from "@features/composer/hooks/use-command-menu.js"
import CommandMenu from "@features/composer/components/CommandMenu.vue"
import PromptField from "@features/composer/components/PromptField.vue"

const props = withDefaults(
  defineProps<{
    placeholder?: string | undefined
    cwd?: string | undefined
  }>(),
  {
    placeholder: undefined,
    cwd: undefined,
  },
)
const { t } = useI18n()
const prompt = defineModel<string>("prompt", { required: true })
const emit = defineEmits<{
  submit: []
  pasteFiles: [files: File[]]
}>()
const field = useTemplateRef("field")
const hasText = computed(() => prompt.value.length > 0)
const composing = ref(false)
const showPlaceholder = computed(() => !hasText.value && !composing.value)
const placeholderText = computed(() => props.placeholder ?? t("composer.placeholder"))
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

.composer-plates {
  position: relative;
  margin-inline: var(--space-md);
}

.composer-plates:has(.command-menu) :slotted(.turn-status) {
  border-radius: 0;
}

.composer-card {
  display: flex;
  position: relative;
  flex-direction: column;
  overflow: hidden;
  border-radius: var(--composer-radius);
  background: var(--composer-bg);
  backdrop-filter: var(--glass-filter);
  box-shadow:
    0 0 0 var(--border-width) var(--composer-border),
    var(--composer-inset),
    var(--composer-shadow);
  corner-shape: var(--composer-corner-shape);
  transition: box-shadow var(--duration-fast) var(--ease-out);
}

.composer-card:hover,
.composer-card:has(.field:focus) {
  box-shadow:
    0 0 0 var(--border-width) var(--composer-border-hover),
    var(--composer-inset),
    var(--composer-shadow);
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

.field-wrap {
  position: relative;
  width: 100%;
}

.field-placeholder {
  position: absolute;
  inset-block-start: 0;
  inset-inline: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  color: var(--fg-muted);
  font-size: var(--text-body);
  line-height: 1.625;
  pointer-events: none;
  user-select: none;
}

.placeholder-key[data-slot="kbd"] {
  top: 0;
  min-inline-size: 18px;
  block-size: 18px;
  margin-inline: var(--space-2xs);
  padding: 0 var(--space-2xs);
  border-radius: calc(var(--radius-control) * 0.7);
  background-color: var(--bg-muted);
  box-shadow:
    inset 0 0 0 var(--border-width) var(--border),
    inset 0 -1px 0 var(--border-strong);
  color: var(--fg-secondary);
  font-family: var(--font-mono);
  font-size: var(--text-meta);
  font-weight: var(--font-weight-medium);
  line-height: 1;
}

@media (prefers-reduced-motion: reduce) {
  .composer-card {
    transition: none;
  }
}
</style>
