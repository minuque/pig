import { inject, provide, ref, type InjectionKey, type Ref } from "vue"
import type { Size } from "@components/ui/rt/size.js"

/** Root 下发的尺寸档：触发器的类名与内容的内边距都按它算。 */
const selectSizeKey: InjectionKey<Ref<Size>> = Symbol("select-size")
const fallbackSize = ref<Size>("m")

export function provideSelectSize(size: Ref<Size>): void {
  provide(selectSizeKey, size)
}

/** 脱离 Root 单独用触发器时按 m，不抛错。 */
export function useSelectSize(): Ref<Size> {
  return inject(selectSizeKey, fallbackSize)
}
