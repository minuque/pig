<template>
  <section class="startup-error">
    <EmptyState :title="heading" :description="t('startup.startupError')">
      <template #art><HairlineArt figure="plug" /></template>

      <template #actions>
        <Button type="button" @click="retry">{{ t("startup.retry") }}</Button>
      </template>
    </EmptyState>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { Button } from "@pig/ui/button"
import { EmptyState } from "@pig/ui/empty-state"
import { useI18n } from "@i18n/index.js"
import HairlineArt from "@components/empty/HairlineArt.vue"

const { t } = useI18n()
const props = withDefaults(defineProps<{ title?: string }>(), { title: "" })
const heading = computed(() => props.title || t("startup.startupFailed"))

function retry() {
  window.location.reload()
}
</script>

<style scoped>
.startup-error {
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
}
</style>
