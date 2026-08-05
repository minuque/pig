<template>
  <section class="welcome" aria-labelledby="welcome-title">
    <form class="welcome-form" @submit.prevent="onSubmit">
      <h1 id="welcome-title" class="welcome-title">开始一个新任务</h1>

      <div class="welcome-composer">
        <textarea
          v-model="prompt"
          rows="4"
          placeholder="想完成什么？"
          aria-label="任务描述"
          :disabled="!workspaceId"
          @keydown="onKeydown"
        ></textarea>

        <div class="welcome-controls">
          <select v-model="workspaceId" aria-label="Workspace">
            <option :value="undefined" disabled>选择 Workspace</option>
            <option v-for="ws in workspaces" :key="ws.id" :value="ws.id">{{ ws.name }}</option>
          </select>

          <select v-model="profile" aria-label="Execution Profile">
            <option :value="undefined" disabled>选择 Execution Profile</option>
            <option
              v-for="item in profiles"
              :key="`${item.model}:${item.thinkingLevel}`"
              :value="item"
            >
              {{ item.model }} · {{ item.thinkingLevel }}
            </option>
          </select>

          <span class="welcome-spacer"></span>

          <button type="submit" class="welcome-send" :disabled="!canSubmitNow" aria-label="发送">
            <ArrowUp v-if="!submitting" aria-hidden="true" />
            <span v-else>提交中…</span>
          </button>
        </div>
      </div>

      <p v-if="!workspaceId" class="welcome-auth">
        <button type="button" class="secondary" @click="emit('authorize')">授权 Workspace</button>
      </p>

      <p v-if="error" class="notice error" role="alert">{{ error }}</p>
    </form>
  </section>
</template>

<script lang="ts">
import type { ExecutionProfile } from "@no-pi-no-gang/contracts";

/** 键盘守卫：仅裸 Enter 提交；Shift+Enter 换行、IME 组合期间一律放行。 */
export function shouldSubmitOnKeydown(e: {
  key: string;
  shiftKey: boolean;
  isComposing: boolean;
}): boolean {
  return e.key === "Enter" && !e.shiftKey && !e.isComposing;
}

/** 提交守卫：空白 prompt、无 workspace、无 profile 或提交中均拒绝。 */
export function canSubmit(
  prompt: string,
  workspaceId: string | undefined,
  profile: ExecutionProfile | undefined,
  submitting: boolean,
): boolean {
  return workspaceId !== undefined && profile !== undefined && !submitting && prompt.trim() !== "";
}
</script>

<script setup lang="ts">
import { ArrowUp } from "lucide-vue-next";
import { computed } from "vue";
import type { WorkspaceDto } from "../../api/index.js";

const prompt = defineModel<string>("prompt", { required: true });
const profile = defineModel<ExecutionProfile | undefined>("profile");
const workspaceId = defineModel<string | undefined>("workspaceId");

const props = defineProps<{
  workspaces: WorkspaceDto[];
  profiles: ExecutionProfile[];
  submitting: boolean;
  error: string;
}>();

const emit = defineEmits<{
  submit: [];
  authorize: [];
}>();

const canSubmitNow = computed(() =>
  canSubmit(prompt.value, workspaceId.value, profile.value, props.submitting),
);

function onSubmit() {
  if (canSubmitNow.value) emit("submit");
}

function onKeydown(e: KeyboardEvent) {
  if (!shouldSubmitOnKeydown(e)) return; // Shift+Enter 换行、IME 组合期间不拦截
  e.preventDefault(); // 裸 Enter 不产生换行
  onSubmit();
}
</script>
