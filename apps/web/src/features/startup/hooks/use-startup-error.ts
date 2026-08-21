import { readonly, shallowRef } from "vue";

const message = shallowRef("");

/** 启动失败文案：启动门写入，错误页读取。不进 URL。 */
export function setStartupError(value: string) {
  message.value = value;
}

export function useStartupError() {
  return readonly(message);
}
