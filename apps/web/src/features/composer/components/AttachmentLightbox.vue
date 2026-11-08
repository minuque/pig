<template>
  <Dialog :open="true" @update:open="emit('close')">
    <DialogContent
      class="lightbox"
      :aria-label="t('common.preview', { name })"
      :show-close-button="false"
      @click.self="emit('close')"
    >
      <img class="lightbox-img" :src="url" :alt="name" />
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { useI18n } from "@i18n/index.js"
import { Dialog, DialogContent } from "@components/ui/dialog/index.js"

const { t } = useI18n()

defineProps<{
  url: string
  name: string
}>()

const emit = defineEmits<{
  close: []
}>()
</script>

<style>
/* 不写 scoped：DialogContent 经 Portal 到 body，scoped attribute 打不中。
   rt 的对话框靠外层 padding 居中，这里改成铺满视口、图片自己居中。 */
.lightbox {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  max-inline-size: none;
  max-block-size: none;
  padding: var(--space-xl);
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  cursor: zoom-out;
}

.lightbox-img {
  max-width: 100%;
  max-height: 100%;
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-modal);
}
</style>
