<template>
  <Card size="m" class="login-panel">
    <div class="login-status" :data-state="state.phase">
      <LoaderIcon v-if="state.phase === 'running'" class="is-spinning" />
      <CircleExclamationPointIcon v-else-if="state.phase === 'error'" />
      <span>{{ statusText }}</span>
    </div>

    <span class="sr-only" role="status" aria-live="polite">{{ copiedAnnouncement }}</span>

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
      <LinkIcon />
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
      <Field class="login-field">
        <FieldLabel class="login-label">{{ state.prompt.message }}</FieldLabel>

        <Select
          v-if="state.prompt.type === 'select'"
          size="m"
          :model-value="value"
          @update:model-value="(v: unknown) => (value = String(v))"
        >
          <SelectTrigger class="login-select" />

          <SelectContent>
            <SelectItem v-for="option in state.prompt.options" :key="option.id" :value="option.id">
              {{ option.label }}
            </SelectItem>
          </SelectContent>
        </Select>

        <TextFieldRoot
          v-else
          v-model="value"
          size="m"
          class="login-input"
          :type="state.prompt.type === 'secret' ? 'password' : 'text'"
          :placeholder="state.prompt.placeholder ?? ''"
          autocomplete="off"
        />

        <FieldDescription v-if="state.prompt.type === 'manual_code'" class="hint">
          {{ t("settings.models.pasteHint") }}
        </FieldDescription>
      </Field>

      <div class="login-actions">
        <Button size="s" variant="outline" type="button" @click="emit('cancel')">
          {{ t("common.cancel") }}
        </Button>

        <Button size="s" type="submit" :disabled="!value.trim()">
          {{ t("settings.models.proceed") }}
        </Button>
      </div>
    </form>

    <div v-else class="login-actions">
      <Button size="s" variant="outline" @click="emit('cancel')">{{ t("common.cancel") }}</Button>
    </div>
  </Card>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue"

import { Button, IconButton } from "@pig/ui/button"
import { toastStatus } from "@pig/ui/toast"
import { Link } from "@pig/ui/link"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@pig/ui/select"
import { Field, FieldDescription, FieldLabel } from "@pig/ui/field"
import { TextFieldRoot } from "@pig/ui/text-field"
import {
  CheckIcon,
  CopyIcon,
  CircleExclamationPointIcon,
  LinkIcon,
  LoaderIcon,
} from "@components/icons/index.js"
import { useI18n } from "@i18n/index.js"
import type { LoginState } from "@features/settings/lib/provider-login.js"
import { Card } from "@pig/ui/card"

const props = defineProps<{ state: LoginState; kind: "api_key" | "oauth" }>()
const emit = defineEmits<{ answer: [value: string]; cancel: [] }>()
const { t } = useI18n()
const value = ref("")
const copied = ref<string>()
const copiedAnnouncement = ref("")
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
  copiedAnnouncement.value = ""

  try {
    await navigator.clipboard.writeText(text)
    copied.value = text
    copiedAnnouncement.value = t("common.copied")
    setTimeout(() => {
      if (copied.value === text) copied.value = undefined
    }, 1500)
  } catch {
    toastStatus(t("common.copyFailed"), { tone: "error" })
    copiedAnnouncement.value = t("common.copyFailed")
  }
}
</script>

<style scoped>
.login-panel {
  padding-block: var(--space-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  margin-block-start: var(--space-sm);
}

.login-status {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  color: var(--fg-secondary);
  font-size: var(--text-meta);
}

.login-status[data-state="error"] {
  color: var(--danger-text);
}

.login-status svg {
  inline-size: 14px;
  block-size: 14px;
}

.login-note,
.hint {
  margin: 0;
  color: var(--fg-secondary);
  font-size: var(--text-meta);
  line-height: 1.5;
}

.login-link {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  align-self: flex-start;
  color: var(--accent-text);
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
  border-radius: var(--radius-control);
  background: var(--bg-muted);
  color: var(--fg);
  font-family: var(--font-mono);
  font-size: var(--text-meta);
}

.icon-button {
  color: var(--fg-secondary);
}

.icon-button:hover {
  color: var(--fg);
}

.device-uri {
  color: var(--fg-secondary);
  font-size: var(--text-meta);
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.login-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.login-label {
  color: var(--fg-secondary);
  font-size: var(--text-meta);
}

.login-select {
  width: 100%;
}

.login-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-xs);
  margin-block-start: var(--space-xs);
}
</style>
