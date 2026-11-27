<template>
  <div v-if="bridge" class="window-controls">
    <Tooltip v-for="control in controls" :key="control.id">
      <TooltipTrigger>
        <template #render="{ props: part }">
          <IconButton
            v-bind="part"
            type="button"
            size="m"
            color="neutral"
            variant="ghost"
            :data-window-control="control.id"
            :aria-label="control.label"
            @click="control.run"
          >
            <component :is="control.icon" :class="control.iconClass" />
          </IconButton>
        </template>
      </TooltipTrigger>

      <TooltipContent>{{ control.label }}</TooltipContent>
    </Tooltip>

    <AlertDialog v-model:open="closeOpen">
      <AlertDialogContent class="close-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>{{ t("window.closeTitle") }}</AlertDialogTitle>
          <AlertDialogDescription>{{ t("window.closeBody") }}</AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>{{ t("common.cancel") }}</AlertDialogCancel>

          <AlertDialogAction color="danger" @click="bridge.close()">
            {{ t("window.close") }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onScopeDispose, ref } from "vue"
import { CopyIcon, MinusIcon, SquareIcon, XIcon } from "@components/icons/index.js"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@pig/ui/alert-dialog"
import { IconButton } from "@pig/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@pig/ui/tooltip"
import { useI18n } from "@i18n/index.js"

const props = defineProps<{ hasRunningSessions?: boolean | undefined }>()
const platform = document.documentElement.dataset.pigDesktopPlatform
const bridge = platform === "win32" || platform === "linux" ? window.pigDesktop?.window : undefined
const { t } = useI18n()
const maximized = ref(false)
const closeOpen = ref(false)

if (bridge) {
  void bridge.isMaximized().then((value) => (maximized.value = value))
  onScopeDispose(bridge.onMaximizedChange((value) => (maximized.value = value)))
}

const controls = computed(() => [
  {
    id: "minimize",
    label: t("window.minimize"),
    icon: MinusIcon,
    iconClass: "size-icon-lg",
    run: () => bridge?.minimize(),
  },
  {
    id: maximized.value ? "restore" : "maximize",
    label: maximized.value ? t("window.restore") : t("window.maximize"),
    icon: maximized.value ? CopyIcon : SquareIcon,
    iconClass: "size-icon-sm",
    run: () => bridge?.toggleMaximize(),
  },
  {
    id: "close",
    label: t("window.close"),
    icon: XIcon,
    iconClass: "size-icon-lg",
    run: () => (props.hasRunningSessions ? (closeOpen.value = true) : bridge?.close()),
  },
])
</script>

<style scoped>
.window-controls {
  position: absolute;
  inset-block-start: 0;
  inset-inline-end: 0;
  z-index: var(--z-window-controls);
  display: flex;
  align-items: center;
  gap: var(--space-2xs);
  height: var(--header-height);
  padding-inline-end: var(--space-sm);
  -webkit-app-region: no-drag;
  app-region: no-drag;
}

[data-window-control="close"]:is(:hover, :focus-visible) {
  background-color: var(--danger-solid);
  color: var(--fg-on-accent);
}

[data-window-control="close"]:is(:hover, :focus-visible) svg {
  color: inherit;
}

@media (min-width: 640px) {
  .close-dialog {
    max-inline-size: 28rem;
  }
}
</style>
