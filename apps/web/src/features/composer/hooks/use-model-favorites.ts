import { computed } from "vue"
import { updatePreferences, userPreferences } from "@client/preferences.js"

export function useModelFavorites() {
  const keys = computed(() => userPreferences.value.favoriteModels)
  const set = computed(() => new Set(keys.value))

  function isFavorite(provider: string, id: string) {
    return set.value.has(`${provider}/${id}`)
  }

  function toggle(provider: string, id: string) {
    const key = `${provider}/${id}`
    updatePreferences({
      favoriteModels: keys.value.includes(key)
        ? keys.value.filter((item) => item !== key)
        : [...keys.value, key],
    })
  }

  return { set, isFavorite, toggle }
}
