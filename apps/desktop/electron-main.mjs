/**
 * Electron 入口。Chromium 会把 `electron --import tsx` 里的 tsx 当成 app 路径，
 * 必须用独立 JS 注册 tsx 再加载 TypeScript main。
 */
import { register } from "tsx/esm/api";

register();
await import("./src/main/index.ts");
