<template>
  <Teleport v-if="slot" :to="slot">
    <FilePanel :covering="host?.covering.value ?? false" />
  </Teleport>
</template>

<script setup lang="ts">
import { computed, watch, watchEffect } from "vue"
import { useSession } from "@features/session/index.js"
import FilePanel from "@features/file-pane/components/FilePanel.vue"
import { useFilePane } from "@features/file-pane/index.js"
import { usePanelHost } from "@features/split-view/index.js"

const pane = useFilePane()
const { sessionId } = useSession()
const host = usePanelHost()
const shown = computed(() => pane.open.value && Boolean(sessionId.value))
const slot = computed(() => (shown.value ? host?.slots.get("files") : undefined))

watchEffect(() => pane.setFits(!(host?.narrow.value ?? false)))

watch(shown, (open) => (open ? host?.open("files") : host?.close("files")), { immediate: true })
</script>
