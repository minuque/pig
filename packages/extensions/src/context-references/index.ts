import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"
import { projectContextForAgent } from "@pig/protocol/source"

import { createReadSessionTool } from "./read-session.ts"

export default function contextReferences(pi: ExtensionAPI) {
  pi.on("input", (event) => {
    const text = projectContextForAgent(event.text)
    return text === event.text ? undefined : { action: "transform", text }
  })

  pi.registerTool(createReadSessionTool())
}
