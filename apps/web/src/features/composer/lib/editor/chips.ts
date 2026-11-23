import { Extension, Node, mergeAttributes } from "@tiptap/core"
import { history, redo, undo } from "@tiptap/pm/history"
import { keymap } from "@tiptap/pm/keymap"
import type { EditorState } from "@tiptap/pm/state"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import { Decoration, DecorationSet } from "@tiptap/pm/view"
import { contextReferenceAt, formatContextReference } from "@pig/protocol"
import { contextReferenceAttrs, isChipNode } from "@features/composer/lib/editor/chip-tokens.js"
import {
  markAsCompositionReplace,
  UNDO_GROUP_DELAY,
} from "@features/composer/lib/editor/undo-grouping.js"

export interface FileMentionOptions {
  onOpenFile?: ((path: string) => void) | undefined
}

const CHIP_CLASS = "chip inline-chip"
const chipSelectionKey = new PluginKey<DecorationSet>("composerChipSelection")

function attributeSource(name: string): (element: HTMLElement) => string {
  return (element) => element.getAttribute(name) ?? ""
}

function chipLabel(path: string, label: string): string {
  return label || path.split("/").filter(Boolean).pop() || path
}

export const ComposerDocument = Node.create({
  name: "doc",
  topNode: true,
  content: "block+",
})
export const ComposerParagraph = Node.create({
  name: "paragraph",
  group: "block",
  content: "inline*",
  selectable: false,
  parseHTML: () => [{ tag: "p" }],
  renderHTML: () => ["p", 0],
})
export const ComposerText = Node.create({
  name: "text",
  group: "inline",
})
export const ComposerHistory = Extension.create({
  name: "composerHistory",
  addProseMirrorPlugins: () => [
    history({ newGroupDelay: UNDO_GROUP_DELAY }),
    keymap({ "Mod-z": undo, "Mod-y": redo, "Shift-Mod-z": redo }),
  ],
})
export const FileMentionNode = Node.create<FileMentionOptions>({
  name: "fileMention",
  inline: true,
  group: "inline",
  atom: true,
  selectable: false,
  draggable: false,
  addOptions: () => ({ onOpenFile: undefined }),
  addAttributes: () => ({
    path: {
      default: "",
      parseHTML: attributeSource("data-file-mention"),
      renderHTML: () => ({}),
    },
    label: {
      default: null,
      parseHTML: (element) => element.textContent ?? "",
      renderHTML: () => ({}),
    },
  }),
  parseHTML: () => [{ tag: "span[data-file-mention]" }],
  renderHTML: ({ node, HTMLAttributes }) => {
    const path = String(node.attrs["path"] ?? "")
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        class: CHIP_CLASS,
        "data-file-mention": path,
        title: path,
      }),
      chipLabel(path, String(node.attrs["label"] ?? "")),
    ]
  },
  addProseMirrorPlugins() {
    const onOpenFile = () => this.options.onOpenFile
    return [
      new Plugin({
        props: {
          handleDOMEvents: {
            click(_view, event) {
              const target = event.target

              if (!(target instanceof Element)) return false
              const path = target.closest("[data-file-mention]")?.getAttribute("data-file-mention")

              if (!path) return false
              onOpenFile()?.(path)
              return true
            },
          },
        },
      }),
    ]
  },
})
export const CommandChipNode = Node.create({
  name: "commandChip",
  inline: true,
  group: "inline",
  atom: true,
  selectable: false,
  draggable: false,
  addAttributes: () => ({
    name: {
      default: "",
      parseHTML: attributeSource("data-command-chip"),
      renderHTML: () => ({}),
    },
    kind: {
      default: null,
      parseHTML: (element) => element.getAttribute("data-command-kind"),
      renderHTML: () => ({}),
    },
  }),
  parseHTML: () => [{ tag: "span[data-command-chip]" }],
  renderHTML: ({ node, HTMLAttributes }) => {
    const name = String(node.attrs["name"] ?? "")
    const skill = node.attrs["kind"] === "skill"
    const label = skill ? `skill:${name}` : name
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        class: CHIP_CLASS,
        "data-command-chip": name,
        ...(skill ? { "data-command-kind": "skill" } : {}),
        title: `/${label}`,
      }),
      label,
    ]
  },
})
export const ContextReferenceNode = Node.create({
  name: "contextReference",
  inline: true,
  group: "inline",
  atom: true,
  selectable: false,
  draggable: false,
  addAttributes: () => ({
    kind: { default: "session", renderHTML: () => ({}) },
    sessionId: { default: "", renderHTML: () => ({}) },
    entryId: { default: null, renderHTML: () => ({}) },
    text: { default: null, renderHTML: () => ({}) },
    label: { default: "", renderHTML: () => ({}) },
  }),
  parseHTML: () => [
    {
      tag: "span[data-context-reference]",
      getAttrs: (element) => {
        const source = element.getAttribute("data-context-reference") ?? ""
        return contextReferenceAt(source, 0)?.reference ?? false
      },
    },
  ],
  renderHTML: ({ node, HTMLAttributes }) => {
    const reference = contextReferenceAttrs(node.attrs as Record<string, unknown>)
    const reply = reference.kind === "reply"
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        class: CHIP_CLASS,
        "data-context-reference": formatContextReference(reference),
        "data-context-kind": reference.kind,
        title: reply ? reference.text : reference.label,
      }),
      reply ? `“${reference.label}”` : reference.label,
    ]
  },
})

function chipSelectionDecorations({ doc, selection }: EditorState): DecorationSet {
  if (selection.empty) return DecorationSet.empty
  const decorations: Decoration[] = []

  doc.nodesBetween(selection.from, selection.to, (node, pos) => {
    if (!isChipNode(node)) return true
    decorations.push(Decoration.node(pos, pos + node.nodeSize, { class: "is-chip-selected" }))
    return false
  })
  return DecorationSet.create(doc, decorations)
}

export const ComposerChipSelection = Extension.create({
  name: "composerChipSelection",
  addProseMirrorPlugins: () => [
    new Plugin<DecorationSet>({
      key: chipSelectionKey,
      state: {
        init: (_, state) => chipSelectionDecorations(state),
        apply: (tr, old, _, state) =>
          tr.docChanged || tr.selectionSet ? chipSelectionDecorations(state) : old,
      },
      props: {
        decorations: (state) => chipSelectionKey.getState(state),
        handleDOMEvents: {
          compositionstart(view) {
            if (chipSelectionKey.getState(view.state)?.find().length) {
              view.dispatch(markAsCompositionReplace(view.state.tr.deleteSelection()))
            }

            return false
          },
        },
      },
    }),
  ],
})
