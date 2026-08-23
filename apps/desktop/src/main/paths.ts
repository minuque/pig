import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const WEB_ROOT_MISSING_UNPACKAGED =
  "未找到 Web 构建产物（apps/web/dist）。请先执行 pnpm --filter @pig/web build。";
export const WEB_ROOT_MISSING_PACKAGED = "安装包资源缺失。";

export type ResolveWebRootInput = {
  isDev: boolean;
  isPackaged: boolean;
  moduleUrl: string;
  resourcesPath: string;
};

/** 开发走 Vite，不设 webRoot；打包后用 extraResources 的 web/。 */
export function resolveWebRoot(input: ResolveWebRootInput): string | undefined {
  if (input.isDev) return undefined;
  if (input.isPackaged) return join(input.resourcesPath, "web");
  return fileURLToPath(new URL("../../../web/dist", input.moduleUrl));
}

export function webRootMissingMessage(isPackaged: boolean): string {
  return isPackaged ? WEB_ROOT_MISSING_PACKAGED : WEB_ROOT_MISSING_UNPACKAGED;
}

/** src/main 与 out/main 相对 ../preload/index.js 都成立。 */
export function resolvePreloadPath(moduleUrl: string): string {
  return fileURLToPath(new URL("../preload/index.js", moduleUrl));
}
