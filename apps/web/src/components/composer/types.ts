import type { ModelMetadata, ModelRef, ThinkingLevel } from "@earendil-works/pi-protocol";

/** 模型选择目录的本地 UI 类型：由官方 ModelMetadata 投影。 */
export interface ComposerModelInfo {
  id: string;
  name: string;
  thinkingLevels: string[];
  description?: string;
}

export interface ComposerVendor {
  id: string;
  name: string;
  models: ComposerModelInfo[];
}

/** 执行档全程保留官方 ModelRef；字符串只用于展示。 */
export interface ComposerPreset {
  model: ModelRef;
  thinkingLevel: string;
}

export function sameModel(a: ModelRef | undefined, b: ModelRef | undefined): boolean {
  return a?.provider === b?.provider && a?.id === b?.id;
}

export function modelLabel(model: ModelRef | undefined): string {
  return model ? `${model.provider}/${model.id}` : "—";
}

/** 官方 ModelMetadata → 供应商目录；保留服务端顺序。 */
export function catalogFromModels(models: readonly ModelMetadata[]): ComposerVendor[] {
  const vendors = new Map<string, ComposerVendor>();
  for (const model of models) {
    const vendor = vendors.get(model.provider) ?? {
      id: model.provider,
      name: model.provider,
      models: [],
    };
    vendor.models.push({
      id: model.id,
      name: model.name,
      thinkingLevels: [...model.supportedThinkingLevels],
    });
    vendors.set(model.provider, vendor);
  }
  return [...vendors.values()];
}

/** 目录首个可用模型的默认执行档；目录为空时返回 undefined。 */
export function defaultPresetFrom(catalog: readonly ComposerVendor[]): ComposerPreset | undefined {
  for (const vendor of catalog) {
    const first = vendor.models[0];
    if (!first) continue;
    return {
      model: { provider: vendor.id, id: first.id },
      thinkingLevel: first.thinkingLevels[0] ?? "",
    };
  }
  return undefined;
}

/** 字符串 thinkingLevel → 官方 ThinkingLevel；未知值回退 "off"。 */
export function thinkingLevelOf(level: string): ThinkingLevel {
  return (["off", "minimal", "low", "medium", "high", "xhigh", "max"] as const).includes(
    level as ThinkingLevel,
  )
    ? (level as ThinkingLevel)
    : "off";
}
