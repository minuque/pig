<template>
  <TriggerMenu
    v-bind="field?.triggerEditor ? { editor: field.triggerEditor } : {}"
    :triggers="commandMenu.triggers"
    :controller="menuController"
    @select="commandMenu.onSelect"
    @open-change="onMenuOpenChange"
  >
    <TriggerMenuContent
      data-menu-content
      class="reveal-menu command-menu"
      :anchor="composer"
      side="top"
      align="start"
      :side-offset="8"
      @mousedown.prevent
    >
      <CommandMenu
        :rows="commandMenu.rows.value"
        :empty-text="commandMenu.emptyText(menuTrigger)"
      />
    </TriggerMenuContent>

    <div ref="composer" class="composer" @mousedown="onComposerMousedown">
      <div v-show="!menuOpen" class="composer-plates">
        <slot name="plate" />
      </div>

      <div class="composer-card">
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
              <Kbd variant="soft">Esc</Kbd>
            </Button>
          </div>

          <slot name="attachments" />

          <div class="field-wrap">
            <PromptField
              ref="field"
              v-model="prompt"
              :disabled="props.disabled"
              :aria-placeholder="placeholderText"
              :menu-open="menuOpen"
              @caret="onCaret"
              @keydown="onEditorKeydown"
              @paste-files="emit('pasteFiles', $event)"
              @composing="composing = $event"
              @open-file="emit('openFile', $event)"
              @jump-reply="emit('jumpReply', $event)"
              @submit="emit('submit')"
            />

            <div v-if="showPlaceholder" class="field-placeholder" aria-hidden="true">
              <template v-if="props.placeholder">{{ props.placeholder }}</template>

              <template v-else-if="props.running">
                <span>{{ t("composer.placeholderPrefix") }}</span>
                <Kbd variant="soft">Enter</Kbd>
                <span>{{ t("composer.placeholderQueue") }}</span>
                <Kbd variant="soft">{{ modKey }}</Kbd>
                <span>+</span>
                <Kbd variant="soft">Enter</Kbd>
                <span>{{ t("composer.placeholderSteer") }}</span>
              </template>

              <template v-else>
                <span>{{ t("composer.placeholderPrefix") }}</span>
                <Kbd variant="soft">/</Kbd>
                <span>{{ t("composer.placeholderCommand") }}</span>
                <Kbd variant="soft">@</Kbd>
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
  </TriggerMenu>
</template>

<script lang="ts">
export { shouldSubmitOnKeydown } from "@features/composer/hooks/use-composer-shortcuts.js"
</script>

<script setup lang="ts">
import { computed, ref, useTemplateRef } from "vue"
import { useI18n } from "@i18n/index.js"
import { Button } from "@pig/ui/button"
import { Kbd } from "@pig/ui/kbd"
import { useCommandMenu } from "@features/composer/hooks/use-command-menu.js"
import {
  shouldSubmitOnKeydown,
  useComposerShortcuts,
} from "@features/composer/hooks/use-composer-shortcuts.js"
import { TriggerMenu, TriggerMenuContent, createTriggerMenuController } from "@pig/ui/trigger-menu"
import CommandMenu from "@features/composer/components/CommandMenu.vue"
import PromptField from "@features/composer/components/PromptField.vue"
import type { ComposerCaret, MentionSession, ReplyInsertRequest } from "@features/composer/type.js"

const props = defineProps<{
  placeholder?: string | undefined
  running?: boolean
  cwd?: string | undefined
  hasSession?: boolean
  reloadRevision?: number | undefined
  mentionSessions?: ((query: string) => readonly MentionSession[]) | undefined
  editingQueue?: boolean
  disabled?: boolean
  disabledReason?: string | undefined
}>()
const { t } = useI18n()
const modKey = /mac/i.test(navigator.platform || navigator.userAgent) ? "⌘" : "Ctrl"
const prompt = defineModel<string>("prompt", { required: true })
const emit = defineEmits<{
  submit: []
  pasteFiles: [files: File[]]
  openFile: [path: string]
  jumpReply: [target: { sessionId: string; entryId: string; text?: string | undefined }]
  cancelQueueEdit: []
  historyPrev: []
  historyNext: []
}>()
const field = useTemplateRef("field")
const composing = ref(false)
const caret = ref(0)
const inCode = ref(false)
const showPlaceholder = computed(() => !prompt.value.length && !composing.value)
const placeholderText = computed(() => props.placeholder ?? t("composer.placeholder"))
const composer = useTemplateRef<HTMLElement>("composer")
const menuOpen = ref(false)
const menuTrigger = ref<string | null>(null)
const menuController = createTriggerMenuController()
const commandMenu = useCommandMenu({
  prompt,
  caret,
  markdownOffset: (pos) => field.value?.markdownOffset(pos) ?? 0,
  inCode: () => inCode.value,
  cwd: () => props.cwd,
  hasSession: () => props.hasSession ?? false,
  reloadRevision: () => props.reloadRevision,
  mentionSessions: (query) => props.mentionSessions?.(query) ?? [],
  onChip: (chip) => field.value?.insertChip(chip),
  onReplaceText: (start, triggerLength, text) =>
    field.value?.replaceRange(start, triggerLength, text),
})
const shortcuts = useComposerShortcuts({
  menuOpen: () => menuOpen.value,
  closeMenu: () => menuController.close(),
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
  inCode.value = payload.inCode
}

function onMenuOpenChange(
  open: boolean,
  details: { trigger: string | null; canceled?: boolean; cancel(): void },
) {
  commandMenu.onOpenChange(open, details)

  if (details.canceled) return
  menuOpen.value = open
  menuTrigger.value = details.trigger
}

function onEditorKeydown(event: KeyboardEvent) {
  if (shortcuts.onKeydown(event)) return

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

const insertMarkdown = (text: string) => field.value?.insertMarkdown(text)
const insertReply = (request: ReplyInsertRequest) => field.value?.insertReply(request)
const replyCommentOpen = computed(() => field.value?.replyCommentOpen ?? false)

defineExpose({
  focus,
  insertMarkdown,
  insertReply,
  replyCommentOpen,
  menuOpen,
  steerHeld: shortcuts.steerHeld,
})
</script>

<style scoped>
.composer {
  position: relative;
  width: 100%;
  margin-inline: auto;
}

.command-menu {
  inline-size: var(--anchor-width);
  max-block-size: min(280px, var(--available-height));
  font-size: var(--text-body);
}

.composer-plates {
  position: relative;
  margin-inline: var(--space-md);
}

.composer-card {
  position: relative;
  overflow: hidden;
  container-type: inline-size;
  border-radius: var(--composer-radius);
  background: var(--composer-bg);
  backdrop-filter: var(--glass-filter);
  box-shadow: var(--float-shadow);
}

.composer-card:hover,
.composer-card:has(.field-wrap:focus-within) {
  box-shadow:
    0 0 0 var(--border-width) var(--float-ring-hover),
    var(--float-elevation);
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

.field-placeholder > [data-slot="kbd"] {
  margin-inline: var(--space-2xs);
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
  gap: var(--space-xs);
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
