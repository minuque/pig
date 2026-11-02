import { computed, onMounted, ref } from "vue"

import { errorMessage } from "@client/http.js"
import { listProviders } from "@client/platform.js"
import type { ProviderView } from "@/types/provider-type.js"

/** 模型分区状态：供应商列表、下钻选中项与加载错误。 */
export function useProviders() {
  const providers = ref<ProviderView[]>([])
  const loading = ref(false)
  const error = ref<string>()
  const selectedId = ref<string>()
  const selected = computed(() => providers.value.find((item) => item.id === selectedId.value))

  async function refresh() {
    loading.value = true
    error.value = undefined

    try {
      const result = await listProviders()
      providers.value = result.providers
    } catch (cause) {
      error.value = errorMessage(cause)
    } finally {
      loading.value = false
    }
  }

  function select(id: string | undefined) {
    selectedId.value = id
  }

  onMounted(refresh)
  return { providers, loading, error, selected, select, refresh }
}
