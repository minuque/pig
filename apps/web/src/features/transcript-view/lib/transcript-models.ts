import { inject, type InjectionKey, type Ref } from "vue"
import type { ModelMetadata, ModelRef } from "@/types/common-type.js"

export const transcriptModelsKey: InjectionKey<Ref<readonly ModelMetadata[]>> =
  Symbol("transcript-models")

export function useModelName() {
  const models = inject(transcriptModelsKey, undefined)
  return (ref: ModelRef) =>
    models?.value.find((model) => model.provider === ref.provider && model.id === ref.id)?.name ??
    ref.id
}
