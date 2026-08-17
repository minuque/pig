import type { ModelRef } from "@earendil-works/pi-protocol";
import type { ChatInputVendor } from "@features/chat-input/types.js";

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
          vendor.name.toLowerCase().includes(q),
      ),
    }))
    .filter((vendor) => vendor.models.length > 0);
}

export function resolveModelInfo(catalog: ChatInputVendor[], ref: ModelRef | undefined) {
  const vendor = catalog.find((item) => item.id === ref?.provider);
  const model = vendor?.models.find((item) => item.id === ref?.id);
  return { vendor, model, levels: model?.thinkingLevels ?? [] };
}
