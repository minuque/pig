<template>
  <Dialog v-model:open="open">
    <DialogContent
      v-bind="$attrs"
      class="preview-dialog"
      :data-kind="src ? 'image' : undefined"
      :aria-describedby="undefined"
    >
      <!-- 头部不随正文滚动；高度取图标高，与弹框自带的关闭按钮同一中线 -->
      <header class="preview-header">
        <DialogTitle class="preview-title">
          <span class="preview-name">{{ title }}</span>
          <span v-if="shownMeta" class="preview-meta">{{ shownMeta }}</span>
        </DialogTitle>

        <slot name="actions" />
      </header>

      <div class="preview-body">
        <img v-if="src" :src="src" :alt="title" class="preview-image" @load="measure" />
        <slot v-else />
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, ref } from "vue"
import { Dialog, DialogContent, DialogTitle } from "@components/ui/dialog/index.js"

defineOptions({ inheritAttrs: false })

/** 传 src 时正文是这张图，副标题自动取图片像素尺寸；否则正文走默认插槽。 */
const props = defineProps<{ title: string; meta?: string; src?: string }>()
const open = defineModel<boolean>("open", { default: false })
const imageSize = ref("")
const shownMeta = computed(() => props.meta || imageSize.value)

function measure(event: Event) {
  const img = event.target as HTMLImageElement
  imageSize.value = `${img.naturalWidth} × ${img.naturalHeight}`
}
</script>

<style scoped>
/* ghost 按钮自带等于内边距的负外边距，组间距要大过它才看得出分组；右侧给关闭按钮让位 */
.preview-header {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: var(--space-xxl);
  height: var(--size-icon);
  padding-inline-end: calc(var(--size-icon) + var(--space-md));
}

.preview-title {
  display: flex;
  flex: 1;
  align-items: baseline;
  min-width: 0;
  gap: var(--space-xs);
  margin: 0;
  font-size: var(--text-body);
  line-height: var(--text-body--line-height);
}

.preview-name {
  overflow: hidden;
  font-weight: var(--font-weight-semibold);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-meta {
  flex-shrink: 0;
  color: var(--contrast-foreground-faint);
  font-size: var(--text-meta);
  font-weight: var(--font-weight-normal);
}

.preview-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow: auto;
}

/* 整张图落在视口内：高度扣掉上下内边距、头部与间距 */
.preview-image {
  display: block;
  width: auto;
  max-width: 100%;
  height: auto;
  max-height: calc(90vh - 2 * var(--dialog-content-padding) - var(--size-icon) - var(--space-md));
  margin-inline: auto;
  border-radius: var(--radius-card);
  outline: var(--border-width) solid var(--border-soft);
  outline-offset: -1px;
}
</style>

<style>
/* 面板经 Portal 挂到 body，scoped 打不中；面板自身不滚动，滚动只在正文 */
.preview-dialog.rt-DialogContent {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  overflow: hidden;
}

.preview-dialog.rt-DialogContent[data-kind="image"] {
  inline-size: fit-content;
  max-inline-size: calc(100vw - 2rem);
  max-block-size: 90vh;
}
</style>
