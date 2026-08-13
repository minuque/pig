<template>
  <section class="welcome" aria-labelledby="welcome-title">
    <div class="welcome-form">
      <h1 id="welcome-title" class="welcome-title">开始一个新任务</h1>

      <ChatInput
        v-model:prompt="welcomePrompt"
        v-model:preset="preset"
        :catalog="catalog"
        :send-disabled="!canSubmitNow"
        bare
        placeholder="想完成什么？"
        aria-label="任务描述"
        @send="submitWelcome"
      >
      </ChatInput>

      <p v-if="welcomeError" class="notice error" role="alert">{{ welcomeError }}</p>
    </div>
  </section>
</template>

<script lang="ts">
import type { ComposerPreset } from "@components/composer/types.js";

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
import { useWorkspace } from "@app/hooks/use-app.js";
import ChatInput from "@components/composer/ChatInput.vue";
import { useWelcomeSubmit } from "@features/sessions/hooks/use-welcome-submit.js";

const { workspaces, catalog, lastCwd, preset, createSession, submitText } = useWorkspace();
const { welcomePrompt, welcomeWorkspaceId, welcomeSubmitting, welcomeError, submitWelcome } =
  useWelcomeSubmit({
    workspaces,
    lastCwd,
    preset,
    createSession,
    submit: submitText,
  });

const canSubmitNow = computed(() =>
  canSubmit(welcomePrompt.value, welcomeWorkspaceId.value, preset.value, welcomeSubmitting.value),
);
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
