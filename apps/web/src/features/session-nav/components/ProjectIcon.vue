<template>
  <component
    :is="PROJECT_ICONS[choice.name]"
    v-if="choice"
    class="project-glyph"
    :data-accent-color="choice.color"
    aria-hidden="true"
  />

  <Badge v-else-if="fallback === 'monogram'" variant="soft" :color="monogramColor">
    {{ projectMonogram(workspaceName(path ?? "")) }}
  </Badge>

  <FolderIcon v-else aria-hidden="true" />
</template>

<script setup lang="ts">
import { computed } from "vue"
import { Badge } from "@components/ui/badge/index.js"
import { FolderIcon } from "@components/icons/index.js"
import { PROJECT_ICONS } from "@components/icons/project-icons.js"
import { projectMonogram, workspaceName } from "@features/session-nav/lib/format.js"
import { projectIconColorOf } from "@features/session-nav/lib/project-prefs.js"
import { useProjectPrefs } from "@features/session-nav/hooks/use-project-prefs.js"

const props = withDefaults(
  defineProps<{
    path?: string | undefined
    /** 没配图标时的样子：目录图标或项目缩写徽标 */
    fallback?: "folder" | "monogram"
  }>(),
  { path: undefined, fallback: "folder" },
)
const { iconOf } = useProjectPrefs()
const choice = computed(() => iconOf(props.path))
const monogramColor = computed(() => projectIconColorOf(props.path ?? ""))
</script>

<style scoped>
.project-glyph[data-accent-color] {
  color: var(--tint);
}
</style>
