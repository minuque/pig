<template>
  <div class="nav-footer">
    <Tooltip>
      <TooltipTrigger as-child>
        <button
          class="footer-settings press-scale"
          type="button"
          :aria-label="t('nav.settings')"
          @click="emit('settings')"
        >
          <SettingsIcon />
        </button>
      </TooltipTrigger>

      <TooltipContent>{{ t("nav.settings") }}</TooltipContent>
    </Tooltip>
  </div>
</template>

<script setup lang="ts">
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
  display: flex;
  flex: none;
  align-items: center;
  padding: var(--space-xs) var(--nav-inline, var(--space-xs));
  border-top: var(--border-width) solid var(--border-subtle);
}

.footer-settings {
  display: grid;
  flex: none;
  place-items: center;
  width: var(--size-icon-button);
  height: var(--size-icon-button);
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--contrast-foreground);
  transition:
    background-color var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out),
    scale var(--duration-fast) var(--ease-out);
}

.footer-settings:hover {
  background: var(--hover-quiet);
  color: var(--contrast-foreground);
}

@media (prefers-reduced-motion: reduce) {
  .footer-settings {
    transition: none;
  }
}
</style>
