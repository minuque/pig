<template>
  <div class="composer" @mousedown="onComposerMousedown">
    <CommandMenu
      v-if="commandMenu.open.value"
      :groups="commandMenu.groups.value"
      :active-id="commandMenu.activeId.value"
      :loading="commandMenu.loading.value"
      :empty-text="commandMenu.emptyText.value"
      :menu-id="commandMenu.menuId"
      :anchor-el="cardEl"
      @select="commandMenu.select"
      @highlight="(id) => (commandMenu.activeId.value = id)"
    />

    <div ref="cardEl" class="composer-card">
      <div class="body">
        <div v-if="props.editingQueue || props.disabledReason" class="notice" role="status">
          {{ props.editingQueue ? t("composer.queueEditing") : props.disabledReason }}
          <Button
            v-if="props.editingQueue"
            type="button"
            size="s"
            variant="ghost"
            color="neutral"
            @click="emit('cancelQueueEdit')"
          >
            {{ t("composer.queueEditCancel") }}
            <Kbd size="s" variant="soft">Esc</Kbd>
          </Button>
        </div>

        <slot name="attachments" />

        <div class="field-wrap">
          <PromptField
            ref="field"
            v-model="prompt"
            :disabled="props.disabled"
            :aria-placeholder="placeholderText"
            :aria-controls="commandMenu.open.value ? commandMenu.menuId : undefined"
            :aria-activedescendant="commandMenu.activeDescendantId.value"
            @caret="onCaret"
            @keydown="onEditorKeydown"
            @paste-files="emit('pasteFiles', $event)"
            @composing="composing = $event"
            @blur="commandMenu.close()"
            @open-file="emit('openFile', $event)"
          />

          <div v-if="showPlaceholder" class="field-placeholder" aria-hidden="true">
            <template v-if="props.placeholder">{{ props.placeholder }}</template>

            <template v-else>
              <span>{{ t("composer.placeholderPrefix") }}</span>
              <Kbd size="s" variant="soft">/</Kbd>
              <span>{{ t("composer.placeholderCommand") }}</span>
              <Kbd size="s" variant="soft">@</Kbd>
              <span>{{ t("composer.placeholderMention") }}</span>
            </template>
          </div>
        </div>
      </div>

      <div class="footer">
        <div class="cluster">
          <slot name="left" />
        </div>

        <div class="cluster tools">
          <slot name="tools" />
        </div>

        <div class="cluster">
          <slot name="right" />
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
export { shouldSubmitOnKeydown } from "@features/composer/hooks/use-composer-shortcuts.js"
</script>

<script setup lang="ts">
import { computed, ref, useTemplateRef } from "vue"
import { useI18n } from "@i18n/index.js"
import { Button } from "@components/ui/button/index.js"
import { Kbd } from "@components/ui/kbd/index.js"
import { useCommandMenu } from "@features/composer/hooks/use-command-menu.js"
import {
  shouldSubmitOnKeydown,
  useComposerShortcuts,
} from "@features/composer/hooks/use-composer-shortcuts.js"
import CommandMenu from "@features/composer/components/CommandMenu.vue"
import PromptField from "@features/composer/components/PromptField.vue"
import type { ComposerCaret } from "@features/composer/type.js"

const props = defineProps<{
  placeholder?: string | undefined
  cwd?: string | undefined
  editingQueue?: boolean
  disabled?: boolean
  disabledReason?: string | undefined
}>()
const { t } = useI18n()
const prompt = defineModel<string>("prompt", { required: true })
const emit = defineEmits<{
  submit: []
  pasteFiles: [files: File[]]
  openFile: [path: string]
  cancelQueueEdit: []
  historyPrev: []
  historyNext: []
}>()
const cardEl = useTemplateRef("cardEl")
const field = useTemplateRef("field")
const composing = ref(false)
const caret = ref(0)
const edited = ref(false)
const showPlaceholder = computed(() => !prompt.value.length && !composing.value)
const placeholderText = computed(() => props.placeholder ?? t("composer.placeholder"))
const commandMenu = useCommandMenu({
  prompt,
  caret,
  edited,
  cwd: () => props.cwd,
  onChip: (chip) => field.value?.insertChip(chip),
})
const shortcuts = useComposerShortcuts({
  menuOpen: () => commandMenu.open.value,
  closeMenu: () => commandMenu.dismiss(),
  cancelQueueEdit: () => {
    if (!props.editingQueue) return false
    emit("cancelQueueEdit")
    return true
  },
  hasText: () => prompt.value.length > 0,
  blur: () => field.value?.blur(),
  focus: () => focus(),
  pasteFiles: (files) => emit("pasteFiles", files),
  atStart: () => field.value?.isAtStart() ?? true,
  atEnd: () => field.value?.isAtEnd() ?? true,
  historyPrev: () => emit("historyPrev"),
  historyNext: () => emit("historyNext"),
})

function onCaret(payload: ComposerCaret) {
  caret.value = payload.offset
  edited.value = payload.edited
}

function onEditorKeydown(event: KeyboardEvent) {
  if (commandMenu.onKeydown(event) || shortcuts.onKeydown(event)) return

  if (!shouldSubmitOnKeydown(event)) return
  event.preventDefault()
  emit("submit")
}

const focus = () => field.value?.focus()

function onComposerMousedown(e: MouseEvent) {
  const control = "button, input, textarea, a, [role='menuitem']"

  if (e.target instanceof Element && e.target.closest(control)) return
  e.preventDefault()
  focus()
}

defineExpose({ focus, menuOpen: commandMenu.open, steerHeld: shortcuts.steerHeld })
</script>

<style scoped>
.composer-card {
  overflow: hidden;
  container-type: inline-size;
  border-radius: var(--composer-radius);
  background: var(--composer-bg);
  backdrop-filter: var(--glass-filter);
  box-shadow:
    0 0 0 var(--border-width) var(--composer-border),
    var(--composer-inset),
    var(--composer-shadow);
  corner-shape: var(--composer-corner-shape);
}

.composer-card:hover,
.composer-card:has(.field-wrap:focus-within) {
  box-shadow:
    0 0 0 var(--border-width) var(--composer-border-hover),
    var(--composer-inset),
    var(--composer-shadow);
}

.notice {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  color: var(--fg-secondary);
  font-size: var(--text-meta);
}

.body {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  padding: var(--space-md) var(--space-md) var(--space-xs);
}

.field-wrap {
  position: relative;
}

.field-placeholder {
  position: absolute;
  inset: 0 0 auto;
  color: var(--fg-muted);
  font-size: var(--text-body);
  line-height: 1.625;
  pointer-events: none;
}

.footer {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: 0 var(--space-xs) var(--space-xs);
}

.footer > * {
  display: flex;
  align-items: center;
  gap: var(--space-2xs);
  min-width: 0;
}

.footer > .tools {
  flex: 1 1 auto;
  justify-content: flex-end;
}

@container (max-width: 360px) {
  .footer {
    flex-wrap: wrap;
    row-gap: var(--space-2xs);
  }

  .footer > .tools {
    flex: 1 1 100%;
    justify-content: flex-start;
  }
}
</style>
