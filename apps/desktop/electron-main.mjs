// 外部：Chromium 会把 `electron --import tsx` 里的 tsx 当成 app 路径，只能用独立 JS 注册再加载
import { register } from "tsx/esm/api"

register()

await import("./src/main/index.ts")
