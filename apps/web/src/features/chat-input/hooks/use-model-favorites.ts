import { computed, ref } from "vue";

export const FAVORITE_MODELS_KEY = "pig.favoriteModels";

export type FavoriteStorage = Pick<Storage, "getItem" | "setItem">;

export function favoriteKey(provider: string, id: string): string {
  return `${provider}/${id}`;
}

/** 解析收藏列表：非法 JSON 或非字符串项一律丢弃。 */
export function parseFavoriteModels(json: string | null): string[] {
  if (!json) return [];
  try {
    const value: unknown = JSON.parse(json);
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === "string" && item.includes("/"));
  } catch {
    return [];
  }
}

export function loadFavoriteModels(storage: FavoriteStorage = localStorage): string[] {
  try {
    return parseFavoriteModels(storage.getItem(FAVORITE_MODELS_KEY));
  } catch {
    return [];
  }
}

export function saveFavoriteModels(
  keys: readonly string[],
  storage: FavoriteStorage = localStorage,
): void {
  try {
    storage.setItem(FAVORITE_MODELS_KEY, JSON.stringify(keys));
  } catch {
    /* 隐私模式等场景下存储不可用，偏好仅存活于本页 */
  }
}

export function toggleFavoriteKey(keys: readonly string[], key: string): string[] {
  return keys.includes(key) ? keys.filter((item) => item !== key) : [...keys, key];
}

/** 收藏模型：localStorage 持久化，切换立即写回。 */
export function useModelFavorites(storage: FavoriteStorage = localStorage) {
  const keys = ref(loadFavoriteModels(storage));
  const set = computed(() => new Set(keys.value));

  function isFavorite(provider: string, id: string) {
    return set.value.has(favoriteKey(provider, id));
  }

  function toggle(provider: string, id: string) {
    keys.value = toggleFavoriteKey(keys.value, favoriteKey(provider, id));
    saveFavoriteModels(keys.value, storage);
  }

  return { keys, set, isFavorite, toggle };
}
