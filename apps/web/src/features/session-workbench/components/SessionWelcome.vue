<template>
  <section class="welcome" aria-labelledby="welcome-title">
    <div class="welcome-form">
      <h1 id="welcome-title" class="welcome-title">开始一个新任务</h1>

      <div v-if="workspaces.length" class="welcome-chips">
        <DropdownMenu :modal="false">
          <DropdownMenuTrigger as-child>
            <button type="button" class="workspace-chip" :aria-label="`工作区：${chipLabel}`">
              <Folder :size="14" aria-hidden="true" />
              <span class="workspace-chip-name">{{ chipLabel }}</span>
              <ChevronDown :size="12" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" :side-offset="6" aria-label="选择工作区">
            <DropdownMenuItem
              v-for="item in workspaces"
              :key="item.canonicalPath"
              @select="welcomeWorkspaceId = item.canonicalPath"
            >
              {{ workspaceName(item.canonicalPath) }}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ChatInput
        v-model:prompt="welcomePrompt"
        v-model:preset="preset"
        :catalog="catalog"
        :send-disabled="!canSubmitNow"
        bare
        placeholder="给智能体发消息"
        aria-label="任务描述"
        @send="submitWelcome"
      />

      <p v-if="welcomeError" class="notice error" role="alert">{{ welcomeError }}</p>
    </div>
  </section>
</template>

<script lang="ts">
import type { ChatInputPreset } from "@features/chat-input/types.js";

/** 提交守卫：空白 prompt、无 workspace、无 preset 或提交中均拒绝。 */
export function canSubmit(
  prompt: string,
  workspaceId: string | undefined,
  preset: ChatInputPreset | undefined,
  submitting: boolean,
): boolean {
  return workspaceId !== undefined && preset !== undefined && !submitting && prompt.trim() !== "";
}
</script>

<script setup lang="ts">
import { computed } from "vue";
import { ChevronDown, Folder } from "lucide-vue-next";
import { useWorkspace } from "@app/hooks/use-app.js";
import ChatInput from "@features/chat-input/index.vue";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@components/ui/dropdown-menu/index.js";
import { useWelcomeSubmit } from "@features/session-workbench/hooks/use-welcome-submit.js";
import { workspaceName } from "@features/session-nav/types.js";

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
const chipLabel = computed(() =>
  welcomeWorkspaceId.value ? workspaceName(welcomeWorkspaceId.value) : "选择工作区",
);
</script>

<style scoped>
.welcome {
  min-height: 0;
  flex: 1;
  display: grid;
  place-items: center;
  padding: 0 var(--spacing-md);
}
.welcome-form {
  /* 与非 bare ChatInput 同宽，chat-input 卡本身由 PromptEditor 提供 */
  width: min(var(--size-content), 100%);
}
.welcome-title {
  margin: 0 0 var(--spacing-md);
  text-align: center;
  font-size: var(--text-heading-2);
  letter-spacing: var(--tracking-heading-2);
}
.welcome-chips {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: var(--spacing-xs);
  margin: 0 0 var(--spacing-sm);
}
.workspace-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 28px;
  padding: 0 8px;
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--ink-muted);
  font-size: var(--text-body-sm);
}
.workspace-chip:hover {
  background: color-mix(in srgb, var(--ink) 6%, transparent);
  color: var(--ink);
}
.workspace-chip-name {
  max-width: 12rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.welcome-form > .notice {
  margin-top: var(--spacing-md);
}
.notice {
  padding: var(--spacing-sm) var(--spacing-md);
  background: transparent;
  border: 0;
  color: var(--ink-muted);
}
.error {
  color: var(--danger);
}
</style>
