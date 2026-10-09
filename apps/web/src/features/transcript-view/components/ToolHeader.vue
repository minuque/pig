<template>
  <div class="tool-header-pin">
    <div ref="header" class="tool-header" @pointerenter="arm" @focusin="armFromFocus">
      <div class="heading">
        <slot>
          <span class="label" :title="label">{{ label }}</span>
        </slot>
      </div>

      <div class="actions">
        <div v-if="$slots.meta" class="meta">
          <slot name="meta" />
        </div>

        <LazyTip
          v-if="lineNumbers"
          :tip="showLineNumbers ? t('transcript.lineNumbersHide') : t('transcript.lineNumbersShow')"
        >
          <Button
            type="button"
            variant="outline"
            size="icon-2xs"
            class="icon-btn"
            :aria-label="
              showLineNumbers ? t('transcript.lineNumbersHide') : t('transcript.lineNumbersShow')
            "
            :aria-pressed="showLineNumbers"
            @click.stop="showLineNumbers = !showLineNumbers"
          >
            <ListOrderedMinimalisticIcon class="size-3.5" />
          </Button>
        </LazyTip>

        <LazyTip :tip="softWrap ? t('transcript.softWrapOff') : t('transcript.softWrap')">
          <Button
            type="button"
            variant="outline"
            size="icon-2xs"
            class="icon-btn"
            :aria-label="softWrap ? t('transcript.softWrapOff') : t('transcript.softWrap')"
            :aria-pressed="softWrap"
            @click.stop="softWrap = !softWrap"
          >
            <ParagraphSpacingIcon v-if="!softWrap" class="size-3.5" />
            <AlignLeftIcon v-else class="size-3.5" />
          </Button>
        </LazyTip>

        <LazyTip v-if="text" :tip="copyLabel">
          <Button
            type="button"
            variant="outline"
            size="icon-2xs"
            class="icon-btn copy"
            :class="{ 'is-copied': status === 'copied', 'is-error': status === 'error' }"
            :aria-label="copyLabel"
            @click="copy"
          >
            <span class="icon-swap">
              <CopyIcon class="size-3.5" :data-visible="status !== 'copied'" />
              <CheckIcon class="size-3.5" :data-visible="status === 'copied'" />
            </span>
          </Button>
        </LazyTip>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, h, nextTick, shallowRef, useTemplateRef, type FunctionalComponent } from "vue"
import { useTimeoutFn } from "@vueuse/core"
import { useI18n } from "@i18n/index.js"
import { Button } from "@components/ui/button/index.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"
import {
  AlignLeftIcon,
  CheckIcon,
  CopyIcon,
  ListOrderedMinimalisticIcon,
  ParagraphSpacingIcon,
} from "@components/icons/index.js"

const { t } = useI18n()
const props = defineProps<{
  label: string
  text: string
  lineNumbers?: boolean
}>()
const softWrap = defineModel<boolean>("softWrap", { default: false })
const showLineNumbers = defineModel<boolean>("showLineNumbers", { default: false })
const status = shallowRef<"idle" | "copied" | "error">("idle")
const copyLabel = computed(() =>
  status.value === "copied"
    ? t("common.copied")
    : status.value === "error"
      ? t("common.copyFailed")
      : t("common.copyContent", { label: props.label }),
)
const header = useTemplateRef("header")
const armed = shallowRef(false)
/** 指针进入或聚焦前只渲染按钮，省掉每张卡片的 Tooltip 挂载。 */
const LazyTip: FunctionalComponent<{ tip: string }> = (tipProps, { slots }) =>
  armed.value
    ? h(Tooltip, null, {
        default: () => [
          h(TooltipTrigger, { asChild: true }, slots),
          h(TooltipContent, null, () => tipProps.tip),
        ],
      })
    : slots.default?.()

function arm() {
  armed.value = true
}

/** 切换会重建按钮，按下标恢复键盘焦点。 */
async function armFromFocus(event: FocusEvent) {
  if (armed.value || !header.value) return
  const buttons = [...header.value.querySelectorAll("button")]
  const at = buttons.indexOf(event.target as HTMLButtonElement)
  arm()
  await nextTick()
  header.value?.querySelectorAll("button")[at]?.focus()
}

const { start, stop } = useTimeoutFn(() => (status.value = "idle"), 1500, { immediate: false })

async function copy() {
  stop()

  try {
    await navigator.clipboard.writeText(props.text)
    status.value = "copied"
    start()
  } catch {
    status.value = "error"
  }
}
</script>

<style scoped>
.tool-header-pin {
  position: sticky;
  top: calc(var(--tool-summary-offset, var(--size-icon-button)) + var(--size-icon-button));
  z-index: 1;
  width: 100%;
  min-width: 0;
  container-type: scroll-state;
}

.tool-header {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
  min-width: 0;
  padding: 0.4rem 0.4rem 0.4rem 0.6rem;
  border-bottom: var(--border-width) solid var(--border);
  border-start-start-radius: var(--radius-code);
  border-start-end-radius: var(--radius-code);
  background: var(--code-surface);
  font-size: var(--text-caption);
  transition:
    border-start-start-radius var(--duration-fast) var(--ease-out),
    border-start-end-radius var(--duration-fast) var(--ease-out);
}

@container scroll-state(stuck: top) {
  .tool-header {
    border-start-start-radius: 0;
    border-start-end-radius: 0;
    border-block-start: var(--border-width) solid var(--border);
  }
}

@media (prefers-reduced-motion: reduce) {
  .tool-header {
    transition: none;
  }
}

.heading {
  flex: 1;
  min-width: 0;
}

.label {
  display: block;
  overflow: hidden;
  color: var(--ink);
  font-family: var(--font-mono);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.actions {
  display: flex;
  flex: none;
  align-items: center;
  gap: 2px;
  color: var(--ink-muted);
  white-space: nowrap;
}

/* 计数文本和右侧按钮组之间多留一点，和按钮图标的视觉间距对齐 */
.meta {
  display: inline-flex;
  align-items: center;
  margin-inline-end: var(--spacing-xxs);
}

.icon-btn,
.copy {
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: var(--radius-xs);
  background: transparent;
  color: var(--ink-secondary);
  box-shadow: none;
  font-size: inherit;
  font-weight: var(--font-weight-regular);
}

.icon-btn:hover,
.copy:hover {
  background: var(--hover-quiet);
  color: var(--ink);
}

.copy.is-copied {
  color: var(--success);
}

.copy.is-error {
  color: var(--danger);
}

.icon-swap {
  width: 14px;
  height: 14px;
}

@media (max-width: 480px) {
  .tool-header {
    flex-wrap: wrap;
  }

  .heading {
    flex-basis: 100%;
  }

  .actions {
    margin-inline-start: auto;
  }
}
</style>
