<script setup lang="ts">
import type { WorkspaceId } from "@no-pi-no-gang/contracts";
import { ref, watch } from "vue";
import AppSheet from "@/components/AppSheet.vue";
import { useGatewayClient } from "@/lib/gateway/client-context";
import { newCommandId } from "@/lib/utils/command";

/**
 * Two-step Workspace registration: preview the candidate path (canonical
 * root + grant notice), then confirm with a display name. The grant notice
 * is shown verbatim — a Workspace grant protects Gateway resources only and
 * is not a filesystem sandbox.
 */
const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{
  close: [];
  registered: [WorkspaceId];
}>();

const client = useGatewayClient();

const candidatePath = ref("");
const previewId = ref<string | null>(null);
const canonicalRoot = ref("");
const grantNotice = ref("");
const name = ref("");
const pending = ref(false);
const error = ref<string | null>(null);

function reset(): void {
  candidatePath.value = "";
  previewId.value = null;
  canonicalRoot.value = "";
  grantNotice.value = "";
  name.value = "";
  pending.value = false;
  error.value = null;
}

watch(
  () => props.open,
  (open) => {
    if (!open) reset();
  },
);

async function preview(): Promise<void> {
  const path = candidatePath.value.trim();
  if (path === "" || pending.value) return;
  pending.value = true;
  error.value = null;
  try {
    const result = await client.workspaces.preview({
      commandId: newCommandId(),
      candidatePath: path,
    });
    previewId.value = result.result.previewId;
    canonicalRoot.value = result.result.canonicalRoot;
    grantNotice.value = result.result.grantNotice;
    const segments = result.result.canonicalRoot.split(/[\\/]/).filter((segment) => segment !== "");
    name.value = segments[segments.length - 1] ?? result.result.canonicalRoot;
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "路径预览失败";
  } finally {
    pending.value = false;
  }
}

async function confirm(): Promise<void> {
  const id = previewId.value;
  const displayName = name.value.trim();
  if (id === null || displayName === "" || pending.value) return;
  pending.value = true;
  error.value = null;
  try {
    const result = await client.workspaces.create({
      commandId: newCommandId(),
      previewId: id,
      name: displayName,
    });
    emit("registered", result.result.workspaceId);
    emit("close");
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "注册工作区失败";
  } finally {
    pending.value = false;
  }
}
</script>

<template>
  <AppSheet :open="open" title="注册工作区" @close="emit('close')">
    <div class="register">
      <template v-if="previewId === null">
        <label class="register-label" for="candidate-path">工作区路径</label>
        <input
          id="candidate-path"
          v-model="candidatePath"
          class="field"
          type="text"
          placeholder="/absolute/path/to/project"
          @keydown.enter.prevent="preview"
        />
        <p v-if="error" class="register-error" role="alert">{{ error }}</p>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="candidatePath.trim() === '' || pending"
          @click="preview"
        >
          预览路径
        </button>
      </template>

      <template v-else>
        <dl class="register-preview">
          <dt>规范化根路径</dt>
          <dd class="register-root">{{ canonicalRoot }}</dd>
          <dt>授权说明</dt>
          <dd class="notice-box">{{ grantNotice }}</dd>
        </dl>
        <label class="register-label" for="workspace-name">显示名称</label>
        <input
          id="workspace-name"
          v-model="name"
          class="field"
          type="text"
          maxlength="120"
          @keydown.enter.prevent="confirm"
        />
        <p v-if="error" class="register-error" role="alert">{{ error }}</p>
        <div class="register-actions">
          <button type="button" class="btn" :disabled="pending" @click="reset">上一步</button>
          <button
            type="button"
            class="btn btn-primary"
            :disabled="name.trim() === '' || pending"
            @click="confirm"
          >
            确认注册
          </button>
        </div>
      </template>
    </div>
  </AppSheet>
</template>

<style scoped>
.register {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.register-label {
  font-size: var(--text-sm);
  color: var(--color-foreground-muted);
}

.register-preview {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.register-preview dt {
  font-size: var(--text-xs);
  color: var(--color-foreground-muted);
}

.register-preview dd {
  margin: 0;
}

.register-root {
  font-family: var(--font-code);
  font-size: var(--text-sm);
  overflow-wrap: anywhere;
}

.register-error {
  color: var(--color-danger);
  font-size: var(--text-sm);
  margin: 0;
}

.register-actions {
  display: flex;
  gap: var(--space-2);
  justify-content: flex-end;
}
</style>
