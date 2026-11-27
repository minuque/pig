import { defineComponent, type SlotsType, type VNode } from "vue"
import { usePart, usePrimitive } from "@ui-sdk/vue/primitive"
import { createChange, definePrimitive, type TransferDraft, type TransferLists } from "@ui-sdk/core"
import {
  createTransferController,
  type TransferChangeDetails,
  type TransferListsOptions,
} from "./transfer-controller.js"

export type { TransferChangeDetails, TransferListsOptions }

const transferLists = definePrimitive({
  name: "transfer-lists",
  options: {
    value: "value",
    defaultValue: "value",
    onValueChange: "callback",
    onMovingChange: "callback",
    order: "value",
    disabled: "value",
    reorderable: "value",
    accepts: "value",
    density: "string",
    liftSide: "string",
    bounds: "value",
    outsideConsumed: "value",
    itemLabel: "value",
    listLabel: "value",
    message: "value",
  },
  controlled: ["value"],
  state: (options: TransferListsOptions) => ({
    value: options.value ?? options.defaultValue ?? {},
    moving: null as TransferDraft | null,
    to: null as string | null,
    settling: null as string | null,
    reduced: false,
  }),
  sync: (options) => (options.value === undefined ? {} : { value: options.value }),
  api: (context) => createTransferController(context, createChange(context)),
  slots: (slot) => ({
    root: slot<
      Record<never, never>,
      {
        lists: TransferLists
        moving: string | null
        from: string | null
        to: string | null
        settling: string | null
      }
    >({
      state: (state) => ({
        lists: state.value,
        moving: state.moving?.key ?? null,
        from: state.moving?.from ?? null,
        to: state.to,
        settling: state.settling,
      }),
      attrs: (state) => ({
        "data-dragging": state.moving?.pointer ? "" : undefined,
      }),
    }),
    list: slot<{ value: string }>({
      props: { value: "string" },
      attrs: (state, part) => ({
        "data-drop-target": state.moving && state.to === part.props.value ? "" : undefined,
      }),
      bind: (el, part) => part.api.bindList(el, part.props.value),
    }),
    item: slot<{ value: string }>({
      props: { value: "string" },
      attrs: (state, part) => {
        const key = part.props.value
        const moving = state.moving?.key === key
        const pointer = Boolean(moving && state.moving?.pointer)
        const hidden = state.settling === key || (pointer && !state.reduced)
        return {
          "data-draggable": !part.api.isDisabled(key) ? "" : undefined,
          "data-grabbed": moving ? "" : undefined,
          "data-dragging": pointer ? "" : undefined,
          "data-drag-hidden": hidden ? "" : undefined,
        }
      },
      on: {
        pointerdown: (event, { api, props }) => api.pointerdown(event, props.value),
      },
      bind: (el, part) => part.api.bindItem(el, part.props.value),
    }),
  }),
  agent: { actions: ["move"] },
})

type PartScope = { props: Record<string, unknown> }

type RootScope = {
  state: {
    lists: TransferLists
    moving: string | null
    from: string | null
    to: string | null
    settling: string | null
  }
}

export const TransferListsRoot = defineComponent(
  (props: Omit<TransferListsOptions, "onValueChange" | "onMovingChange">, { emit }) => {
    const handle = usePrimitive(transferLists, () => ({
      ...(props.value && { value: props.value }),
      ...(props.defaultValue && { defaultValue: props.defaultValue }),
      ...(props.order && { order: props.order }),
      ...(props.disabled && { disabled: props.disabled }),
      ...(props.reorderable && { reorderable: props.reorderable }),
      ...(props.accepts && { accepts: props.accepts }),
      ...(props.density && { density: props.density }),
      ...(props.liftSide && { liftSide: props.liftSide }),
      ...(props.bounds && { bounds: props.bounds }),
      ...(props.outsideConsumed && { outsideConsumed: props.outsideConsumed }),
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
      "reorderable",
      "accepts",
      "density",
      "liftSide",
      "bounds",
      "outsideConsumed",
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
