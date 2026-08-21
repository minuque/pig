import type { ModelRef } from "@earendil-works/pi-protocol";
import type { ChatInputModelInfo, ChatInputVendor } from "@features/chat-input/types.js";

export function filterCatalog(catalog: ChatInputVendor[], query: string): ChatInputVendor[] {
  const q = query.trim().toLowerCase();
  if (!q) return catalog;
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
    .filter((vendor) => vendor.models.length > 0);
}

export const FAVORITES_SCOPE = "__favorites__";

export type ModelPickerRow = { vendor: ChatInputVendor; model: ChatInputModelInfo };

/** 当前供应商或收藏范围，再套搜索。目录顺序保留。 */
export function listPickerRows(
  catalog: ChatInputVendor[],
  query: string,
  scope: string,
  favorites: ReadonlySet<string>,
): ModelPickerRow[] {
  const vendors =
    scope === FAVORITES_SCOPE ? catalog : catalog.filter((vendor) => vendor.id === scope);
  const rows: ModelPickerRow[] = [];
  for (const vendor of filterCatalog(vendors, query)) {
    for (const model of vendor.models) {
      if (scope === FAVORITES_SCOPE && !favorites.has(`${vendor.id}/${model.id}`)) continue;
      rows.push({ vendor, model });
    }
  }
  return rows;
}

export function resolveModelInfo(catalog: ChatInputVendor[], ref: ModelRef | undefined) {
  const vendor = catalog.find((item) => item.id === ref?.provider);
  const model = vendor?.models.find((item) => item.id === ref?.id);
  return { vendor, model, levels: model?.thinkingLevels ?? [] };
}
