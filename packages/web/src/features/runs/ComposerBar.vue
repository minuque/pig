<template>
  <form class="prompt" :class="{ disabled: unavailable }" @submit.prevent="emit('send')">
    <div v-if="activeRun && !unavailable" class="c-status">
      <RunStatusBadge :status="activeRun.status" />
      <span v-if="queuedCount" class="c-note">队列 {{ queuedCount }}（FIFO）</span>
      <span style="flex: 1"></span>
      <button
        type="button"
        class="secondary"
        :disabled="cancelling.has(activeRun.id)"
        @click="emit('cancel-run', activeRun)"
      >
        {{ cancelling.has(activeRun.id) ? "取消中…" : "取消 Run" }}
      </button>
    </div>
    <div class="composer-row">
      <label for="prompt-input">Composer</label>
      <select v-model="profile" aria-label="Execution profile" :disabled="unavailable">
        <option v-for="item in profiles" :key="`${item.model}:${item.thinkingLevel}`" :value="item">
          {{ item.model }} · {{ item.thinkingLevel }}
        </option>
      </select>
    </div>
    <textarea
      id="prompt-input"
      v-model="prompt"
      rows="3"
      :disabled="unavailable"
      :required="!unavailable"
    ></textarea>
    <p v-if="unavailable" class="c-reason" role="status">
      Unavailable Session 拒绝新的 Run — 源无法安全恢复，可查看最后验证的信息。
    </p>
    <div v-if="runError" class="notice error" role="alert">{{ runError }}</div>
    <div class="actions composer-actions">
      <span class="badge-profile mono">{{ profileText }}</span>
      <span class="c-note">{{
        unavailable
          ? "模型与 thinking level 在 admission 时冻结"
          : activeRun
            ? "Steer 纠偏当前 Run，不创建新 Run；发送则按 FIFO 排队"
            : "模型与 thinking level 在 admission 时冻结"
      }}</span>
      <span style="flex: 1"></span>
      <button
        v-if="activeRun?.status === 'running' && !unavailable"
        type="button"
        class="secondary"
        :disabled="!prompt.trim()"
        @click="emit('steer')"
      >
        Steer
      </button>
      <button type="submit" :disabled="unavailable || !prompt.trim()">
        {{ activeRun && !unavailable ? "排队" : "发送" }}
      </button>
    </div>
  </form>
</template>

<script setup lang="ts">
import type { ExecutionProfile } from "@no-pi-no-gang/contracts";
import { computed } from "vue";
import type { UiRun } from "./run-state.js";
import RunStatusBadge from "./RunStatusBadge.vue";

const prompt = defineModel<string>("prompt", { required: true });
const profile = defineModel<ExecutionProfile | undefined>("profile");

const props = defineProps<{
  activeRun?: UiRun | undefined;
  queuedCount: number;
  cancelling: Set<string>;
  profiles: ExecutionProfile[];
  unavailable: boolean;
  runError: string;
}>();

const emit = defineEmits<{
  send: [];
  steer: [];
  "cancel-run": [run: UiRun];
}>();

const profileText = computed(() =>
  profile.value ? `${profile.value.model} · ${profile.value.thinkingLevel}` : "—",
);
</script>
