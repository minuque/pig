import { defineComponent, type SlotsType, type VNode } from "vue"
import { usePart, usePrimitive } from "@ui-sdk/vue/primitive"
import {
  createChange,
  createTransfer,
  definePrimitive,
  type ChangeDetails,
  type TransferDraft,
  type TransferLists,
  type TransferMessage,
  type TransferReason,
} from "@ui-sdk/core"

export type TransferChangeDetails = ChangeDetails<TransferReason> & {
  key: string
  from: string
  to: string
  index: number
}

export type TransferListsOptions = {
  value?: TransferLists
  defaultValue?: TransferLists
  onValueChange?: (value: TransferLists, details: TransferChangeDetails) => void
  onMovingChange?: (moving: TransferDraft | null) => void
  order?: () => string[]
  disabled?: (key: string) => boolean
  grabKey?: (event: KeyboardEvent) => boolean
  itemLabel?: (key: string) => string | undefined
  listLabel?: (list: string) => string | undefined
  message?: (message: TransferMessage) => string
}

function targetList(draft: TransferDraft | null): string | null {
  if (!draft) return null
  return Object.keys(draft.lists).find((list) => draft.lists[list]?.includes(draft.key)) ?? null
}

const transferLists = definePrimitive({
  name: "transfer-lists",
  options: {
    value: "value",
    defaultValue: "value",
    onValueChange: "callback",
    onMovingChange: "callback",
    order: "value",
    disabled: "value",
    grabKey: "value",
    itemLabel: "value",
    listLabel: "value",
    message: "value",
  },
  controlled: ["value"],
  state: (options: TransferListsOptions) => ({
    value: options.value ?? options.defaultValue ?? {},
    moving: null as TransferDraft | null,
  }),
  sync: (options) => (options.value === undefined ? {} : { value: options.value }),
  api: (context) => {
    const change = createChange(context)
    const options = () => context.options()
    const transfer = createTransfer(context, {
      key: "value",
      draft: "moving",
      set: (value, details) => change("value", value, details),
      order: () => options().order?.() ?? Object.keys(context.store.get().value),
      disabled: (key) => options().disabled?.(key) ?? false,
      label: (key) => options().itemLabel?.(key),
      listLabel: (list) => options().listLabel?.(list),
      ...(options().message && {
        message: (message: TransferMessage) => options().message?.(message) ?? "",
      }),
    })
    let moving: TransferDraft | null = null
    const unsubscribe = context.store.subscribe(() => {
      const next = context.store.get().moving

      if (next === moving) return
      moving = next
      options().onMovingChange?.(moving)
    })

    context.onDestroy(unsubscribe)
    return {
      transfer,
      move: (key: string, list: string, index: number) => transfer.move(key, list, index),
      keydown(event: KeyboardEvent, key: string) {
        const grab = options().grabKey

        if (grab && !transfer.moving(context.store.get(), key) && !grab(event)) return
        transfer.keydown(event, key)
      },
    }
  },
  slots: (slot) => ({
    root: slot<
      Record<never, never>,
      { lists: TransferLists; moving: string | null; from: string | null; to: string | null }
    >({
      state: (state, part) => ({
        lists: part.api.transfer.lists(state),
        moving: state.moving?.key ?? null,
        from: state.moving?.from ?? null,
        to: targetList(state.moving),
      }),
    }),
    list: slot<{ value: string }>({
      props: { value: "string" },
      attrs: (state, part) => ({
        "data-drop-target":
          state.moving && targetList(state.moving) === part.props.value ? "" : undefined,
      }),
      bind: (el, part) => part.api.transfer.bindList(el, part.props.value),
    }),
    item: slot<{ value: string }>({
      props: { value: "string" },
      attrs: (state, part) => ({
        "data-grabbed": part.api.transfer.moving(state, part.props.value) ? "" : undefined,
        "data-dragging": part.api.transfer.dragging(state, part.props.value) ? "" : undefined,
      }),
      on: {
        keydown: (event, { api, props }) => api.keydown(event, props.value),
        pointerdown: (event, { api, props }) => api.transfer.pointerdown(event, props.value),
      },
      bind: (el, part) => part.api.transfer.bindItem(el, part.props.value),
    }),
  }),
  agent: { actions: ["move"] },
})

type PartScope = { props: Record<string, unknown> }

type RootScope = {
  state: { lists: TransferLists; moving: string | null; from: string | null; to: string | null }
}

export const TransferListsRoot = defineComponent(
  (props: Omit<TransferListsOptions, "onValueChange" | "onMovingChange">, { emit }) => {
    const handle = usePrimitive(transferLists, () => ({
      ...(props.value && { value: props.value }),
      ...(props.defaultValue && { defaultValue: props.defaultValue }),
      ...(props.order && { order: props.order }),
      ...(props.disabled && { disabled: props.disabled }),
      ...(props.grabKey && { grabKey: props.grabKey }),
      ...(props.itemLabel && { itemLabel: props.itemLabel }),
      ...(props.listLabel && { listLabel: props.listLabel }),
      ...(props.message && { message: props.message }),
      onValueChange: (value: TransferLists, details: TransferChangeDetails) =>
        emit("value-change", value, details),
      onMovingChange: (moving: TransferDraft | null) => emit("moving-change", moving),
    }))
    return usePart(handle, "root", undefined, undefined, "div")
  },
  {
    inheritAttrs: false,
    props: [
      "value",
      "defaultValue",
      "order",
      "disabled",
      "grabKey",
      "itemLabel",
      "listLabel",
      "message",
    ],
    emits: ["value-change", "moving-change"],
    slots: Object as SlotsType<{
      default?: (scope: RootScope) => VNode[]
      render?: (scope: RootScope & PartScope) => VNode[]
    }>,
  },
)
export const TransferList = defineComponent(
  (props: { value: string }) =>
    usePart(transferLists, "list", () => ({ value: props.value }), undefined, "div"),
  {
    inheritAttrs: false,
    props: ["value"],
    slots: Object as SlotsType<{ default?: () => VNode[]; render?: (scope: PartScope) => VNode[] }>,
  },
)
export const TransferItem = defineComponent(
  (props: { value: string }) =>
    usePart(transferLists, "item", () => ({ value: props.value }), undefined, "li"),
  {
    inheritAttrs: false,
    props: ["value"],
    slots: Object as SlotsType<{ default?: () => VNode[]; render?: (scope: PartScope) => VNode[] }>,
  },
)
