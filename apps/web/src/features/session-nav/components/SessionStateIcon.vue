<template>
  <StatusIndicator
    class="state-icon"
    :class="state"
    appearance="icon"
    :status="STATUS_BY_GLYPH[state]"
    :label="label"
  />
</template>

<script setup lang="ts">
import { computed } from "vue"
import { StatusIndicator, type StatusTone } from "@pig/ui/status-indicator"
import { useI18n } from "@i18n/index.js"
import type { SidebarStateGlyph } from "@features/session-nav/type.js"

const STATUS_BY_GLYPH: Record<SidebarStateGlyph, StatusTone> = {
  running: "running",
  unread: "success",
  error: "error",
  draft: "draft",
}
const props = defineProps<{
  state: SidebarStateGlyph
}>()
const { t } = useI18n()
const label = computed(() => {
  if (props.state === "unread") return t("session.done")

  if (props.state === "error") return t("session.failed")
  return undefined
})
</script>

<style scoped>
.state-icon {
  min-inline-size: var(--icon-md);
  min-block-size: var(--icon-md);
}
</style>
