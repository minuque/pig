import type { ModelMetadata, ThinkingLevel } from "@/types/common-type.js"
import type {
  ComposerModel,
  ComposerModelInfo,
  ComposerPreset,
  ComposerVendor,
} from "@features/composer/type.js"
import { vendorDisplayName } from "@features/composer/lib/vendor-logo.js"

function filterCatalog(catalog: ComposerVendor[], query: string): ComposerVendor[] {
  const q = query.trim().toLowerCase()

  if (!q) return catalog
  return catalog
    .map((vendor) => ({
      ...vendor,
      models: vendor.models.filter(
        (model) =>
          model.name.toLowerCase().includes(q) ||
          model.id.toLowerCase().includes(q) ||
          vendor.name.toLowerCase().includes(q) ||
          vendor.id.toLowerCase().includes(q),
      ),
    }))
    .filter((vendor) => vendor.models.length > 0)
}

export const FAVORITES_SCOPE = "__favorites__"

export type ModelPickerRow = { vendor: ComposerVendor; model: ComposerModelInfo }

/** 有搜索词时全目录匹配；无搜索按供应商或收藏过滤。 */
export function listPickerRows(
  catalog: ComposerVendor[],
  query: string,
  scope: string,
  favorites: ReadonlySet<string>,
): ModelPickerRow[] {
  const q = query.trim()
  const all = Boolean(q)

  const vendors =
    all || scope === FAVORITES_SCOPE ? catalog : catalog.filter((vendor) => vendor.id === scope)

  const rows: ModelPickerRow[] = []

  for (const vendor of filterCatalog(vendors, query)) {
    for (const model of vendor.models) {
      if (!all && scope === FAVORITES_SCOPE && !favorites.has(`${vendor.id}/${model.id}`)) continue
      rows.push({ vendor, model })
    }
  }

  return rows
}

export function resolveModelInfo(catalog: ComposerVendor[], ref: ComposerModel | undefined) {
  const vendor = catalog.find((item) => item.id === ref?.provider)
  const model = vendor?.models.find((item) => item.id === ref?.id)
  return { vendor, model, levels: model?.thinkingLevels ?? [] }
}

export function sameModel(a: ComposerModel | undefined, b: ComposerModel | undefined): boolean {
  return a?.provider === b?.provider && a?.id === b?.id
}

export function modelLabel(model: ComposerModel | undefined): string {
  return model ? `${model.provider}/${model.id}` : "—"
}

/** 官方 ModelMetadata → 供应商目录；保留服务端顺序。 */
export function catalogFromModels(models: readonly ModelMetadata[]): ComposerVendor[] {
  const vendors = new Map<string, ComposerVendor>()

  for (const model of models) {
    const vendor = vendors.get(model.provider) ?? {
      id: model.provider,
      name: vendorDisplayName(model.provider),
      models: [],
    }

    vendor.models.push({
      id: model.id,
      name: model.name,
      thinkingLevels: [...model.supportedThinkingLevels],
      contextWindow: model.contextWindow,
    })
    vendors.set(model.provider, vendor)
  }

  return [...vendors.values()]
}

/** 目录首个可用模型的默认执行档；目录为空时返回 undefined。 */
export function defaultPresetFrom(catalog: readonly ComposerVendor[]): ComposerPreset | undefined {
  for (const vendor of catalog) {
    const first = vendor.models[0]

    if (!first) continue
    return {
      model: { provider: vendor.id, id: first.id },
      thinkingLevel: first.thinkingLevels[0] ?? "",
    }
  }

  return undefined
}

/** 字符串 thinkingLevel → 官方 ThinkingLevel；未知值回退 "off"。 */
export function thinkingLevelOf(level: string): ThinkingLevel {
  return (["off", "minimal", "low", "medium", "high", "xhigh", "max"] as const).includes(
    level as ThinkingLevel,
  )
    ? (level as ThinkingLevel)
    : "off"
}
