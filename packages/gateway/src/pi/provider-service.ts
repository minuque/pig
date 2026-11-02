import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { getAgentDir, SettingsManager } from "@earendil-works/pi-coding-agent"
import type { ModelMetadata } from "@earendil-works/pi-protocol"
import { toProtocolModelMetadata } from "@earendil-works/pi-server"

import {
  projectProvider,
  type DefaultModelView,
  type ModelRuntimeLike,
  type ProviderView,
} from "./provider-view.js"

export interface ProviderServiceOptions {
  runtime: () => Promise<ModelRuntimeLike>
  /** 凭据与配置目录；缺省 ~/.pi/agent。 */
  agentDir?: string
  /** models.json 路径；缺省 agentDir/models.json。 */
  modelsPath?: string
}

/** 供应商列表、模型目录与后续的登录/配置写入共用的 runtime 门面。 */
export class ProviderService {
  readonly agentDir: string
  readonly modelsPath: string
  private settingsPromise?: Promise<SettingsManager>

  constructor(private readonly options: ProviderServiceOptions) {
    this.agentDir = options.agentDir ?? getAgentDir()
    this.modelsPath = options.modelsPath ?? join(this.agentDir, "models.json")
  }

  async listProviders(): Promise<{
    providers: ProviderView[]
    defaultModel: DefaultModelView | null
  }> {
    const runtime = await this.runtime()
    const settings = await this.settings()
    const thinkingLevels = settings.getAllModelThinkingLevels()
    const customIds = await this.customProviderIds()
    const providers = runtime
      .getProviders()
      .map((provider) =>
        projectProvider(
          provider,
          runtime.getProviderAuthStatus(provider.id),
          provider.getModels(),
          thinkingLevels,
          customIds.has(provider.id) ? "custom" : "builtin",
        ),
      )
    const provider = settings.getDefaultProvider()
    const id = settings.getDefaultModel()
    return { providers, defaultModel: provider && id ? { provider, id } : null }
  }

  async listModels(): Promise<{ models: ModelMetadata[] }> {
    const runtime = await this.runtime()
    const models = await runtime.getAvailable()
    return {
      models: models.map((model) =>
        toProtocolModelMetadata(model, runtime.hasConfiguredAuth(model.provider)),
      ),
    }
  }

  protected runtime(): Promise<ModelRuntimeLike> {
    return this.options.runtime()
  }

  private settings(): Promise<SettingsManager> {
    return (this.settingsPromise ??= Promise.resolve(
      SettingsManager.create(this.agentDir, this.agentDir),
    ))
  }

  private async customProviderIds(): Promise<Set<string>> {
    try {
      const parsed: unknown = JSON.parse(await readFile(this.modelsPath, "utf-8"))
      const providers = (parsed as { providers?: unknown })?.providers
      return new Set(providers && typeof providers === "object" ? Object.keys(providers) : [])
    } catch {
      return new Set()
    }
  }
}
