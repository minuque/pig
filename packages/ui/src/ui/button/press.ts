import type { ButtonActionDetails } from "@ui-sdk/vue/button"

type ClickHandler = (event: MouseEvent, details: ButtonActionDetails) => unknown

export function chainClick(handler: ClickHandler | ClickHandler[]): ClickHandler {
  if (!Array.isArray(handler)) return handler
  return (event, details) => {
    const pending = handler
      .map((fn) => fn(event, details))
      .filter((result) => result instanceof Promise)
    return pending.length ? Promise.all(pending) : undefined
  }
}
