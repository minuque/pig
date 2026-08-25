import { join } from "node:path"
import { fileURLToPath } from "node:url"

/** 开发走 Vite，不设 webRoot；打包后用 extraResources 的 web/。 */
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
