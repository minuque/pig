import type { ModelMetadata, ModelRef, ThinkingLevel } from "@earendil-works/pi-protocol";

/** 模型选择目录的本地 UI 类型：由官方 ModelMetadata 投影，替代 @pig/contracts 导入。 */
export interface ComposerModelInfo {
  id: string;
  name: string;
  reasoning: boolean;
  thinkingLevels: string[];
  contextWindow?: number;
  description?: string;
}

export interface ComposerVendor {
  id: string;
  name: string;
  models: ComposerModelInfo[];
}

/** 执行档：model 为 "provider/id"，thinkingLevel 为可读字符串（与旧 UI 一致）。 */
export interface ComposerPreset {
  model: string;
  thinkingLevel: string;
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
      reasoning: model.reasoning,
      thinkingLevels: [...model.supportedThinkingLevels],
      ...(model.contextWindow ? { contextWindow: model.contextWindow } : {}),
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
    return { model: `${vendor.id}/${first.id}`, thinkingLevel: first.thinkingLevels[0] ?? "" };
  }
  return undefined;
}

/** ComposerPreset → 官方 ModelRef（provider/id 字符串拆分）。 */
export function modelRefOf(preset: ComposerPreset): ModelRef {
  const sep = preset.model.indexOf("/");
  return sep === -1
    ? { provider: preset.model, id: "" }
    : { provider: preset.model.slice(0, sep), id: preset.model.slice(sep + 1) };
}

/** 字符串 thinkingLevel → 官方 ThinkingLevel；未知值回退 "off"。 */
export function thinkingLevelOf(level: string): ThinkingLevel {
  return (["off", "minimal", "low", "medium", "high", "xhigh", "max"] as const).includes(
    level as ThinkingLevel,
  )
    ? (level as ThinkingLevel)
    : "off";
}
