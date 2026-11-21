import { ModelRuntime } from "@earendil-works/pi-coding-agent"
import { join } from "node:path"

import {
  fauxAssistantMessage,
  fauxProvider,
  fauxText,
  type FauxResponseFactory,
} from "../../packages/gateway/node_modules/@earendil-works/pi-ai/dist/providers/faux.js"

export const FAUX_MODEL = { provider: "faux", id: "faux-1" } as const
export const fauxReply = (n: number) => `e2e 替身第 ${n} 次回答`

export async function createReplyRuntime(agentDir: string): Promise<ModelRuntime> {
  const faux = fauxProvider({
    api: "faux",
    provider: FAUX_MODEL.provider,
    models: [{ id: FAUX_MODEL.id, name: "E2e Faux" }],
  })
  const reply: FauxResponseFactory = (_context, _options, state) =>
    fauxAssistantMessage(fauxText(fauxReply(state.callCount)))
  const runtime = await ModelRuntime.create({
    allowModelNetwork: false,
    authPath: join(agentDir, "auth.json"),
    modelsPath: join(agentDir, "models.json"),
  })

  faux.setResponses(Array.from({ length: 4 }, () => reply))
  runtime.registerNativeProvider(faux.provider)
  return runtime
}
