<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-[24rem]">
      <div class="flex flex-col gap-(--spacing-xs)">
        <DialogTitle>{{ t("session.rename") }}</DialogTitle>
      </div>

      <input
        ref="inputEl"
        v-model="draft"
        class="rename-input"
        type="text"
        :placeholder="title"
        @keydown.enter.prevent="confirm"
        @keydown.escape.prevent="open = false"
      />

      <div class="flex flex-col-reverse gap-(--spacing-xs) sm:flex-row sm:justify-end">
        <DialogClose as-child>
          <button class="btn" type="button">{{ t("common.cancel") }}</button>
        </DialogClose>

        <button class="btn primary" type="button" @click="confirm">{{ t("common.save") }}</button>
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from "vue"
import { useI18n } from "@i18n/index.js"
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@components/ui/dialog/index.js"

const props = defineProps<{
  title: string
}>()
const { t } = useI18n()
const open = defineModel<boolean>("open", { default: false })
const emit = defineEmits<{
  confirm: [name: string]
}>()
const draft = ref(props.title)
const inputEl = ref<HTMLInputElement | null>(null)

watch(open, async (v) => {
  if (!v) return
  draft.value = props.title
  await nextTick()
  inputEl.value?.focus()
  inputEl.value?.select()
})

function confirm() {
  emit("confirm", draft.value)
  open.value = false
}
</script>

<style scoped>
.rename-input {
  width: 100%;
  height: var(--size-nav-rail);
  margin-block: var(--spacing-xs);
  padding: 0 var(--spacing-xs);
  border: 0;
  border-radius: var(--radius-md);
  background: var(--interaction-hover);
  color: var(--contrast-foreground);
  font-size: var(--text-caption);
  line-height: var(--text-caption--line-height);
  outline: none;
  box-shadow: inset 0 0 0 1px var(--border);
}

.rename-input:focus {
  box-shadow: inset 0 0 0 1px var(--primary);
}

.btn {
  padding: var(--spacing-xxs) var(--spacing-sm);
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--contrast-foreground);
  font-size: var(--text-caption);
}

.btn:hover {
  background: var(--hover-quiet);
}

.btn.primary {
  background: var(--primary);
  color: var(--primary-foreground);
}

.btn.primary:hover {
  background: var(--primary-hover);
}
</style>
