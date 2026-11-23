<template>
  <AlertDialog :open="Boolean(pending)" @update:open="(open: boolean) => !open && cancel()">
    <AlertDialogContent v-if="pending" class="extension-dialog">
      <AlertDialogHeader>
        <AlertDialogTitle>{{ pending.request.title }}</AlertDialogTitle>

        <AlertDialogDescription v-if="pending.request.method === 'confirm'">
          {{ pending.request.message }}
        </AlertDialogDescription>

        <AlertDialogDescription v-else-if="pending.request.method === 'select'">
          {{ t("extensionUi.choose") }}
        </AlertDialogDescription>
      </AlertDialogHeader>

      <div v-if="pending.request.method === 'select'" class="extension-options extension-body">
        <Button
          v-for="option in pending.request.options"
          :key="option"
          variant="secondary"
          color="neutral"
          @click="reply({ id: pending.request.id, value: option })"
        >
          {{ option }}
        </Button>
      </div>

      <TextFieldRoot
        v-else-if="pending.request.method === 'input'"
        class="extension-body"
        v-model="text"
        :placeholder="pending.request.placeholder"
        autofocus
        @keydown.enter="reply({ id: pending.request.id, value: text })"
      />

      <div
        v-else-if="pending.request.method === 'editor'"
        class="extension-body extension-editor-box"
      >
        <textarea v-model="text" class="extension-editor" autofocus />
      </div>

      <AlertDialogFooter>
        <AlertDialogCancel @click="cancel">{{ t("common.cancel") }}</AlertDialogCancel>

        <Button
          v-if="pending.request.method === 'confirm'"
          @click="reply({ id: pending.request.id, confirmed: true })"
        >
          {{ t("extensionUi.confirm") }}
        </Button>

        <Button
          v-else-if="pending.request.method !== 'select'"
          @click="reply({ id: pending.request.id, value: text })"
        >
          {{ t("extensionUi.submit") }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue"
import type { ExtensionUiResponse } from "@pig/protocol"
import { useI18n } from "@i18n/index.js"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@components/ui/alert-dialog/index.js"
import { Button } from "@components/ui/button/index.js"
import { TextFieldRoot } from "@components/ui/text-field/index.js"
import { useExtensionUi } from "@features/extension-ui/index.js"

const { t } = useI18n()
const ui = useExtensionUi()
const pending = computed(() => ui.current())
const text = ref("")

watch(pending, (next) => {
  const request = next?.request
  text.value = request?.method === "editor" ? (request.prefill ?? "") : ""
})

function reply(response: ExtensionUiResponse) {
  if (pending.value) void ui.answer(pending.value, response)
}

function cancel() {
  if (pending.value) reply({ id: pending.value.request.id, cancelled: true })
}
</script>

<style scoped>
.extension-body {
  margin: 0 var(--space-lg) var(--space-lg);
}

.extension-options {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.extension-editor-box {
  padding: var(--space-xs);
  border-radius: var(--radius-control);
  background-color: var(--bg-raised);
  box-shadow: inset 0 0 0 var(--border-width) var(--border-input);
}

.extension-editor-box:focus-within {
  outline: 2px solid var(--focus-color);
  outline-offset: -1px;
}

.extension-editor {
  display: block;
  inline-size: 100%;
  min-block-size: var(--composer-field-max);
  border-radius: calc(var(--radius-control) - var(--border-width));
  background: transparent;
  color: inherit;
  font: inherit;
  resize: vertical;
}

.extension-editor:focus-visible {
  outline: none;
}
</style>
