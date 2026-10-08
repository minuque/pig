import { computed, ref } from "vue"
import { readStringArray, writeJson } from "@utils/storage.js"

const FAVORITE_MODELS_KEY = "pig.favoriteModels"

function loadFavoriteModels(): string[] {
  return readStringArray(FAVORITE_MODELS_KEY).filter((item) => item.includes("/"))
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

    writeJson(FAVORITE_MODELS_KEY, keys.value)
  }

  return { set, isFavorite, toggle }
}
