<template>
  <Dialog v-model:open="open">
    <DialogContent
      v-bind="$attrs"
      class="preview-dialog"
      :data-kind="shownSrc ? 'image' : undefined"
      :aria-describedby="undefined"
      @keydown.left="step(-1)"
      @keydown.right="step(1)"
    >
      <!-- 头部不随正文滚动；高度取图标高，与弹框自带的关闭按钮同一中线 -->
      <header class="preview-header">
        <DialogTitle class="preview-title">
          <span class="preview-name">{{ shownTitle }}</span>
          <span v-if="shownMeta" class="preview-meta">{{ shownMeta }}</span>
        </DialogTitle>

        <div v-if="gallery" class="preview-pager">
          <IconButton variant="ghost" size="s" :aria-label="t('common.previous')" @click="step(-1)">
            <ChevronLeftIcon class="size-icon" />
          </IconButton>

          <span class="preview-count">{{ index + 1 }} / {{ images!.length }}</span>

          <IconButton variant="ghost" size="s" :aria-label="t('common.next')" @click="step(1)">
            <ChevronRightIcon class="size-icon" />
          </IconButton>
        </div>

        <slot name="actions" />
      </header>

      <div class="preview-body">
        <img
          v-if="shownSrc"
          :src="shownSrc"
          :alt="shownTitle"
          class="preview-image"
          @load="measure"
        />

        <slot v-else />
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, ref } from "vue"
import { useI18n } from "@i18n/index.js"
import { IconButton } from "@components/ui/button/index.js"
import { Dialog, DialogContent, DialogTitle } from "@components/ui/dialog/index.js"
import { ChevronLeftIcon, ChevronRightIcon } from "@components/icons/index.js"

defineOptions({ inheritAttrs: false })

export type PreviewImage = { src: string; title: string }

/** 传 src 时正文是这张图，副标题自动取图片像素尺寸；传 images 时多图轮播；否则正文走默认插槽。 */
const props = defineProps<{
  title: string
  meta?: string
  src?: string
  images?: readonly PreviewImage[]
}>()
const open = defineModel<boolean>("open", { default: false })
const index = defineModel<number>("index", { default: 0 })
const { t } = useI18n()
const current = computed(() => props.images?.[index.value])
const shownSrc = computed(() => current.value?.src ?? props.src)
const shownTitle = computed(() => current.value?.title ?? props.title)
const gallery = computed(() => (props.images?.length ?? 0) > 1)

/** 首尾相接：最后一张再往后回到第一张。 */
function step(delta: number) {
  const count = props.images?.length ?? 0

  if (count < 2) return
  index.value = (index.value + delta + count) % count
}

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
  gap: var(--space-2xl);
  height: var(--icon-md);
  padding-inline-end: calc(var(--icon-md) + var(--space-md));
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

.preview-pager {
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--space-2xs);
}

.preview-count {
  color: var(--fg-secondary);
  font-size: var(--text-meta);
  font-variant-numeric: tabular-nums;
}

.preview-meta {
  flex-shrink: 0;
  color: var(--fg-secondary);
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
  max-height: calc(90vh - 2 * var(--dialog-content-padding) - var(--icon-md) - var(--space-md));
  margin-inline: auto;
  border-radius: var(--radius-card);
  outline: var(--border-width) solid var(--border-subtle);
  outline-offset: -1px;
}
</style>

<style>
/* 面板经 Portal 挂到 body，scoped 打不中；面板自身不滚动，滚动只在正文 */
.preview-dialog[data-slot="dialog-content"] {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  overflow: hidden;
}

.preview-dialog[data-slot="dialog-content"][data-kind="image"] {
  inline-size: fit-content;
  max-inline-size: calc(100vw - 2rem);
  max-block-size: 90vh;
}
</style>
