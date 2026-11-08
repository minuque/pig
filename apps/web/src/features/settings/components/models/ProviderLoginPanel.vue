<template>
  <Card size="s" class="login-panel">
    <div class="login-status" :data-state="state.phase">
      <LoaderIcon v-if="state.phase === 'running'" class="is-spinning" />
      <DangerCircleIcon v-else-if="state.phase === 'error'" />
      <span>{{ statusText }}</span>
    </div>

    <p v-if="state.instruction" class="login-note">{{ state.instruction }}</p>
    <p v-if="state.progress" class="login-note">{{ state.progress }}</p>

    <Link
      v-for="link in state.links"
      :key="link"
      class="login-link"
      :href="link"
      target="_blank"
      rel="noopener noreferrer"
    >
      {{ t("settings.models.openAuthPage") }}
      <LinkMinimalisticIcon />
    </Link>

    <div v-for="code in state.deviceCodes" :key="code.userCode" class="device-row">
      <span class="device-code">{{ code.userCode }}</span>

      <IconButton
        type="button"
        class="icon-button"
        size="s"
        variant="ghost"
        :aria-label="t('settings.models.copyCode')"
        @click="copy(code.userCode)"
      >
        <CheckIcon v-if="copied === code.userCode" />
        <CopyIcon v-else />
      </IconButton>

      <Link
        class="device-uri"
        :href="code.verificationUri"
        target="_blank"
        rel="noopener noreferrer"
        truncate
      >
        {{ code.verificationUri }}
      </Link>
    </div>

    <form v-if="state.prompt" class="login-form" @submit.prevent="submit">
      <label class="login-label" :for="state.prompt.id">{{ state.prompt.message }}</label>

      <select v-if="state.prompt.type === 'select'" :id="state.prompt.id" v-model="value">
        <option v-for="option in state.prompt.options" :key="option.id" :value="option.id">
          {{ option.label }}
        </option>
      </select>

      <input
        v-else
        :id="state.prompt.id"
        v-model="value"
        class="login-input"
        :type="state.prompt.type === 'secret' ? 'password' : 'text'"
        :placeholder="state.prompt.placeholder ?? ''"
        autocomplete="off"
      />

      <p v-if="state.prompt.type === 'manual_code'" class="hint">
        {{ t("settings.models.pasteHint") }}
      </p>

      <div class="login-actions">
        <Button size="s" variant="surface" type="button" @click="emit('cancel')">
          {{ t("common.cancel") }}
        </Button>

        <Button size="s" type="submit" :disabled="!value.trim()">
          {{ t("settings.models.proceed") }}
        </Button>
      </div>
    </form>

    <div v-else class="login-actions">
      <Button size="s" variant="surface" @click="emit('cancel')">{{ t("common.cancel") }}</Button>
    </div>
  </Card>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue"

import { Button, IconButton } from "@components/ui/button/index.js"
import { Link } from "@components/ui/link/index.js"
import {
  CheckIcon,
  CopyIcon,
  DangerCircleIcon,
  LinkMinimalisticIcon,
  LoaderIcon,
} from "@components/icons/index.js"
import { useI18n } from "@i18n/index.js"
import type { LoginState } from "@features/settings/lib/provider-login.js"
import { Card } from "@components/ui/card/index.js"

const props = defineProps<{ state: LoginState; kind: "api_key" | "oauth" }>()
const emit = defineEmits<{ answer: [value: string]; cancel: [] }>()
const { t } = useI18n()
const value = ref("")
const copied = ref<string>()
const statusText = computed(() => {
  if (props.state.phase === "error") return props.state.error ?? t("common.error")

  if (props.state.phase === "done") return t("settings.models.authorized")
  return props.kind === "oauth"
    ? t("settings.models.waitingAuth")
    : t("settings.models.verifyingKey")
})

watch(
  () => props.state.prompt?.id,
  () => {
    value.value = props.state.prompt?.options?.[0]?.id ?? ""
  },
)

function submit() {
  const answer = value.value.trim()

  if (!answer) return
  emit("answer", answer)
  value.value = ""
}

async function copy(text: string) {
  await navigator.clipboard.writeText(text)
  copied.value = text
  setTimeout(() => {
    if (copied.value === text) copied.value = undefined
  }, 1500)
}
</script>

<style scoped>
.login-panel {
  padding: var(--space-sm) var(--space-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  margin-block-start: var(--space-sm);
}

.login-status {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  color: var(--contrast-foreground-faint);
  font-size: var(--text-meta);
}

.login-status[data-state="error"] {
  color: var(--danger);
}

.login-status svg {
  inline-size: 14px;
  block-size: 14px;
}

.login-note,
.hint {
  margin: 0;
  color: var(--contrast-foreground-faint);
  font-size: var(--text-meta);
  line-height: 1.5;
}

.login-link {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  align-self: flex-start;
  color: var(--primary);
  font-size: var(--text-meta);
}

.login-link svg {
  inline-size: 12px;
  block-size: 12px;
}

.device-row {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.device-code {
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  background: var(--hover-quiet);
  color: var(--contrast-foreground);
  font-family: var(--font-mono);
  font-size: var(--text-meta);
}

.icon-button {
  color: var(--contrast-foreground-faint);
}

.icon-button:hover {
  color: var(--contrast-foreground);
}

.device-uri {
  color: var(--contrast-foreground-faint);
  font-size: var(--text-meta);
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.login-label {
  color: var(--contrast-foreground-faint);
  font-size: var(--text-meta);
}

.login-input,
.login-form select {
  height: 30px;
  padding-inline: var(--space-sm);
  border: var(--border-width) solid var(--border-soft);
  border-radius: var(--radius-md);
  background: var(--background);
  color: var(--contrast-foreground);
  font-size: var(--text-meta);
}

.login-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-xs);
  margin-block-start: var(--space-xs);
}

:deep(.rt-BaseButton.rt-r-size-1) {
  font-size: var(--text-body);
}
</style>
