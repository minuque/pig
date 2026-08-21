import { readonly, shallowRef } from "vue";
import { useRouter } from "vue-router";
import { bootstrapFromUrl } from "@client/bootstrap.js";
import { errorMessage } from "@client/http.js";
import { setStartupError } from "@features/startup/hooks/use-startup-error.js";

export interface StartupSequenceOptions {
  connect: () => Promise<unknown>;
  initialize: () => Promise<unknown>;
  bootstrap?: () => Promise<void>;
  /** 连接网关超时，超时视为启动失败并进 `/error`。0 表示不等待超时。 */
  connectTimeoutMs?: number;
}

const DEFAULT_CONNECT_TIMEOUT_MS = 8_000;

function connectWithTimeout(connect: () => Promise<unknown>, ms: number): Promise<unknown> {
  const connecting = Promise.resolve(connect());
  if (ms <= 0) return connecting;
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      void connecting.catch(() => {});
      reject(new Error("连接网关超时"));
    }, ms);
    connecting.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * 启动序列：bootstrap → connect → initialize，与遮罩动画并行。
 * 失败只写入错误并进 `/error`，不打断 Logo 离场。
 */
export function useStartupSequence(options: StartupSequenceOptions) {
  const router = useRouter();
  const visible = shallowRef(true);
  const concealed = shallowRef(true);
  const ready = shallowRef(false);
  const failed = shallowRef(false);

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
      await connectWithTimeout(
        options.connect,
        options.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS,
      );
      await options.initialize();
      ready.value = true;
      if (router.currentRoute.value.name === "error") await router.replace("/");
    } catch (error) {
      failed.value = true;
      setStartupError(errorMessage(error));
      await router.replace({ name: "error" });
    }
  }

  return {
    visible: readonly(visible),
    concealed: readonly(concealed),
    ready: readonly(ready),
    failed: readonly(failed),
    reveal,
    finish,
    start,
  };
}
