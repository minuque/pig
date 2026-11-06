<template>
  <div class="nav-footer">
    <div class="footer-actions">
      <Tooltip>
        <TooltipTrigger as-child>
          <IconButton
            class="footer-btn press-scale"
            type="button"
            size="m"
            variant="ghost"
            :aria-label="t('nav.settings')"
            @click="emit('settings')"
          >
            <SettingsIcon :size="16" />
          </IconButton>
        </TooltipTrigger>

        <TooltipContent>{{ t("nav.settings") }}</TooltipContent>
      </Tooltip>
    </div>
  </div>
</template>

<script setup lang="ts">
import { IconButton } from "@components/ui/button/index.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"
import { useI18n } from "@i18n/index.js"
import { SettingsIcon } from "@components/icons/index.js"

const emit = defineEmits<{
  settings: []
}>()
const { t } = useI18n()
</script>

<style scoped>
.nav-footer {
  position: relative;
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--space-xxs);
  padding: var(--space-xs) var(--nav-inline, var(--space-xs));
}

.footer-actions {
  display: flex;
  align-items: center;
  gap: var(--space-xxs);
}
</style>
