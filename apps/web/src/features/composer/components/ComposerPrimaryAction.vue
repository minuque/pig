<template>
  <div class="primary">
    <Tooltip>
      <TooltipTrigger>
        <template #render="{ props: part }">
          <IconButton
            v-bind="part"
            type="button"
            size="m"
            variant="solid"
            radius="full"
            :color="mode === 'stop' ? 'danger' : 'accent'"
            class="send press-scale"
            :aria-label="label"
            :aria-keyshortcuts="mode === 'stop' ? 'Escape' : 'Enter'"
            :disabled="disabled"
            @mousedown.prevent
            @click="onPrimary"
          >
            <component
              :is="MODES[mode].icon"
              class="size-icon"
              :class="{ 'is-spinning': mode === 'stopping' }"
              :fill="mode === 'stop' ? 'currentColor' : 'none'"
              aria-hidden="true"
            />
          </IconButton>
        </template>
      </TooltipTrigger>

      <TooltipContent>{{ label }}</TooltipContent>
    </Tooltip>

    <Tooltip v-if="mode === 'queue' || mode === 'steer'">
      <TooltipTrigger>
        <template #render="{ props: part }">
          <IconButton
            v-bind="part"
            type="button"
            size="m"
            variant="solid"
            radius="full"
            color="danger"
            class="send press-scale"
            :aria-label="t('composer.stopTurn')"
            @mousedown.prevent
            @click="emit('abort')"
          >
            <SquareIcon fill="currentColor" aria-hidden="true" />
          </IconButton>
        </template>
      </TooltipTrigger>

      <TooltipContent>{{ t("composer.stopTurn") }}</TooltipContent>
    </Tooltip>
  </div>
</template>

<script setup lang="ts">
import { computed, type Component } from "vue"
import { useI18n } from "@i18n/index.js"
import { IconButton } from "@pig/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@pig/ui/tooltip"
import type { StopPhase } from "@features/composer/type.js"
import {
  ArrowUpIcon,
  CheckIcon,
  CornerUpRightIcon,
  ListPlusIcon,
  LoaderIcon,
  SquareIcon,
} from "@components/icons/index.js"

type PrimaryMode = "save" | "stopping" | "stop" | "steer" | "queue" | "send"

const MODES: Record<PrimaryMode, { icon: Component; key: string }> = {
  save: { icon: CheckIcon, key: "queueSaveEdit" },
  stopping: { icon: LoaderIcon, key: "stopping" },
  stop: { icon: SquareIcon, key: "stopTurn" },
  steer: { icon: CornerUpRightIcon, key: "steer" },
  queue: { icon: ListPlusIcon, key: "queuePrompt" },
  send: { icon: ArrowUpIcon, key: "sendPrompt" },
}
const props = defineProps<{
  running: boolean
  steerHeld: boolean
  editingQueue: boolean
  stopPhase: StopPhase
  sendDisabled: boolean
  hasPayload: boolean
  hasAttachments: boolean
}>()
const emit = defineEmits<{ submit: []; abort: [] }>()
const { t } = useI18n()
const mode = computed<PrimaryMode>(() => {
  if (props.editingQueue) return "save"

  if (props.stopPhase === "pending") return "stopping"

  if (!props.running) return "send"

  if (!props.hasPayload) return "stop"
  return props.steerHeld ? "steer" : "queue"
})
const steerLocked = computed(() => mode.value === "steer" && props.hasAttachments)
const label = computed(() => {
  const { key } = MODES[mode.value]
  return steerLocked.value ? t("composer.steerNoAttachments") : t(`composer.${key}`)
})
const disabled = computed(() => {
  if (mode.value === "save") return !props.hasPayload

  if (mode.value === "stopping" || props.stopPhase === "landed") return true

  if (mode.value === "stop") return false

  if (mode.value === "steer") return steerLocked.value || props.sendDisabled
  return props.sendDisabled || !props.hasPayload
})

function onPrimary() {
  if (disabled.value) return

  if (mode.value === "stop") emit("abort")
  else emit("submit")
}
</script>

<style scoped>
.primary {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.send {
  inline-size: var(--control-md);
  height: var(--control-md);
}

.send > svg {
  inline-size: var(--icon-lg);
  block-size: var(--icon-lg);
}

.send:disabled {
  opacity: 1;
  background: var(--bg-emphasis);
  color: var(--fg-secondary);
  box-shadow: none;
}
</style>
