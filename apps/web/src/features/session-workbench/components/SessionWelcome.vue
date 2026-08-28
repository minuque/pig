<template>
  <section class="welcome" aria-labelledby="welcome-title">
    <div class="welcome-form">
      <WorkbenchHero
        v-model:workspace-id="welcomeWorkspaceId"
        title-id="welcome-title"
        :workspaces="workspaces"
        :adding="addingWorkspace"
        @add="addWorkspace()"
      />

      <ChatInput
        v-model:prompt="welcomePrompt"
        v-model:preset="preset"
        :catalog="catalog"
        :send-disabled="!canSubmitNow"
        bare
        placeholder="do what you want ..."
        aria-label="任务描述"
        @send="submitWelcome"
      />

      <p v-if="welcomeError" class="notice error" role="alert">{{ welcomeError }}</p>
    </div>
  </section>
</template>

<script lang="ts">
import type { ChatInputPreset } from "@features/chat-input/types.js"

/** 外部禁用只拦无 workspace / 无 preset / 提交中。空白 prompt 由输入卡负责。 */
export function canSubmit(
  workspaceId: string | undefined,
  preset: ChatInputPreset | undefined,
  submitting: boolean,
): boolean {
  return workspaceId !== undefined && preset !== undefined && !submitting
}

/** 当前选择仍存在于列表时保留，否则回退到最近使用的目录或第一个目录。 */
export function nextWelcomeWorkspaceId(
  workspaces: readonly string[],
  current: string | undefined,
  lastCwd: string | undefined,
): string | undefined {
  if (workspaces.includes(current ?? "")) return current
  if (lastCwd !== undefined && workspaces.includes(lastCwd)) return lastCwd
  return workspaces[0]
}
</script>

<script setup lang="ts">
import { computed, ref, watch } from "vue"
import { useNav } from "@features/session-nav/index.js"
import { useSession } from "@features/session-workbench/index.js"
import ChatInput from "@features/chat-input/index.vue"
import WorkbenchHero from "@features/session-workbench/components/WorkbenchHero.vue"

const { groups, lastCwd, addingWorkspace, addWorkspace } = useNav()
const { catalog, preset, createAndSubmit } = useSession()
/** 与侧栏同一份目录：已授权 local + 会话 cwd。 */
const workspaces = computed(() => groups.value.map((group) => group.canonicalPath))
const welcomePrompt = ref("")
const welcomeWorkspaceId = ref<string>()
const welcomeSubmitting = ref(false)
const welcomeError = ref("")

watch(
  [workspaces, lastCwd],
  ([items, last]) => {
    welcomeWorkspaceId.value = nextWelcomeWorkspaceId(items, welcomeWorkspaceId.value, last)
  },
  { immediate: true },
)

async function submitWelcome(text: string) {
  const cwd = welcomeWorkspaceId.value
  const trimmed = text.trim()
  if (!cwd || !preset.value || !trimmed || welcomeSubmitting.value) return
  welcomeSubmitting.value = true
  welcomeError.value = ""
  try {
    await createAndSubmit(cwd, trimmed)
    welcomePrompt.value = ""
  } catch (error) {
    welcomeError.value = error instanceof Error ? error.message : String(error)
  } finally {
    welcomeSubmitting.value = false
  }
}

const canSubmitNow = computed(() =>
  canSubmit(welcomeWorkspaceId.value, preset.value, welcomeSubmitting.value),
)
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
  width: min(var(--size-composer), 100%);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}
.welcome-form > .notice {
  margin-top: 0;
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
