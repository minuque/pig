<script setup lang="ts">
import { useQueryClient } from "@tanstack/vue-query";
import { onBeforeUnmount, ref } from "vue";
import BootFailure from "@/components/BootFailure.vue";
import { GatewaySyncController } from "@/features/sync/gateway-sync-controller";
import { useLiveOverlayStore } from "@/features/sync/live-overlay-store";
import { consumeBootstrapSecret } from "@/lib/gateway/bootstrap-secret";
import { useGatewayClient } from "@/lib/gateway/client-context";
import { setCsrfToken } from "@/lib/gateway/csrf";
import { isAuthProblem } from "@/lib/gateway/errors";
import { gatewayKeys } from "@/lib/gateway/keys";

/**
 * Boot sequence: exchange the one-time fragment bootstrap secret for the
 * process-scoped credential (HttpOnly cookie + CSRF token), capture the
 * authoritative bootstrap snapshot, seed the durable caches, then start the
 * unique Gateway Sync Controller from the captured event cursor. The secret
 * is stripped from the URL immediately after the exchange and never stored.
 */
const client = useGatewayClient();
const queryClient = useQueryClient();
const overlayStore = useLiveOverlayStore();

type BootState = "booting" | "ready" | "failed";

const state = ref<BootState>("booting");
const failure = ref<{ title: string; detail: string; retryable: boolean }>({
  title: "",
  detail: "",
  retryable: false,
});

let controller: GatewaySyncController | null = null;

async function boot(): Promise<void> {
  state.value = "booting";
  try {
    const secret = consumeBootstrapSecret();
    if (secret !== null) {
      const exchanged = await client.gatewayAuth.bootstrap({ secret });
      setCsrfToken(exchanged.csrfToken);
    }
    const bootstrap = await client.bootstrap.get();
    setCsrfToken(bootstrap.csrfToken);
    queryClient.setQueryData(gatewayKeys.models, bootstrap.models);
    queryClient.setQueryData(gatewayKeys.providerAuth, bootstrap.providerAuth);
    overlayStore.resetAll(
      bootstrap.capturedEventCursor,
      bootstrap.nonterminalRuns,
    );
    if (controller === null) {
      controller = new GatewaySyncController({
        client,
        queryClient,
        store: overlayStore,
      });
      controller.start(bootstrap.capturedEventCursor);
    }
    state.value = "ready";
  } catch (cause) {
    if (isAuthProblem(cause)) {
      failure.value = {
        title: "需要重新建立安全连接",
        detail:
          "启动链接已失效或已被使用。请回到终端，重新打开 no-pi-no-gang 输出的启动链接。",
        retryable: false,
      };
    } else {
      failure.value = {
        title: "无法连接本地 Gateway",
        detail: cause instanceof Error ? cause.message : "发生未知错误。",
        retryable: true,
      };
    }
    state.value = "failed";
  }
}

void boot();

onBeforeUnmount(() => {
  void controller?.stop();
});
</script>

<template>
  <main v-if="state === 'booting'" class="boot-pending">
    <p role="status">正在连接本地 Gateway…</p>
  </main>
  <BootFailure
    v-else-if="state === 'failed'"
    :title="failure.title"
    :detail="failure.detail"
    :retryable="failure.retryable"
    @retry="boot"
  />
  <RouterView v-else />
</template>

<style scoped>
.boot-pending {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-foreground-muted);
}
</style>
