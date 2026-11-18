/** gateway utilityProcess 的开发态入口：同 electron-main.mjs，先注册 tsx 再加载 TypeScript。 */
import { register } from "tsx/esm/api"

register()

await import("./src/main/gateway-child.ts")
