<template>
  <AlertDialog :open="Boolean(pending)" @update:open="(open) => !open && cancel()">
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

      <div v-if="pending.request.method === 'select'" class="extension-options">
        <Button
          v-for="option in pending.request.options"
          :key="option"
          variant="soft"
          color="gray"
          @click="reply({ id: pending.request.id, value: option })"
        >
          {{ option }}
        </Button>
      </div>

      <TextFieldRoot
        v-else-if="pending.request.method === 'input'"
        v-model="text"
        :placeholder="pending.request.placeholder"
        autofocus
        @keydown.enter="reply({ id: pending.request.id, value: text })"
      />

      <div
        v-else-if="pending.request.method === 'editor'"
        class="rt-TextAreaRoot rt-variant-surface"
      >
        <textarea v-model="text" class="rt-reset rt-TextAreaInput extension-editor" autofocus />
      </div>

      <AlertDialogFooter>
        <AlertDialogCancel @click="cancel">{{ t("common.cancel") }}</AlertDialogCancel>

        <!-- 不用 AlertDialogAction：它先触发关闭，关闭回调会把这次回答当成取消 -->
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
.extension-options {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.extension-editor {
  min-block-size: var(--size-composer-field-max);
}
</style>
