<script setup lang="ts">
import type {
  AuthFlow,
  AuthFlowId,
  ProviderAuthStatus,
  ProviderId,
} from "@no-pi-no-gang/contracts";
import { useQuery, useQueryClient } from "@tanstack/vue-query";
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from "vue";
import AppSheet from "@/components/AppSheet.vue";
import { useGatewayClient } from "@/lib/gateway/client-context";
import { gatewayKeys } from "@/lib/gateway/keys";
import { newCommandId } from "@/lib/utils/command";

/**
 * Provider credential center. API keys and Auth Flow answers are write-only:
 * they live only in local component state, are never stored in Query, Pinia,
 * logs, or any API response, and are cleared immediately after submit,
 * cancel, sheet close, or component unmount. Flow progress is tracked via
 * the authFlow query (kept fresh by SSE projection and polling while
 * pending); expired/restarted flows become uncontinuable terminal states.
 */
const props = defineProps<{
  open: boolean;
  /** Provider to highlight when the sheet opens (e.g. from the composer). */
  providerId?: ProviderId | null;
}>();
const emit = defineEmits<{ close: [] }>();

const client = useGatewayClient();
const queryClient = useQueryClient();

const providersQuery = useQuery({
  queryKey: gatewayKeys.providerAuth,
  queryFn: () => client.providerAuth.list(),
});
const providers = computed(() => providersQuery.data.value ?? []);

/** Provider the sheet was opened for; its card is marked and scrolled to. */
const targetedProvider = computed(() => {
  const id = props.providerId;
  if (id === null || id === undefined) return null;
  return providers.value.find((provider) => provider.providerId === id) ?? null;
});

watch(
  () => [props.open, targetedProvider.value] as const,
  async ([open, target]) => {
    if (!open || !target) return;
    await nextTick();
    const card = document.getElementById(`provider-card-${target.providerId}`);
    // Focus stays with the sheet; only the scroll position is adjusted.
    if (card && typeof card.scrollIntoView === "function") {
      card.scrollIntoView({ block: "nearest" });
    }
  },
);

/* ---------- secrets: local, write-only, eagerly cleared ---------- */

const apiKeys = reactive<Record<string, string>>({});
const promptResponse = ref("");
const selectResponse = ref("");

function clearSecrets(): void {
  for (const key of Object.keys(apiKeys)) apiKeys[key] = "";
  promptResponse.value = "";
  selectResponse.value = "";
}

onBeforeUnmount(clearSecrets);

/* ---------- provider auth state ---------- */

const STATE_LABELS: Record<ProviderAuthStatus["state"], string> = {
  ready: "已授权",
  required: "需要授权",
  unavailable: "不可用",
};

const busy = ref(false);
const error = ref<string | null>(null);

async function run(action: () => Promise<unknown>): Promise<boolean> {
  busy.value = true;
  error.value = null;
  try {
    await action();
    return true;
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "操作失败，请重试";
    return false;
  } finally {
    busy.value = false;
  }
}

async function refreshProviders(): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: gatewayKeys.providerAuth });
}

async function saveApiKey(provider: ProviderAuthStatus): Promise<void> {
  const apiKey = apiKeys[provider.providerId] ?? "";
  if (apiKey === "" || busy.value) return;
  // Write-only: clear state and DOM *before* the client promise starts; the
  // local constant serves this single write and is never restored.
  apiKeys[provider.providerId] = "";
  const ok = await run(() =>
    client.providerAuth.setApiKey({
      providerId: provider.providerId,
      commandId: newCommandId(),
      apiKey,
    }),
  );
  if (ok) await refreshProviders();
}

async function removeCredential(provider: ProviderAuthStatus): Promise<void> {
  const ok = await run(() =>
    client.providerAuth.deleteCredential({
      providerId: provider.providerId,
      commandId: newCommandId(),
    }),
  );
  if (ok) await refreshProviders();
}

/* ---------- auth flow ---------- */

const flowId = ref<AuthFlowId | null>(null);

const flowQuery = useQuery({
  queryKey: computed(() => gatewayKeys.authFlow(flowId.value ?? ("__none__" as AuthFlowId))),
  queryFn: () => {
    const id = flowId.value;
    if (id === null) throw new Error("flowId is required");
    return client.authFlows.get({ flowId: id });
  },
  enabled: computed(() => flowId.value !== null),
  refetchInterval: (query) => (query.state.data?.state === "pending" ? 1500 : false),
});

const currentFlow = computed<AuthFlow | null>(() => flowQuery.data.value ?? null);

const FLOW_STATE_LABELS: Record<AuthFlow["state"], string> = {
  pending: "等待完成",
  succeeded: "授权成功",
  failed: "授权失败",
  cancelled: "已取消",
  expired: "已过期，请重新开始",
  interrupted: "已中断（Gateway 重启），请重新开始",
};

watch(
  () => currentFlow.value?.state,
  (state) => {
    if (state !== undefined && state !== "pending") void refreshProviders();
  },
);

async function startFlow(provider: ProviderAuthStatus): Promise<void> {
  const ok = await run(async () => {
    const result = await client.authFlows.create({
      providerId: provider.providerId,
      commandId: newCommandId(),
    });
    flowId.value = result.result.flowId;
    queryClient.setQueryData(gatewayKeys.authFlow(result.result.flowId), result.result);
  });
  if (!ok) flowId.value = null;
}

async function submitPrompt(flow: AuthFlow): Promise<void> {
  const interaction = flow.interaction;
  if (interaction?.kind !== "prompt") return;
  const response = promptResponse.value;
  if (response === "" || busy.value) return;
  // Clear before the write; the answer is never restored afterwards.
  promptResponse.value = "";
  await run(() =>
    client.authFlows.respond({
      flowId: flow.flowId,
      commandId: newCommandId(),
      promptId: interaction.promptId,
      response,
    }),
  );
}

async function submitSelect(flow: AuthFlow): Promise<void> {
  const interaction = flow.interaction;
  if (interaction?.kind !== "select") return;
  const response = selectResponse.value;
  if (response === "" || busy.value) return;
  // Clear before the write; the choice is never restored afterwards.
  selectResponse.value = "";
  await run(() =>
    client.authFlows.respond({
      flowId: flow.flowId,
      commandId: newCommandId(),
      promptId: interaction.promptId,
      response,
    }),
  );
}

async function cancelFlow(): Promise<void> {
  const flow = currentFlow.value;
  clearSecrets();
  if (!flow || flow.state !== "pending") {
    flowId.value = null;
    return;
  }
  await run(() =>
    client.authFlows.cancel({
      flowId: flow.flowId,
      commandId: newCommandId(),
    }),
  );
  flowId.value = null;
}

function finishFlow(): void {
  clearSecrets();
  flowId.value = null;
}

/** Closing the sheet terminates any pending flow and clears secrets. */
watch(
  () => props.open,
  (open) => {
    if (!open) void cancelFlow();
  },
);
</script>

<template>
  <AppSheet :open="open" title="Provider 授权" @close="emit('close')">
    <div class="auth">
      <p v-if="error" class="auth-error" role="alert">{{ error }}</p>
      <p v-if="targetedProvider" class="auth-target">
        为 {{ targetedProvider.providerId }} 完成授权后，对应模型即可使用。
      </p>

      <section v-if="currentFlow" class="auth-flow" aria-label="授权流程">
        <p class="auth-flow-state">
          <span class="badge" :data-tone="currentFlow.state === 'pending' ? 'warning' : 'success'">
            {{ FLOW_STATE_LABELS[currentFlow.state] }}
          </span>
        </p>

        <template v-if="currentFlow.state === 'pending' && currentFlow.interaction">
          <div v-if="currentFlow.interaction.kind === 'openUrl'" class="interaction">
            <p>请在浏览器中完成授权：</p>
            <a
              class="btn btn-primary"
              :href="currentFlow.interaction.url"
              target="_blank"
              rel="noopener noreferrer"
            >
              {{ currentFlow.interaction.label }}
            </a>
          </div>

          <div v-else-if="currentFlow.interaction.kind === 'deviceCode'" class="interaction">
            <p>
              打开
              <a
                :href="currentFlow.interaction.verificationUrl"
                target="_blank"
                rel="noopener noreferrer"
                >验证页面</a
              >
              并输入代码：
            </p>
            <code class="device-code">{{ currentFlow.interaction.userCode }}</code>
            <p class="interaction-note">
              有效期至
              <time :datetime="currentFlow.interaction.expiresAt">{{
                new Date(currentFlow.interaction.expiresAt).toLocaleTimeString("zh-CN")
              }}</time>
            </p>
          </div>

          <form
            v-else-if="currentFlow.interaction.kind === 'prompt'"
            class="interaction"
            @submit.prevent="submitPrompt(currentFlow)"
          >
            <label class="interaction-label" for="auth-prompt-response">{{
              currentFlow.interaction.label
            }}</label>
            <input
              id="auth-prompt-response"
              v-model="promptResponse"
              class="field"
              :type="currentFlow.interaction.sensitive ? 'password' : 'text'"
              autocomplete="off"
            />
            <button type="submit" class="btn btn-primary" :disabled="promptResponse === '' || busy">
              提交
            </button>
          </form>

          <form v-else class="interaction" @submit.prevent="submitSelect(currentFlow)">
            <fieldset v-if="currentFlow.interaction.kind === 'select'">
              <legend class="interaction-label">
                {{ currentFlow.interaction.label }}
              </legend>
              <label
                v-for="option in currentFlow.interaction.options"
                :key="option.value"
                class="select-option"
              >
                <input
                  v-model="selectResponse"
                  type="radio"
                  name="auth-select"
                  :value="option.value"
                />
                {{ option.label }}
              </label>
            </fieldset>
            <button type="submit" class="btn btn-primary" :disabled="selectResponse === '' || busy">
              提交
            </button>
          </form>

          <button type="button" class="btn btn-ghost" :disabled="busy" @click="cancelFlow">
            取消授权
          </button>
        </template>

        <button v-else type="button" class="btn" @click="finishFlow">完成</button>
      </section>

      <section
        v-for="provider in providers"
        :id="`provider-card-${provider.providerId}`"
        :key="provider.providerId"
        class="provider-card"
        :class="{
          'provider-card--targeted': targetedProvider?.providerId === provider.providerId,
        }"
      >
        <header class="provider-head">
          <h3 class="provider-name">{{ provider.providerId }}</h3>
          <span
            class="badge"
            :data-tone="
              provider.state === 'ready'
                ? 'success'
                : provider.state === 'required'
                  ? 'warning'
                  : 'danger'
            "
          >
            {{ STATE_LABELS[provider.state] }}
          </span>
        </header>

        <form
          v-if="provider.methods.includes('apiKey')"
          class="provider-row"
          @submit.prevent="saveApiKey(provider)"
        >
          <label class="visually-hidden" :for="`api-key-${provider.providerId}`"
            >{{ provider.providerId }} API Key</label
          >
          <input
            :id="`api-key-${provider.providerId}`"
            v-model="apiKeys[provider.providerId]"
            class="field"
            type="password"
            placeholder="API Key（仅写入，不回显）"
            autocomplete="off"
          />
          <button
            type="submit"
            class="btn"
            :disabled="(apiKeys[provider.providerId] ?? '') === '' || busy"
          >
            保存
          </button>
          <button
            v-if="provider.state === 'ready'"
            type="button"
            class="btn btn-ghost"
            :disabled="busy"
            @click="removeCredential(provider)"
          >
            删除凭据
          </button>
        </form>

        <div v-if="provider.methods.includes('authFlow')" class="provider-row">
          <button
            type="button"
            class="btn"
            :disabled="busy || currentFlow?.state === 'pending'"
            @click="startFlow(provider)"
          >
            开始授权
          </button>
        </div>
      </section>

      <p v-if="providersQuery.isPending.value" class="auth-empty">正在加载…</p>
      <p v-else-if="providers.length === 0" class="auth-empty">没有需要授权的 Provider。</p>
    </div>
  </AppSheet>
</template>

<style scoped>
.auth {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.auth-error {
  color: var(--color-danger);
  font-size: var(--text-sm);
  margin: 0;
}

.auth-flow {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-muted);
}

.auth-flow-state {
  margin: 0;
}

.interaction {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  align-items: flex-start;
}

.interaction p {
  margin: 0;
}

.interaction-label {
  font-size: var(--text-sm);
}

.interaction-note {
  font-size: var(--text-xs);
  color: var(--color-foreground-muted);
}

.device-code {
  font-family: var(--font-code);
  font-size: var(--text-lg);
  letter-spacing: 2px;
}

fieldset {
  border: 0;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.select-option {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-height: var(--target-min);
}

.provider-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3) 0;
  border-top: 1px solid var(--color-border);
}

.provider-card--targeted {
  margin: 0 calc(-1 * var(--space-3));
  padding: var(--space-3);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-control);
}

.auth-target {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--color-foreground-muted);
}

.provider-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.provider-name {
  font-size: var(--text-md);
}

.provider-row {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.auth-empty {
  color: var(--color-foreground-muted);
  font-size: var(--text-sm);
}
</style>
