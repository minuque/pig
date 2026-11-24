import { defineComponent, type SlotsType, type VNode } from "vue"
import { usePart, usePrimitive } from "@ui-sdk/vue/primitive"
import {
  createChange,
  createReorder,
  definePrimitive,
  type ChangeDetails,
  type ReorderDraft,
  type ReorderMessage,
  type ReorderReason,
} from "@ui-sdk/core"

export type SortableListOptions = {
  value?: string[]
  defaultValue?: string[]
  onValueChange?: (value: string[], details: ChangeDetails<ReorderReason>) => void
  itemLabel?: (key: string) => string | undefined
  message?: (message: ReorderMessage) => string
}

const sortableList = definePrimitive({
  name: "sortable-list",
  options: {
    value: "list",
    defaultValue: "list",
    onValueChange: "callback",
    itemLabel: "value",
    message: "value",
  },
  controlled: ["value"],
  state: (options: SortableListOptions) => ({
    value: options.value ?? options.defaultValue ?? [],
    moving: null as ReorderDraft | null,
  }),
  sync: (options) => (options.value === undefined ? {} : { value: options.value }),
  api: (context) => {
    const change = createChange(context)
    const reorder = createReorder(context, {
      slot: "item",
      key: "value",
      draft: "moving",
      set: (value, details) => change("value", value, details),
      label: (key) => context.options().itemLabel?.(key),
      ...(context.options().message && {
        message: (message: ReorderMessage) => context.options().message?.(message) ?? "",
      }),
    })
    return {
      reorder,
      move: (key: string, index: number) => reorder.move(key, index),
    }
  },
  slots: (slot) => ({
    root: slot<Record<never, never>, { order: string[] }>({
      role: "list",
      state: (state, part) => ({ order: part.api.reorder.order(state) }),
    }),
    item: slot<{ value: string }>({
      role: "listitem",
      props: { value: "key" },
      attrs: (state, part) => ({
        "data-grabbed": part.api.reorder.moving(state, part.key) ? "" : undefined,
        "data-dragging": part.api.reorder.dragging(state, part.key) ? "" : undefined,
      }),
      bind: (el, part) => part.api.reorder.bind(el, part),
    }),
    handle: slot<{ value: string }>({
      props: { value: "string" },
      attrs: (state, part) => ({
        "aria-pressed": String(part.api.reorder.moving(state, part.props.value)),
      }),
      on: {
        keydown: (event, { api, props }) => {
          api.reorder.keydown(event, props.value)
        },
        pointerdown: (event, { api, props }) => api.reorder.pointerdown(event, props.value),
      },
    }),
  }),
  agent: { actions: ["move"] },
})

type PartScope = { props: Record<string, unknown> }

export const SortableList = defineComponent(
  (props: Omit<SortableListOptions, "onValueChange" | "defaultValue">, { emit }) => {
    const handle = usePrimitive(sortableList, () => ({
      ...(props.value && { value: props.value }),
      ...(props.itemLabel && { itemLabel: props.itemLabel }),
      ...(props.message && { message: props.message }),
      onValueChange: (value: string[], details: ChangeDetails<ReorderReason>) =>
        emit("value-change", value, details),
    }))
    return usePart(handle, "root", undefined, undefined, "div")
  },
  {
    inheritAttrs: false,
    props: ["value", "itemLabel", "message"],
    emits: ["value-change"],
    slots: Object as SlotsType<{ default?: (scope: { state: { order: string[] } }) => VNode[] }>,
  },
)
export const SortableListItem = defineComponent(
  (props: { value: string }) =>
    usePart(sortableList, "item", () => ({ value: props.value }), undefined, "div"),
  {
    inheritAttrs: false,
    props: ["value"],
    slots: Object as SlotsType<{ default?: () => VNode[]; render?: (scope: PartScope) => VNode[] }>,
  },
)
export const SortableListHandle = defineComponent(
  (props: { value: string }) =>
    usePart(sortableList, "handle", () => ({ value: props.value }), undefined, "button"),
  {
    inheritAttrs: false,
    props: ["value"],
    slots: Object as SlotsType<{ default?: () => VNode[]; render?: (scope: PartScope) => VNode[] }>,
  },
)
