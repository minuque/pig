<template>
  <section class="startup-error">
    <div class="error-cluster">
      <CircleAlert :size="32" class="error-icon" />
      <h1 id="startup-error-title" class="error-title">{{ heading }}</h1>
      <p class="error-detail">{{ copy }}</p>
      <Button type="button" @click="retry">{{ t("startup.retry") }}</Button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { CircleAlert } from "@lucide/vue"
import { Button } from "@components/ui/button/index.js"
import { useI18n } from "@i18n/index.js"
import { useStartupError } from "@features/startup/index.js"

const { t } = useI18n()
const props = withDefaults(
  defineProps<{
    title?: string
    detail?: string
  }>(),
  { title: "", detail: "" },
)
const stored = useStartupError()
const heading = computed(() => props.title || t("startup.startupFailed"))
const copy = computed(() => props.detail.trim() || stored.value.trim() || t("startup.startupError"))

function retry() {
  window.location.reload()
}
</script>

<style scoped>
.startup-error {
  min-height: 0;
  flex: 1;
  display: grid;
  place-items: center;
  padding: 0 var(--spacing-md);
}

.error-cluster {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-xs);
  max-width: var(--size-composer);
  text-align: center;
}

.error-icon {
  flex: none;
  color: var(--ink-faint);
}

.error-title {
  margin: 0;
  color: var(--ink);
  font-size: var(--text-body-sm);
  font-weight: var(--font-weight-medium);
  line-height: var(--text-body-sm--line-height);
}

.error-detail {
  margin: 0;
  color: var(--ink-faint);
  font-size: var(--text-caption);
  line-height: var(--text-caption--line-height);
  overflow-wrap: anywhere;
}
</style>
