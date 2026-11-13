import type { ModelParamsPatch } from "@pig/protocol"

import { isThinkingLevel } from "./provider-view.js"
import { ProviderServiceError } from "./provider-error.js"

export interface StoredCredential {
  type?: string
  key?: string
}

const MAX_ERROR_LENGTH = 500

/** models.json 的条目是否定义了一个自定义供应商；只有 modelOverrides 的是内置覆盖。 */
export function isCustomConfig(provider: Record<string, unknown>): boolean {
  return Array.isArray(provider.models)
}

export function validatePatch(patch: ModelParamsPatch): void {
  const inRange = (value: number | null | undefined, min: number, max: number) =>
    value === undefined ||
    value === null ||
    (Number.isInteger(value) && value >= min && value <= max)

  if (!inRange(patch.maxTokens, 1, 1_000_000) || !inRange(patch.contextWindow, 1_000, 10_000_000)) {
    throw new ProviderServiceError(400, "INVALID_REQUEST")
  }

  if (
    patch.thinkingLevel !== undefined &&
    patch.thinkingLevel !== null &&
    !isThinkingLevel(patch.thinkingLevel)
  ) {
    throw new ProviderServiceError(400, "INVALID_REQUEST")
  }

  if (
    patch.samplingParams !== undefined &&
    patch.samplingParams !== null &&
    (typeof patch.samplingParams !== "object" ||
      Array.isArray(patch.samplingParams) ||
      !Object.values(patch.samplingParams).every(isScalar))
  ) {
    throw new ProviderServiceError(400, "INVALID_REQUEST")
  }
}

export function hasModelFields(patch: ModelParamsPatch): boolean {
  return (
    patch.maxTokens !== undefined ||
    patch.contextWindow !== undefined ||
    patch.samplingParams !== undefined
  )
}

export function applyToOverrides(
  provider: Record<string, unknown>,
  modelId: string,
  patch: ModelParamsPatch,
): void {
  const overrides = objectOf(provider.modelOverrides)
  const entry = objectOf(overrides[modelId])

  applyFields(entry, patch)

  if (Object.keys(entry).length) overrides[modelId] = entry
  else delete overrides[modelId]

  provider.modelOverrides = overrides
}

export function applyToCustomModel(
  provider: Record<string, unknown>,
  modelId: string,
  patch: ModelParamsPatch,
): void {
  const models = Array.isArray(provider.models) ? provider.models : []
  const model = models.find((item) => objectOf(item).id === modelId)

  if (!model) throw new ProviderServiceError(404, "NOT_FOUND")
  applyFields(model as Record<string, unknown>, patch)
  provider.models = models
}

export function keyHint(credential: StoredCredential | undefined): string | null {
  if (credential?.type !== "api_key" || typeof credential.key !== "string") return null
  return credential.key.length >= 4 ? credential.key.slice(-4) : null
}

export function errorText(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message.slice(0, MAX_ERROR_LENGTH)
}

export function objectOf(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function isScalar(value: unknown): boolean {
  return value === null || ["string", "number", "boolean"].includes(typeof value)
}

function applyFields(entry: Record<string, unknown>, patch: ModelParamsPatch): void {
  if (patch.maxTokens !== undefined) {
    if (patch.maxTokens === null) delete entry.maxTokens
    else entry.maxTokens = patch.maxTokens
  }

  if (patch.contextWindow !== undefined) {
    if (patch.contextWindow === null) delete entry.contextWindow
    else entry.contextWindow = patch.contextWindow
  }

  if (patch.samplingParams !== undefined) {
    if (patch.samplingParams === null) delete entry.samplingParams
    else entry.samplingParams = { ...patch.samplingParams }
  }
}
