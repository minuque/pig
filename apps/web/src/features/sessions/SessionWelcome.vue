<template>
  <section class="welcome" aria-labelledby="welcome-title">
    <div class="welcome-form">
      <h1 id="welcome-title" class="welcome-title">开始一个新任务</h1>

      <ChatInput
        v-model:prompt="prompt"
        v-model:preset="preset"
        :catalog="catalog"
        :send-disabled="!canSubmitNow"
        bare
        placeholder="想完成什么？"
        aria-label="任务描述"
        @send="onSend"
      >
        <template #left>
          <select
            v-model="workspaceId"
            class="welcome-workspace"
            aria-label="Workspace"
            :disabled="!workspaces.length"
          >
            <option :value="undefined" disabled>选择 Workspace</option>
            <option v-for="ws in workspaces" :key="ws.canonicalPath" :value="ws.canonicalPath">
              {{ workspaceName(ws.canonicalPath) }}
            </option>
          </select>
        </template>
      </ChatInput>

      <p v-if="!workspaceId" class="welcome-auth">
        <button type="button" class="secondary" @click="emit('add-workspace')">添加本地目录</button>
      </p>

      <p v-if="error" class="notice error" role="alert">{{ error }}</p>
    </div>
  </section>
</template>

<script lang="ts">
import type { ComposerPreset } from "../../components/composer/types.js";

/** 提交守卫：空白 prompt、无 workspace、无 preset 或提交中均拒绝。 */
export function canSubmit(
  prompt: string,
  workspaceId: string | undefined,
  preset: ComposerPreset | undefined,
  submitting: boolean,
): boolean {
  return workspaceId !== undefined && preset !== undefined && !submitting && prompt.trim() !== "";
}
</script>

<script setup lang="ts">
import { computed } from "vue";
import ChatInput from "../../components/composer/ChatInput.vue";
import type { ComposerVendor } from "../../components/composer/types.js";
import { workspaceName, type LocalWorkspace } from "./types.js";

const prompt = defineModel<string>("prompt", { required: true });
const preset = defineModel<ComposerPreset | undefined>("preset");
const workspaceId = defineModel<string | undefined>("workspaceId");

const props = defineProps<{
  workspaces: LocalWorkspace[];
  catalog: ComposerVendor[];
  submitting: boolean;
  error: string;
}>();

const emit = defineEmits<{
  submit: [text: string];
  "add-workspace": [];
}>();

const canSubmitNow = computed(() =>
  canSubmit(prompt.value, workspaceId.value, preset.value, props.submitting),
);

// ChatInput 内部已做发送守卫（含 sendDisabled），这里只转发
function onSend(text: string) {
  emit("submit", text);
}
</script>

<style scoped>
.welcome {
  min-height: 0;
  flex: 1;
  display: grid;
  place-items: center;
  padding: var(--spacing-lg);
}
.welcome-form {
  width: min(var(--size-welcome), 100%);
  transform: translateY(calc(-1 * var(--spacing-xxl)));
  animation: enter-blur var(--duration-slow) var(--ease-out);
}
.welcome-title {
  margin: 0 0 var(--spacing-lg);
  text-align: center;
  font-size: var(--text-heading-2);
  letter-spacing: var(--tracking-heading-2);
}
.welcome-workspace {
  min-width: 0;
  max-width: 42%;
  border: 0;
  border-radius: var(--radius-md);
  background: var(--canvas-soft);
  font-size: var(--text-caption);
  color: var(--ink);
  padding: var(--spacing-xs) var(--spacing-sm);
}
.welcome-auth {
  margin: var(--spacing-md) 0 0;
  text-align: center;
}
.secondary {
  font: inherit;
  font-size: var(--text-caption);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-sm);
  border: var(--border-width) solid var(--hairline);
  background: var(--surface);
  color: var(--ink);
  cursor: pointer;
}
.secondary:hover {
  background: var(--canvas-soft);
}
.welcome-form > .notice {
  margin-top: var(--spacing-md);
}
.notice {
  padding: var(--spacing-md);
  background: var(--canvas-soft);
  border: var(--border-width) solid var(--hairline);
  border-radius: var(--radius-md);
}
.error {
  border-left: var(--border-width-emphasis) solid var(--danger);
}
</style>
