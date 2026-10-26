<template>
  <section class="pane">
    <p v-if="!cwd" class="empty">{{ t("settings.noCwd") }}</p>

    <template v-else>
      <p class="cwd">{{ cwd }}</p>
      <p class="empty">{{ empty }}</p>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { useI18n } from "@i18n/index.js"

const { t } = useI18n()
const props = defineProps<{ pane: "skills" | "extensions"; cwd?: string | undefined }>()
const empty = computed(() =>
  props.pane === "skills" ? t("settings.noSkills") : t("settings.noExtensions"),
)
</script>

<style scoped>
.pane {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.cwd {
  margin: 0;
  color: var(--contrast-foreground-muted);
  font-size: var(--text-eyebrow);
  line-height: var(--text-eyebrow--line-height);
  word-break: break-all;
}

.empty {
  margin: 0;
  color: var(--contrast-foreground-muted);
  font-size: var(--text-caption);
  line-height: var(--text-caption--line-height);
}
</style>
