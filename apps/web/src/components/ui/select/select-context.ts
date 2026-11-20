import { inject, provide, ref, type InjectionKey, type Ref } from "vue"
import type { Size } from "@components/ui/rt/size.js"

const selectSizeKey: InjectionKey<Ref<Size>> = Symbol("select-size")
const fallbackSize = ref<Size>("m")

export function provideSelectSize(size: Ref<Size>): void {
  provide(selectSizeKey, size)
}

export function useSelectSize(): Ref<Size> {
  return inject(selectSizeKey, fallbackSize)
}
