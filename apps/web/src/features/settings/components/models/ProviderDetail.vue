<template>
  <section class="provider-detail">
    <button type="button" class="provider-back" @click="emit('back')">
      <ArrowLeftIcon class="back-icon" />
      {{ t("settings.models.providers") }}
    </button>

    <header class="detail-head">
      <span class="detail-mark">
        <VendorMark :vendor="provider.id" :name="provider.name" :size="26" />
      </span>

      <div class="detail-copy">
        <h2 class="provider-detail-title">{{ provider.name }}</h2>

        <div class="detail-sub">
          <span class="detail-id">{{ provider.id }}</span>

          <span class="provider-badge" :data-state="badge">
            {{ t(`settings.models.status.${badge}`) }}
          </span>
        </div>
      </div>
    </header>

    <section class="detail-sec">
      <h3 class="sec-title">{{ t("settings.models.connection") }}</h3>

      <div class="kvgroup">
        <div class="kvrow">
          <span class="kvlabel">{{ t("settings.models.authMethod") }}</span>
          <span class="kvvalue">{{ methodLabel }}</span>

          <button v-if="canSwitch" type="button" class="switch-link" @click="toggleMethod">
            <component
              :is="method === 'apiKey' ? UserIcon : KeyMinimalisticIcon"
              class="switch-icon"
            />
            {{
              method === "apiKey" ? t("settings.models.useOauth") : t("settings.models.useApiKey")
            }}
          </button>
        </div>

        <div v-if="showStoredKey" class="kvrow">
          <span class="kvlabel">{{ t("settings.models.apiKey") }}</span>
          <span class="kvvalue masked">{{ maskedKey }}</span>

          <span class="rowicons">
            <button
              type="button"
              class="icon-button"
              :aria-label="t('settings.models.editKey')"
              @click="editing = true"
            >
              <PenIcon />
            </button>

            <button
              type="button"
              class="icon-button"
              :aria-label="t('settings.models.copyKey')"
              @click="copyKey"
            >
              <CheckIcon v-if="copied" />
              <CopyIcon v-else />
            </button>
          </span>
        </div>

        <div v-else-if="showKeyInput" class="kvrow">
          <span class="kvlabel">{{ t("settings.models.apiKey") }}</span>

          <input
            v-model="apiKey"
            class="kvinput"
            type="password"
            autocomplete="off"
            :placeholder="t('settings.models.apiKeyPlaceholder')"
            @keydown.enter="saveKey"
          />
        </div>

        <div v-else-if="method === 'ambient' && provider.capabilities.ambient" class="kvrow">
          <span class="kvlabel">{{ t("settings.models.sourceLabel") }}</span>
          <span class="kvvalue muted">{{ t("settings.models.source.environment") }}</span>
        </div>

        <div v-if="provider.status.configured" class="kvrow">
          <span class="kvlabel">{{ t("settings.models.availableModels") }}</span>

          <span class="kvvalue">
            {{ t("settings.models.modelCount", { count: provider.models.length }) }}
          </span>
        </div>
      </div>

      <Transition name="panel-reveal">
        <ProviderLoginPanel
          v-if="loginState.phase !== 'idle'"
          :state="loginState"
          :kind="loginKind"
          @answer="answerLogin"
          @cancel="resetLogin"
        />
      </Transition>

      <div class="actions">
        <p v-if="actionError" class="note error">{{ actionError }}</p>
        <p v-else class="note">{{ t("settings.models.authNote") }}</p>

        <span class="btnrow">
          <Button v-if="editing" variant="surface" @click="cancelEdit">
            {{ t("common.cancel") }}
          </Button>

          <Button variant="surface" :loading="testing" :disabled="!canTest" @click="runTest">
            {{ t("settings.models.testConnection") }}
          </Button>

          <Button
            v-if="showKeyInput"
            :loading="connectingKey"
            :disabled="!apiKey.trim()"
            @click="saveKey"
          >
            {{ editing ? t("settings.models.saveKey") : t("settings.models.saveAndConnect") }}
          </Button>

          <Button
            v-else-if="method === 'oauth' && !provider.status.configured"
            :loading="loginStarting"
            :disabled="loginState.phase === 'running'"
            @click="startLogin('oauth')"
          >
            {{ t("settings.models.signIn") }}
          </Button>

          <Button
            v-if="canLogout"
            variant="surface"
            color="red"
            :disabled="loginState.phase === 'running'"
            @click="confirmLogout = true"
          >
            {{ t("settings.models.logout") }}
          </Button>
        </span>
      </div>

      <p v-if="testResult" class="test-result" :data-state="testResult.ok ? 'ok' : 'error'">
        {{ testResult.text }}
      </p>
    </section>

    <section v-if="provider.status.configured" class="detail-sec">
      <h3 class="sec-title">
        {{ t("settings.models.modelList") }}
        <span class="sec-count">
          {{ t("settings.models.modelCount", { count: provider.models.length }) }}
        </span>

        <button type="button" class="refresh-models" :disabled="refreshing" @click="reloadModels">
          <RestartIcon :class="{ 'is-spinning': refreshing }" />
          {{ t("settings.models.refreshModels") }}
        </button>
      </h3>

      <p v-if="refreshError" class="refresh-error">{{ refreshError }}</p>
      <p v-if="!provider.models.length" class="empty">{{ t("settings.models.noModels") }}</p>
      <ProviderModelList :provider="provider" @changed="emit('changed')" />
    </section>

    <AlertDialog v-model:open="confirmLogout">
      <AlertDialogContent class="logout-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {{ t("settings.models.logoutTitle", { name: provider.name }) }}
          </AlertDialogTitle>

          <AlertDialogDescription>{{ t("settings.models.logoutBody") }}</AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>{{ t("common.cancel") }}</AlertDialogCancel>

          <AlertDialogAction variant="destructive" @click="logout">
            {{ t("settings.models.logout") }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@components/ui/alert-dialog/index.js"
import { Button } from "@components/ui/button/index.js"
import {
  ArrowLeftIcon,
  CheckIcon,
  CopyIcon,
  KeyMinimalisticIcon,
  PenIcon,
  RestartIcon,
  UserIcon,
} from "@components/icons/index.js"
import VendorMark from "@features/composer/components/VendorMark.vue"
import ProviderLoginPanel from "@features/settings/components/models/ProviderLoginPanel.vue"
import ProviderModelList from "@features/settings/components/models/ProviderModelList.vue"
import { useProviderLogin } from "@features/settings/hooks/use-provider-login.js"
import { errorMessage } from "@client/http.js"
import { copyProviderKey, logoutProvider, testProvider } from "@client/platform.js"
import { providerStatusBadge } from "@features/settings/lib/provider-view.js"
import { useI18n } from "@i18n/index.js"
import type { ProviderView } from "@/types/provider-type.js"

type AuthMethod = "apiKey" | "oauth" | "ambient"

const props = defineProps<{
  provider: ProviderView
  refreshModels?: () => Promise<void>
}>()
const emit = defineEmits<{ back: []; changed: [] }>()
const { t } = useI18n()
const apiKey = ref("")
const editing = ref(false)
const copied = ref(false)
const confirmLogout = ref(false)
const preferred = ref<AuthMethod>()
const actionError = ref<string>()
const testing = ref(false)
const refreshing = ref(false)
const refreshError = ref<string>()
const testResult = ref<{ ok: boolean; text: string }>()
const storedMethod = computed<AuthMethod>(() => {
  if (props.provider.status.hint) return "apiKey"

  if (props.provider.status.configured) {
    const source = props.provider.status.source

    if (source === "environment" || source === "models_json_key") return "apiKey"

    if (source === "models_json_command" || source === "fallback") return "ambient"

    if (props.provider.capabilities.oauth) return "oauth"
    return "apiKey"
  }

  if (props.provider.capabilities.apiKey) return "apiKey"

  if (props.provider.capabilities.oauth) return "oauth"
  return "ambient"
})
const method = computed(() => preferred.value ?? storedMethod.value)
const canSwitch = computed(
  () => props.provider.capabilities.apiKey && props.provider.capabilities.oauth,
)
const canLogout = computed(() => {
  const source = props.provider.status.source
  return props.provider.status.configured && (source === "stored" || source === "runtime")
})
const canTest = computed(() => props.provider.status.configured && props.provider.models.length > 0)
const showStoredKey = computed(
  () => method.value === "apiKey" && Boolean(props.provider.status.hint) && !editing.value,
)
const showKeyInput = computed(
  () => method.value === "apiKey" && props.provider.capabilities.apiKey && !showStoredKey.value,
)
const maskedKey = computed(() => `••••••••••••${props.provider.status.hint ?? ""}`)
const methodLabel = computed(() => t(`settings.models.${method.value}`))
const badge = computed(() =>
  providerStatusBadge(props.provider, loginState.value.phase === "running"),
)
const {
  state: loginState,
  starting: loginStarting,
  start: startLogin,
  answer: answerLogin,
  reset: resetLogin,
} = useProviderLogin(
  () => props.provider.id,
  () => {
    emit("changed")
    resetLogin()
  },
)
const loginKind = computed<"api_key" | "oauth">(() =>
  method.value === "oauth" ? "oauth" : "api_key",
)
const connectingKey = computed(
  () => loginStarting.value && loginKind.value === "api_key" && method.value === "apiKey",
)

watch(
  () => props.provider.id,
  () => {
    apiKey.value = ""
    editing.value = false
    preferred.value = undefined
    actionError.value = undefined
    testResult.value = undefined
    resetLogin()
  },
)

async function reloadModels() {
  if (!props.refreshModels) return
  refreshing.value = true
  refreshError.value = undefined

  try {
    await props.refreshModels()
  } catch (cause) {
    refreshError.value = errorMessage(cause)
  } finally {
    refreshing.value = false
  }
}

async function runTest() {
  testing.value = true
  testResult.value = undefined

  try {
    const result = await testProvider(props.provider.id)

    testResult.value = result.ok
      ? { ok: true, text: t("settings.models.testOk", { ms: result.latencyMs ?? 0 }) }
      : { ok: false, text: result.message ?? t("common.error") }
  } catch (cause) {
    testResult.value = { ok: false, text: errorMessage(cause) }
  } finally {
    testing.value = false
  }
}

function toggleMethod() {
  preferred.value = method.value === "apiKey" ? "oauth" : "apiKey"
  apiKey.value = ""
  editing.value = false
  actionError.value = undefined
  resetLogin()
}

function cancelEdit() {
  editing.value = false
  apiKey.value = ""
}

function saveKey() {
  const key = apiKey.value.trim()

  if (!key) return
  actionError.value = undefined
  void startLogin("api_key", key)
}

async function copyKey() {
  try {
    const key = await copyProviderKey(props.provider.id)

    await navigator.clipboard.writeText(key)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 1500)
  } catch (cause) {
    actionError.value = errorMessage(cause)
  }
}

async function logout() {
  try {
    await logoutProvider(props.provider.id)
    emit("changed")
  } catch (cause) {
    actionError.value = errorMessage(cause)
  }
}
</script>

<style scoped>
.provider-back {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  align-self: flex-start;
  height: 26px;
  margin-block-end: var(--space-md);
  color: var(--contrast-foreground-muted);
  font-size: var(--text-caption);
}

.back-icon {
  inline-size: 12px;
  block-size: 12px;
}

.detail-head {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding-block-end: var(--space-md);
}

.detail-mark {
  display: grid;
  place-items: center;
  flex: none;
  width: 36px;
  height: 36px;
}

.detail-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
}

.provider-detail-title {
  margin: 0;
  color: var(--contrast-foreground);
  font-size: var(--text-body-lg);
  font-weight: var(--font-weight-semibold);
  line-height: 1.2;
}

.detail-sub {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  color: var(--contrast-foreground-muted);
  font-size: var(--text-caption);
}

.provider-badge {
  display: inline-flex;
  align-items: center;
  height: 18px;
  padding-inline: 6px;
  border: var(--border-width) solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: var(--hover-quiet);
  color: var(--contrast-foreground-muted);
  font-size: var(--text-eyebrow);
}

.provider-badge[data-state="connected"] {
  border-color: var(--success-halo);
  background: var(--success-bg);
  color: var(--success);
}

.provider-badge[data-state="authorizing"] {
  background: var(--hover-quiet);
  color: var(--warning);
}

.detail-sec {
  padding-block-start: var(--space-md);
}

.sec-title {
  display: flex;
  align-items: baseline;
  gap: var(--space-xs);
  margin: 0 0 var(--space-sm);
  color: var(--contrast-foreground-muted);
  font-size: var(--text-body-sm);
  font-weight: var(--font-weight-semibold);
  line-height: var(--text-body-sm--line-height);
}

.sec-count {
  color: var(--contrast-foreground-faint);
  font-weight: var(--font-weight-normal);
}

.kvgroup {
  padding: 2px var(--space-sm);
  border: var(--border-width) solid var(--border-subtle);
  border-radius: var(--radius-lg);
  background: var(--card);
}

.kvrow {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  min-height: 38px;
}

.kvlabel {
  flex: none;
  width: 72px;
  color: var(--contrast-foreground-muted);
  font-size: var(--text-caption);
}

.kvvalue {
  color: var(--contrast-foreground);
  font-size: var(--text-caption);
}

.kvvalue.muted {
  color: var(--contrast-foreground-faint);
}

.kvvalue.masked {
  color: var(--contrast-foreground-faint);
  font-family: var(--font-mono);
}

.switch-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-inline-start: auto;
  color: var(--contrast-foreground-muted);
  font-size: var(--text-eyebrow);
}

.switch-link:hover {
  color: var(--contrast-foreground);
}

.switch-icon {
  inline-size: 13px;
  block-size: 13px;
}

.rowicons {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-inline-start: auto;
}

.icon-button {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: var(--radius-sm);
  color: var(--contrast-foreground-muted);
}

.icon-button:hover {
  background: var(--hover-quiet);
  color: var(--contrast-foreground);
}

.icon-button svg {
  inline-size: 13px;
  block-size: 13px;
}

.kvinput {
  flex: 1;
  height: 30px;
  padding-inline: var(--space-sm);
  border: var(--border-width) solid var(--border-subtle);
  border-radius: var(--radius-md);
  background: var(--background);
  color: var(--contrast-foreground);
  font-size: var(--text-caption);
}

.actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
  margin-block-start: var(--space-sm);
}

.note {
  margin: 0;
  color: var(--contrast-foreground-faint);
  font-size: var(--text-eyebrow);
  line-height: 1.4;
}

.note.error {
  color: var(--danger);
}

.refresh-models {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-inline-start: auto;
  color: var(--contrast-foreground-muted);
  font-size: var(--text-eyebrow);
  font-weight: var(--font-weight-normal);
}

.refresh-models:hover:not(:disabled) {
  color: var(--contrast-foreground);
}

.refresh-models:disabled {
  cursor: default;
}

.refresh-models svg {
  inline-size: 12px;
  block-size: 12px;
}

.refresh-error {
  margin: 0 0 var(--space-xs);
  color: var(--danger);
  font-size: var(--text-eyebrow);
}

.test-result {
  margin: var(--space-sm) 0 0;
  color: var(--success);
  font-size: var(--text-eyebrow);
  line-height: 1.4;
}

.test-result[data-state="error"] {
  color: var(--danger);
}

.btnrow {
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--space-xs);
}

.empty {
  margin: 0;
  color: var(--contrast-foreground-faint);
  font-size: var(--text-caption);
}

.logout-dialog {
  max-inline-size: 26rem;
}
</style>
