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

      <div v-else-if="pending.request.method === 'editor'" class="extension-body">
        <Textarea v-model="text" class="extension-editor" autofocus />
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
} from "@pig/ui/alert-dialog"
import { Button } from "@pig/ui/button"
import { TextFieldRoot } from "@pig/ui/text-field"
import { Textarea } from "@pig/ui/textarea"
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

.extension-editor {
  min-block-size: var(--composer-field-max);
}
</style>
