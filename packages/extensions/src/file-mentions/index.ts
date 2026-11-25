import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"

import { expandFileMentions } from "./expand.ts"

export default function fileMentions(pi: ExtensionAPI) {
  // 外部：pi 的 input 事件同时覆盖 prompt 与运行中的 steer
  pi.on("input", async (event, ctx) => {
    const text = await expandFileMentions(event.text, ctx.cwd)
    return text === event.text ? undefined : { action: "transform", text }
  })
}
