import { computed, ref } from "vue"

const FAVORITE_MODELS_KEY = "pig.favoriteModels"

function parseFavoriteModels(json: string | null): string[] {
  if (!json) return []

  try {
    const value: unknown = JSON.parse(json)

    if (!Array.isArray(value)) return []

    return value.filter((item): item is string => typeof item === "string" && item.includes("/"))
  } catch {
    return []
  }
}

function loadFavoriteModels(): string[] {
  try {
    return parseFavoriteModels(localStorage.getItem(FAVORITE_MODELS_KEY))
  } catch {
    return []
  }
}

/** 收藏模型：localStorage 持久化，切换立即写回。 */
export function useModelFavorites() {
  const keys = ref(loadFavoriteModels())
  const set = computed(() => new Set(keys.value))

  function isFavorite(provider: string, id: string) {
    return set.value.has(`${provider}/${id}`)
  }

  function toggle(provider: string, id: string) {
    const key = `${provider}/${id}`
    keys.value = keys.value.includes(key)
      ? keys.value.filter((item) => item !== key)
      : [...keys.value, key]

    try {
      localStorage.setItem(FAVORITE_MODELS_KEY, JSON.stringify(keys.value))
    } catch {
      /* 隐私模式等场景下存储不可用，偏好仅存活于本页 */
    }
  }

  return { set, isFavorite, toggle }
}
