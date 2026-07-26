<script setup lang="ts">
import { computed, ref, toRef, watch } from "vue";
import { useQuery } from "@tanstack/vue-query";
import type {
  ExecutionProfile,
  RunSummary,
  SessionId,
  ThinkingLevel,
} from "@no-pi-no-gang/contracts";
import { useGatewayClient } from "@/lib/gateway/client-context";
import { gatewayKeys } from "@/lib/gateway/keys";
import { newCommandId } from "@/lib/utils/command";
import { useDraft } from "@/features/session/draft-registry";
import { isTerminalRunState } from "@/features/sync/reducer";

/**
 * Prompt composer. The draft is session-scoped and in-memory only
 * (draft-registry). The execution profile (model + thinking level) is chosen
 * at admission and then displayed from the admitted Run summary. Ordinary
 * prompt submission always creates a new Run; Steer is a separate explicit
 * operation. Enter submits, Shift+Enter newlines.
 */
const props = defineProps<{
  sessionId: SessionId | undefined;
  activeRun: RunSummary | null;
  sessionAvailable: boolean;
}>();

const client = useGatewayClient();
const { text: draftText, clear: clearDraft } = useDraft(
  toRef(props, "sessionId"),
);

const modelsQuery = useQuery({
  queryKey: gatewayKeys.models,
  queryFn: () => client.models.list(),
});
const models = computed(() => modelsQuery.data.value ?? []);

const userModelId = ref("");
const userThinkingLevel = ref<ThinkingLevel>("medium");

watch(
  models,
  (list) => {
    const current = list.find((model) => model.modelId === userModelId.value);
    if (current) return;
    const first = list.find((model) => model.available) ?? list[0];
    userModelId.value = first?.modelId ?? "";
    userThinkingLevel.value = first?.thinkingLevels[0] ?? "medium";
  },
  { immediate: true },
);

const selectedModel = computed(
  () =>
    models.value.find((model) => model.modelId === userModelId.value) ?? null,
);

watch(selectedModel, (model) => {
  if (model && !model.thinkingLevels.includes(userThinkingLevel.value)) {
    userThinkingLevel.value = model.thinkingLevels[0] ?? "medium";
  }
});

const steerTarget = computed<RunSummary | null>(() => {
  const run = props.activeRun;
  if (!run || run.state !== "running") return null;
  return run;
});
const admittedRun = computed<RunSummary | null>(() => {
  const run = props.activeRun;
  if (!run || isTerminalRunState(run.state)) return null;
  return run;
});

const effectiveProfile = computed<ExecutionProfile | null>(() => {
  if (userModelId.value === "") return null;
  return {
    modelId: userModelId.value,
    thinkingLevel: userThinkingLevel.value,
  } as ExecutionProfile;
});

const pending = ref(false);
const error = ref<string | null>(null);

const canType = computed(
  () =>
    props.sessionId !== undefined && props.sessionAvailable && !pending.value,
);
const canSubmit = computed(
  () => canType.value && draftText.value.trim() !== "",
);

async function run(action: () => Promise<unknown>): Promise<boolean> {
  pending.value = true;
  error.value = null;
  try {
    await action();
    return true;
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "操作失败，请重试";
    return false;
  } finally {
    pending.value = false;
  }
}

/** Ordinary prompt submission always creates a Run, even while busy. */
async function sendPrimary(): Promise<void> {
  const text = draftText.value.trim();
  const sessionId = props.sessionId;
  const profile = effectiveProfile.value;
  if (text === "" || sessionId === undefined || pending.value) return;
  if (profile === null) {
    error.value = "没有可用模型，请先完成 Provider 授权。";
    return;
  }
  const ok = await run(() =>
    client.runs.create({
      sessionId,
      commandId: newCommandId(),
      prompt: text,
      executionProfile: profile,
    }),
  );
  if (ok) clearDraft();
}

async function steerRun(): Promise<void> {
  const text = draftText.value.trim();
  const target = steerTarget.value;
  if (text === "" || !target || pending.value) return;
  const ok = await run(() =>
    client.runs.steer({
      runId: target.runId,
      commandId: newCommandId(),
      instruction: text,
    }),
  );
  if (ok) clearDraft();
}

async function cancelRun(): Promise<void> {
  const target = admittedRun.value;
  if (!target || pending.value) return;
  await run(() =>
    client.runs.cancel({ runId: target.runId, commandId: newCommandId() }),
  );
}
</script>

<template>
  <form class="composer" @submit.prevent="sendPrimary">
    <div class="composer-profile">
      <label class="profile-field">
        <span class="profile-label">模型</span>
        <select
          v-model="userModelId"
          class="field"
          :disabled="models.length === 0"
          aria-label="模型"
        >
          <option v-if="models.length === 0" value="">无可用模型</option>
          <option
            v-for="model in models"
            :key="model.modelId"
            :value="model.modelId"
            :disabled="!model.available"
          >
            {{ model.name }}{{ model.available ? "" : "（不可用）" }}
          </option>
        </select>
      </label>
      <label class="profile-field">
        <span class="profile-label">思考级别</span>
        <select
          v-model="userThinkingLevel"
          class="field"
          :disabled="!selectedModel"
          aria-label="思考级别"
        >
          <option
            v-for="level in selectedModel?.thinkingLevels ?? []"
            :key="level"
            :value="level"
          >
            {{ level }}
          </option>
        </select>
      </label>
      <span v-if="admittedRun" class="badge" data-tone="warning">
        当前 Run：{{ admittedRun.executionProfile.modelId }} /
        {{ admittedRun.executionProfile.thinkingLevel }}（已冻结）
      </span>
    </div>

    <label class="visually-hidden" for="prompt-input">输入 Prompt</label>
    <textarea
      id="prompt-input"
      v-model="draftText"
      class="field composer-input"
      rows="3"
      placeholder="输入 Prompt，Enter 发送，Shift+Enter 换行"
      :disabled="!canType"
      @keydown.enter.exact.prevent="sendPrimary"
    ></textarea>

    <p v-if="error" class="composer-error" role="alert">{{ error }}</p>

    <div class="composer-actions">
      <button type="submit" class="btn btn-primary" :disabled="!canSubmit">
        {{ admittedRun ? "排队新 Run" : "发送" }}
      </button>
      <button
        v-if="steerTarget"
        type="button"
        class="btn"
        :disabled="!canSubmit"
        @click="steerRun"
      >
        Steer 当前 Run
      </button>
      <button
        v-if="admittedRun"
        type="button"
        class="btn btn-danger"
        :disabled="pending"
        @click="cancelRun"
      >
        取消运行
      </button>
    </div>
  </form>
</template>

<style scoped>
.composer {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--color-border);
  background: var(--color-surface);
}

.composer-profile {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.profile-field {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.profile-label {
  font-size: var(--text-xs);
  color: var(--color-foreground-muted);
}

.profile-field .field {
  width: auto;
  min-height: var(--target-min);
}

.composer-input {
  font-family: var(--font-ui);
}

.composer-error {
  color: var(--color-danger);
  font-size: var(--text-sm);
  margin: 0;
}

.composer-actions {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}
</style>
