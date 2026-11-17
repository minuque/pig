import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"
import { environmentFor } from "@pig/environment/source"

import { fromEntries } from "../remote-workspace/index.ts"
import { expandFileMentions } from "./expand.ts"

/** @ 文件引用：交给模型前把 @path 展开成 <file> 块；远程会话读远端 workspace 里的文件。 */
export default function fileMentions(pi: ExtensionAPI) {
  // prompt 与运行中的 steer 都经过 input
  pi.on("input", async (event, ctx) => {
    const binding = fromEntries(ctx)
    const text = await (binding
      ? expandFileMentions(event.text, binding.path, environmentFor(binding.environment))
      : expandFileMentions(event.text, ctx.cwd))
    return text === event.text ? undefined : { action: "transform", text }
  })
}
