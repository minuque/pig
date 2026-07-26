import { z } from "zod";

const opaqueId = <T extends string>() =>
  z
    .string()
    .min(1)
    .max(128)
    .regex(/^[A-Za-z0-9_-]+$/)
    .brand<T>();

export const WorkspaceIdSchema = opaqueId<"WorkspaceId">();
export const SessionIdSchema = opaqueId<"SessionId">();
export const RunIdSchema = opaqueId<"RunId">();
export const CommandIdSchema = opaqueId<"CommandId">();
export const PrincipalIdSchema = opaqueId<"PrincipalId">();
export const EntryIdSchema = opaqueId<"EntryId">();
export const ModelIdSchema = z
  .string()
  .min(1)
  .max(256)
  .regex(/^[A-Za-z0-9._:/@-]+$/)
  .brand<"ModelId">();
export const ProviderIdSchema = opaqueId<"ProviderId">();
export const AuthFlowIdSchema = opaqueId<"AuthFlowId">();
export const PreviewIdSchema = opaqueId<"PreviewId">();
export const OpaqueCursorSchema = z
  .string()
  .min(1)
  .max(512)
  .brand<"OpaqueCursor">();
export const EventCursorSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]+:(?:0|[1-9]\d*)$/)
  .brand<"EventCursor">();

export type WorkspaceId = z.infer<typeof WorkspaceIdSchema>;
export type SessionId = z.infer<typeof SessionIdSchema>;
export type RunId = z.infer<typeof RunIdSchema>;
export type CommandId = z.infer<typeof CommandIdSchema>;
export type PrincipalId = z.infer<typeof PrincipalIdSchema>;
export type EntryId = z.infer<typeof EntryIdSchema>;
export type ModelId = z.infer<typeof ModelIdSchema>;
export type ProviderId = z.infer<typeof ProviderIdSchema>;
export type AuthFlowId = z.infer<typeof AuthFlowIdSchema>;
export type PreviewId = z.infer<typeof PreviewIdSchema>;
export type OpaqueCursor = z.infer<typeof OpaqueCursorSchema>;
export type EventCursor = z.infer<typeof EventCursorSchema>;
