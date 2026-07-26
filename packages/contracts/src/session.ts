import { z } from "zod";
import { cursorPageSchema, InstantSchema, RevisionSchema } from "./common.js";
import {
  CommandIdSchema,
  EventCursorSchema,
  OpaqueCursorSchema,
  SessionIdSchema,
  WorkspaceIdSchema,
} from "./ids.js";
import { RunSummarySchema } from "./run.js";
import { PartialRunOutputSchema, TranscriptItemSchema } from "./transcript.js";

export const SessionAvailabilitySchema = z.enum([
  "healthy",
  "dirty_tail",
  "unavailable",
  "quarantined",
]);
export const SessionSummarySchema = z.object({
  sessionId: SessionIdSchema,
  workspaceId: WorkspaceIdSchema,
  name: z.string().min(1).max(160),
  revision: RevisionSchema,
  availability: SessionAvailabilitySchema,
  updatedAt: InstantSchema,
});
export const SessionDetailSchema = SessionSummarySchema.extend({
  createdAt: InstantSchema,
  lastVerifiedSummary: z.string().max(1000).optional(),
});
export const CreateSessionSchema = z.strictObject({
  commandId: CommandIdSchema,
  name: z.string().min(1).max(160),
});
export const UpdateSessionSchema = z.strictObject({
  commandId: CommandIdSchema,
  expectedRevision: RevisionSchema,
  name: z.string().min(1).max(160),
});
export const SessionListQuerySchema = z.strictObject({
  cursor: OpaqueCursorSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().max(200).optional(),
});
export const SessionSnapshotSchema = z.object({
  session: SessionDetailSchema,
  activeRuns: z.array(RunSummarySchema).max(1),
  queuedRuns: z.array(RunSummarySchema).max(32),
  transcriptTail: z.array(TranscriptItemSchema).max(500),
  partialOutputs: z.array(PartialRunOutputSchema).max(33),
  capturedEventCursor: EventCursorSchema,
  durableEntryCursor: OpaqueCursorSchema.nullable(),
  historyTruncated: z.boolean(),
  previousTranscriptCursor: OpaqueCursorSchema.nullable(),
});
export const TranscriptPageSchema = cursorPageSchema(TranscriptItemSchema);

export type SessionAvailability = z.infer<typeof SessionAvailabilitySchema>;
export type SessionSummary = z.infer<typeof SessionSummarySchema>;
export type SessionDetail = z.infer<typeof SessionDetailSchema>;
export type SessionSnapshot = z.infer<typeof SessionSnapshotSchema>;
