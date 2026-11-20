import { readonly, shallowRef } from "vue"

const message = shallowRef("")

export function setStartupError(value: string) {
  message.value = value
}

export function useStartupError() {
  return readonly(message)
}
