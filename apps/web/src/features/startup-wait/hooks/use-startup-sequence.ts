import { readonly, shallowRef } from "vue";
import { useRouter } from "vue-router";
import { bootstrapFromUrl } from "@client/bootstrap.js";
import { errorMessage } from "@client/http.js";
import { setStartupError } from "@features/startup-wait/hooks/use-startup-error.js";
import type { StartupPhase } from "@features/startup-wait/types.js";

export interface StartupSequenceOptions {
  connect: () => Promise<unknown>;
  initialize: () => Promise<unknown>;
  bootstrap?: () => Promise<void>;
}

/**
 * 启动门状态机：bootstrap → connect → initialize。
 * 失败写入启动错误并进 `/error`；成功时若停在错误页则回 `/`。
 */
export function useStartupSequence(options: StartupSequenceOptions) {
  const router = useRouter();
  const visible = shallowRef(true);
  const concealed = shallowRef(true);
  const ready = shallowRef(false);
  const failed = shallowRef(false);
  const phase = shallowRef<StartupPhase>("authorizing");

  function reveal() {
    concealed.value = false;
  }

  function finish() {
    concealed.value = false;
    visible.value = false;
  }

  async function start() {
    try {
      await (options.bootstrap ?? bootstrapFromUrl)();
      phase.value = "connecting";
      await options.connect();
      phase.value = "preparing";
      await options.initialize();
      ready.value = true;
      if (router.currentRoute.value.name === "error") await router.replace("/");
    } catch (error) {
      failed.value = true;
      setStartupError(errorMessage(error));
      await router.replace({ name: "error" });
      concealed.value = false;
      visible.value = false;
    }
  }

  return {
    visible: readonly(visible),
    concealed: readonly(concealed),
    ready: readonly(ready),
    failed: readonly(failed),
    phase: readonly(phase),
    reveal,
    finish,
    start,
  };
}
