import {
  defineComponent,
  h,
  inject,
  provide,
  ref,
  watch,
  type InjectionKey,
  type PropType,
} from "vue"
import type { ChangeDetails, DismissAttemptDetails } from "@ui-sdk/core"
import type { AsyncOptionsStatus } from "@ui-sdk/core/async-options"
import { triggerMenu } from "@ui-sdk/core/trigger-menu"
import { usePrimitive, type PrimitiveHandle } from "@ui-sdk/vue/primitive"
import {
  TriggerMenuContent as TriggerMenuContentPrimitive,
  type TextEditorAdapter,
  type TokenInsert,
  type TriggerDefinition,
  type TriggerMenuController,
  type TriggerMenuDismissReason,
  type TriggerMenuOpenChangeReason,
  type TriggerMenuPrimitive,
  type TriggerMenuQueryChangeReason,
  type TriggerMenuSelectDetails,
} from "@ui-sdk/vue/trigger-menu"

type OpenDetails = ChangeDetails<TriggerMenuOpenChangeReason> & {
  trigger: string | null
}

type QueryDetails = ChangeDetails<TriggerMenuQueryChangeReason> & {
  trigger: string
  argument?: string
}

type SelectHandler = (
  value: string,
  details: TriggerMenuSelectDetails<string>,
) => void | Promise<void | Partial<TokenInsert>>

const TRIGGER_MENU_HANDLE: InjectionKey<PrimitiveHandle<TriggerMenuPrimitive>> =
  Symbol("pig-trigger-menu")
export const TriggerMenu = defineComponent({
  name: "TriggerMenu",
  props: {
    triggers: {
      type: Array as PropType<TriggerDefinition<string>[]>,
      required: true,
    },
    editor: {
      type: Object as PropType<TextEditorAdapter>,
      default: undefined,
    },
    open: {
      type: Boolean,
      default: undefined,
    },
    modelValue: {
      type: Boolean,
      default: undefined,
    },
    status: {
      type: String as PropType<AsyncOptionsStatus>,
      default: undefined,
    },
    autoHighlight: {
      type: Boolean,
      default: undefined,
    },
    loop: {
      type: Boolean,
      default: undefined,
    },
    shortcut: {
      type: String,
      default: undefined,
    },
    controller: {
      type: Object as PropType<TriggerMenuController>,
      default: undefined,
    },
    dismissible: {
      type: Boolean,
      default: undefined,
    },
    debug: {
      type: Boolean,
      default: undefined,
    },
    container: {
      type: Object as PropType<Element | DocumentFragment | null>,
      default: undefined,
    },
    onSelect: {
      type: Function as PropType<SelectHandler>,
      default: undefined,
    },
    pendingAnnouncement: {
      type: String,
      default: undefined,
    },
  },
  emits: {
    "update:open": (_open: boolean) => true,
    "update:modelValue": (_open: boolean) => true,
    openChange: (_open: boolean, _details: OpenDetails) => true,
    openChangeComplete: (_open: boolean) => true,
    dismissAttempt: (_details: DismissAttemptDetails<TriggerMenuDismissReason>) => true,
    queryChange: (_query: string, _details: QueryDetails) => true,
  },
  setup(props, { emit, slots }) {
    const handle = usePrimitive(triggerMenu, () => {
      const open = props.open ?? props.modelValue
      return {
        triggers: props.triggers,
        ...(props.editor !== undefined && { editor: props.editor }),
        ...(open !== undefined && { open }),
        ...(props.status !== undefined && { status: props.status }),
        ...(props.autoHighlight !== undefined && { autoHighlight: props.autoHighlight }),
        ...(props.loop !== undefined && { loop: props.loop }),
        ...(props.shortcut !== undefined && { shortcut: props.shortcut }),
        ...(props.controller !== undefined && { controller: props.controller }),
        ...(props.dismissible !== undefined && { dismissible: props.dismissible }),
        ...(props.debug !== undefined && { debug: props.debug }),
        ...(props.container !== undefined && { container: props.container }),
        ...(props.onSelect !== undefined && { onSelect: props.onSelect }),
        ...(props.pendingAnnouncement !== undefined && {
          pendingAnnouncement: props.pendingAnnouncement,
        }),
        onOpenChange(next, details) {
          emit("openChange", next, details)

          if (!details.canceled) {
            emit("update:open", next)
            emit("update:modelValue", next)
          }
        },
        onOpenChangeComplete(next) {
          emit("openChangeComplete", next)
        },
        onDismissAttempt(details) {
          emit("dismissAttempt", details)
        },
        onQueryChange(query, details) {
          emit("queryChange", query, details)
        },
      }
    })

    provide(TRIGGER_MENU_HANDLE, handle)
    return () => slots.default?.()
  },
})
export const TriggerMenuContent = defineComponent({
  name: "TriggerMenuContent",
  inheritAttrs: false,
  props: {
    inline: {
      type: Boolean,
      default: false,
    },
    keepMounted: {
      type: Boolean,
      default: undefined,
    },
  },
  setup(props, { attrs, slots }) {
    const handle = inject(TRIGGER_MENU_HANDLE, null)
    const panelEl = ref<HTMLElement | null>(null)

    watch(
      panelEl,
      (el, _prev, onCleanup) => {
        if (!props.inline || !el || !handle) return
        onCleanup(handle.api.internal.popup.bind(el, { inline: true }))
      },
      { flush: "post" },
    )
    return () => {
      if (!props.inline) {
        return h(
          TriggerMenuContentPrimitive,
          { ...attrs, ...(props.keepMounted !== undefined && { keepMounted: props.keepMounted }) },
          slots,
        )
      }

      if (!handle) return null

      if (!props.keepMounted && !handle.state.mounted) return null
      return h(
        "div",
        {
          ...attrs,
          ref: panelEl,
          "data-slot": "trigger-menu-content",
          "data-open": handle.state.open ? "" : undefined,
          "data-closed": handle.state.open ? undefined : "",
          "data-trigger": handle.api.getMatch()?.trigger ?? undefined,
          hidden: props.keepMounted && !handle.state.mounted ? true : undefined,
        },
        slots.default?.(),
      )
    }
  },
})
