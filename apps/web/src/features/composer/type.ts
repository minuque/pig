import type { Component } from "vue"
import type { ComposerAttachment, ComposerAttachmentBatch } from "@/types/attachment-type.js"

export interface ComposerModelInfo {
  id: string
  name: string
  thinkingLevels: string[]
  contextWindow?: number
}

export interface ComposerVendor {
  id: string
  name: string
  models: ComposerModelInfo[]
}

export interface ComposerModel {
  provider: string
  id: string
}

export interface ComposerPreset {
  model: ComposerModel
  thinkingLevel: string
}

export type ComposerChipKind = "file" | "command"

export type ComposerCommandKind = "skill" | "template"

export interface ComposerFileChip {
  kind: "file"
  path: string
  label?: string | undefined
}

export interface ComposerCommandChip {
  kind: "command"
  name: string
  commandKind?: ComposerCommandKind | undefined
}

export type ComposerChip = ComposerFileChip | ComposerCommandChip

export interface ComposerCaret {
  offset: number
  edited: boolean
  inCode: boolean
}

export interface ChipInsert {
  kind: "skill" | "template" | "builtin" | "file"
  label: string
  path?: string | undefined
  start: number
  triggerLength: number
}

export type CommandMenuRowKind = "skill" | "template" | "builtin" | "file" | "directory"

export interface CommandMenuRow {
  id: string
  title: string
  secondary?: string | undefined
  icon?: Component
  kind?: CommandMenuRowKind | undefined
  directory?: boolean
}

export interface CommandMenuGroup {
  id: string
  label?: string
  rows: CommandMenuRow[]
}

export type StopPhase = "idle" | "pending" | "timedOut" | "landed"

export type ComposerActionMode = "send" | "queue" | "steer" | "stop" | "save-edit"

export interface ComposerDraftSnapshot {
  text: string
  chips: ComposerChip[]
  attachments?: ComposerAttachment[] | undefined
}

export interface QueueDraftPatch {
  id: string
  text: string
  attachments?: ComposerAttachmentBatch | undefined
}

export interface ReplyInsertRequest {
  sessionId: string
  entryId: string
  text: string
  anchor: HTMLElement
}

export type {
  ContextUsage,
  ContextUsageSegment,
  ContextUsageSessionTokens,
} from "@features/session/lib/context-usage.js"
