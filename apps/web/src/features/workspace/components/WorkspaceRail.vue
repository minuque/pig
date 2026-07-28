<script setup lang="ts">
import type { WorkspaceId } from "@no-pi-no-gang/contracts";
import { useQuery, useQueryClient } from "@tanstack/vue-query";
import { computed, ref } from "vue";
import RegisterDialog from "@/features/workspace/components/RegisterDialog.vue";
import { useGatewayClient } from "@/lib/gateway/client-context";
import { gatewayKeys } from "@/lib/gateway/keys";

/**
 * Compact Workspace rail: the durable Workspace list (Vue Query, REST
 * re-fetchable) plus the entry point for the registration flow. Selection is
 * owned by the Router via the `select` emit.
 */
const props = defineProps<{ activeWorkspaceId: WorkspaceId | undefined }>();
const emit = defineEmits<{ select: [WorkspaceId] }>();

const client = useGatewayClient();
const queryClient = useQueryClient();

const listQuery = useQuery({
  queryKey: gatewayKeys.workspaces.list(),
  queryFn: () => client.workspaces.list({ limit: 100 }),
});
const workspaces = computed(() => listQuery.data.value?.items ?? []);

const registerOpen = ref(false);

async function onRegistered(workspaceId: WorkspaceId): Promise<void> {
  await queryClient.invalidateQueries({
    queryKey: gatewayKeys.workspaces.list(),
  });
  emit("select", workspaceId);
}
</script>

<template>
  <nav class="workspace-rail" aria-label="工作区">
    <p v-if="listQuery.isPending.value" class="rail-empty">正在加载…</p>
    <p v-else-if="workspaces.length === 0" class="rail-empty">还没有工作区。注册一个以开始。</p>

    <ul v-else class="workspace-list">
      <li v-for="workspace in workspaces" :key="workspace.workspaceId">
        <button
          type="button"
          class="workspace-select"
          :data-active="workspace.workspaceId === props.activeWorkspaceId"
          :aria-current="workspace.workspaceId === props.activeWorkspaceId ? 'page' : undefined"
          @click="emit('select', workspace.workspaceId)"
        >
          {{ workspace.name }}
        </button>
      </li>
    </ul>

    <button
      type="button"
      class="btn rail-register"
      aria-haspopup="dialog"
      @click="registerOpen = true"
    >
      注册工作区
    </button>

    <RegisterDialog :open="registerOpen" @close="registerOpen = false" @registered="onRegistered" />
  </nav>
</template>

<style scoped>
.workspace-rail {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  height: 100%;
}

.rail-empty {
  color: var(--color-foreground-muted);
  font-size: var(--text-sm);
}

.workspace-list {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  flex: 1;
}

.workspace-select {
  width: 100%;
  min-height: var(--target-min);
  padding: 0 var(--space-2);
  border: 0;
  background: transparent;
  text-align: left;
  border-radius: var(--radius-control);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workspace-select:hover {
  background: var(--color-surface-muted);
}

.workspace-select[data-active="true"] {
  background: var(--color-surface-muted);
  font-weight: 600;
}

.rail-register {
  flex-shrink: 0;
}
</style>
