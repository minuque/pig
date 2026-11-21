import { join } from "node:path"
import { fileURLToPath } from "node:url"

// 外部：打包后 web/ 由 electron-builder 的 extraResources 放到 resources 下
export function resolveWebRoot(
  isDev: boolean,
  isPackaged: boolean,
  moduleUrl: string,
  resourcesPath: string,
): string | undefined {
  if (isDev) return undefined

  if (isPackaged) return join(resourcesPath, "web")
  return fileURLToPath(new URL("../../../web/dist", moduleUrl))
}
