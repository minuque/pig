<template>
  <section
    v-if="board.board.value && question"
    ref="root"
    class="question-board"
    :aria-label="question.header"
  >
    <header class="board-head">
      <StatusIndicator status="waiting" size="s" />
      <span class="board-source">{{ question.header }}</span>

      <span v-if="total > 1" class="board-pager">
        <IconButton
          size="s"
          variant="ghost"
          color="neutral"
          :aria-label="t('extensionUi.previous')"
          :disabled="board.index.value === 0"
          @click="board.go(board.index.value - 1)"
        >
          <ChevronLeftIcon class="size-icon" />
        </IconButton>

        <span class="board-page">{{ board.index.value + 1 }}/{{ total }}</span>

        <IconButton
          size="s"
          variant="ghost"
          color="neutral"
          :aria-label="t('extensionUi.next')"
          :disabled="board.index.value === total - 1"
          @click="board.go(board.index.value + 1)"
        >
          <ChevronRightIcon class="size-icon" />
        </IconButton>
      </span>

      <IconButton
        size="s"
        variant="ghost"
        color="neutral"
        :aria-label="t('extensionUi.skip')"
        @click="board.skip"
      >
        <XIcon class="size-icon" />
      </IconButton>
    </header>

    <p v-if="question.question !== question.header || total > 1" class="board-question">
      {{ question.question }}
    </p>

    <pre v-if="question.message" class="board-message">{{ question.message }}</pre>

    <Listbox
      v-if="question.options.length"
      :key="`${board.board.value.id}-${board.index.value}`"
      class="board-options"
      :controller="list"
      activation="manual"
      :multiple="question.multiple"
      :value="question.multiple ? answer.picked : (answer.picked[0] ?? null)"
      :aria-label="question.question"
      :data-dimmed="typing || undefined"
      @value-change="onChange"
    >
      <ListboxItem
        v-for="(option, position) in question.options"
        :key="option.label"
        :value="option.label"
        class="board-option"
      >
        <Checkbox
          v-if="question.multiple"
          class="board-mark"
          size="s"
          :model-value="answer.picked.includes(option.label)"
          tabindex="-1"
          aria-hidden="true"
        />

        <Radio
          v-else
          class="board-mark"
          size="s"
          :value="option.label"
          :checked="answer.picked.includes(option.label)"
          tabindex="-1"
          aria-hidden="true"
        />

        <span class="board-option-text">
          <span class="board-option-label">{{ option.label }}</span>
          <span v-if="option.description" class="board-option-desc">{{ option.description }}</span>
        </span>

        <Kbd v-if="position < 9" class="board-key">{{ position + 1 }}</Kbd>
      </ListboxItem>
    </Listbox>

    <footer v-if="action && !action.locked" class="board-foot">
      <Button size="s" :disabled="!action.ready" @click="board.submit">{{ action.label }}</Button>
    </footer>
  </section>
</template>

<script setup lang="ts">
import { computed, useTemplateRef } from "vue"
import { useEventListener } from "@vueuse/core"
import { Listbox, ListboxItem, createListboxController } from "@ui-sdk/vue/listbox"
import { useI18n } from "@i18n/index.js"
import { Button, IconButton } from "@pig/ui/button"
import { Checkbox } from "@pig/ui/checkbox"
import { Kbd } from "@pig/ui/kbd"
import { Radio } from "@pig/ui/radio-group"
import { StatusIndicator } from "@pig/ui/status-indicator"
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "@components/icons/index.js"
import { useQuestionBoard } from "@features/extension-ui/hooks/use-question-board.js"
import { emptyAnswer } from "@features/extension-ui/lib/board.js"

const props = defineProps<{ prompt: string; active: boolean }>()
const { t } = useI18n()
const board = useQuestionBoard()
const root = useTemplateRef("root")
const list = createListboxController<string, boolean>()
const question = computed(() => board.question.value)
const total = computed(() => board.board.value?.questions.length ?? 0)
const answer = computed(() => board.current.value[board.index.value] ?? emptyAnswer())
const typing = computed(() => question.value?.reply !== "none" && props.prompt.trim().length > 0)
const action = computed(() => board.composer.value)

function onChange(next: unknown) {
  const options = question.value?.options ?? []
  const picked = answer.value.picked
  const values = Array.isArray(next) ? (next as string[]) : next === null ? [] : [String(next)]
  const changed = question.value?.multiple
    ? [
        ...values.filter((value) => !picked.includes(value)),
        ...picked.filter((value) => !values.includes(value)),
      ][0]
    : values[0]
  const position = options.findIndex((option) => option.label === changed)

  if (position >= 0) board.pick(position)
}

useEventListener(
  window,
  "keydown",
  (event: KeyboardEvent) => {
    const el = root.value

    if (
      !props.active ||
      !el ||
      event.defaultPrevented ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey
    )
      return

    if (event.key === "Escape") {
      event.preventDefault()
      event.stopPropagation()
      return board.skip()
    }

    if (props.prompt.trim()) return
    const digit = /^[1-9]$/.test(event.key) ? Number(event.key) - 1 : -1

    if (digit >= 0 && digit < (question.value?.options.length ?? 0)) {
      event.preventDefault()
      return board.pick(digit)
    }

    const options = question.value?.options ?? []
    const vertical = event.key === "ArrowDown" || event.key === "ArrowUp"

    if (vertical && options.length && !el.contains(document.activeElement)) {
      event.preventDefault()
      event.stopPropagation()
      list.highlight(answer.value.picked[0] ?? options[0]!.label)
      return list.focus()
    }

    if (total.value > 1 && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
      event.preventDefault()
      board.go(board.index.value + (event.key === "ArrowLeft" ? -1 : 1))
    }
  },
  { capture: true },
)
</script>

<style scoped>
.question-board {
  display: flex;
  flex-direction: column;
  gap: var(--space-2xs);
  margin-block-end: var(--space-xs);
  padding: var(--space-xs);
  border-radius: var(--radius-card);
  corner-shape: round;
  background-color: var(--float-bg);
  box-shadow: var(--float-shadow);
  backdrop-filter: var(--glass-filter);
}

.board-head {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding-inline-start: var(--space-xs);
}

.board-source {
  flex: 1;
  min-inline-size: 0;
  overflow: hidden;
  color: var(--fg-secondary);
  font-size: var(--text-meta);
  font-weight: var(--font-weight-medium);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.board-pager {
  display: flex;
  align-items: center;
  gap: var(--space-2xs);
}

.board-page {
  color: var(--fg-muted);
  font-size: var(--text-meta);
  font-variant-numeric: tabular-nums;
}

.board-question {
  margin: 0;
  padding-inline: var(--space-xs);
  color: var(--fg);
  font-size: var(--text-body);
  font-weight: var(--font-weight-medium);
  line-height: var(--text-body--line-height);
}

.board-message {
  margin: 0;
  padding: var(--space-xs);
  overflow-x: auto;
  border-radius: var(--radius-control);
  background: var(--bg-muted);
  color: var(--fg);
  font-family: var(--font-mono);
  font-size: var(--text-meta);
  white-space: pre-wrap;
}

.board-options {
  display: flex;
  flex-direction: column;
  outline: none;
  transition: opacity var(--duration-fast) var(--ease-out);
}

.board-options[data-dimmed] {
  opacity: 0.5;
}

.board-option {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-xs);
  border-radius: var(--radius-control);
  cursor: pointer;
  transition: background var(--duration-fast) var(--ease-out);
}

.board-option:is(:hover, [data-highlighted]) {
  background: var(--bg-hover);
}

.board-mark {
  flex-shrink: 0;
  pointer-events: none;
}

.board-option-text {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-inline-size: 0;
}

.board-option-label {
  color: var(--fg);
  font-size: var(--text-body);
  font-weight: var(--font-weight-medium);
}

.board-option-desc {
  color: var(--fg-secondary);
  font-size: var(--text-meta);
}

.board-key {
  flex-shrink: 0;
}

.board-foot {
  display: flex;
  justify-content: flex-end;
}

@media (prefers-reduced-motion: reduce) {
  .board-options,
  .board-option {
    transition: none;
  }
}
</style>
