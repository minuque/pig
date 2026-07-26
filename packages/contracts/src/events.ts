import { z } from "zod";
import { ContractRevisionSchema, InstantSchema } from "./common.js";
import { AuthFlowSchema, ProviderAuthStatusSchema } from "./model-auth.js";
import {
  CommandIdSchema,
  EntryIdSchema,
  EventCursorSchema,
  RunIdSchema,
  SessionIdSchema,
  WorkspaceIdSchema,
} from "./ids.js";
import { RunSummarySchema } from "./run.js";
import { SessionSummarySchema } from "./session.js";
import { TranscriptItemSchema } from "./transcript.js";
import { WorkspaceSummarySchema } from "./workspace.js";

const envelope = {
  schemaVersion: z.literal(1),
  contractRevision: ContractRevisionSchema,
  gatewayEpoch: z.string().min(1).max(128),
  gatewaySeq: z.number().int().positive(),
  emittedAt: InstantSchema,
};
const workspaceScope = { ...envelope, workspaceId: WorkspaceIdSchema };
const sessionScope = { ...workspaceScope, sessionId: SessionIdSchema };
const runScope = {
  ...sessionScope,
  runId: RunIdSchema,
  runSeq: z.number().int().positive(),
};

export const gatewayEventSchemas = {
  "workspace.changed": z.object({
    ...workspaceScope,
    type: z.literal("workspace.changed"),
    payload: WorkspaceSummarySchema,
  }),
  "workspace.removed": z.object({
    ...workspaceScope,
    type: z.literal("workspace.removed"),
    payload: z.object({ revision: z.number().int().nonnegative() }),
  }),
  "session.changed": z.object({
    ...sessionScope,
    type: z.literal("session.changed"),
    payload: SessionSummarySchema,
  }),
  "session.removed": z.object({
    ...sessionScope,
    type: z.literal("session.removed"),
    payload: z.object({ revision: z.number().int().nonnegative() }),
  }),
  "run.changed": z.object({
    ...runScope,
    type: z.literal("run.changed"),
    payload: RunSummarySchema,
  }),
  "transcript.item.committed": z.object({
    ...runScope,
    type: z.literal("transcript.item.committed"),
    durableEntryId: EntryIdSchema,
    payload: TranscriptItemSchema,
  }),
  "run.output.delta": z.object({
    ...runScope,
    type: z.literal("run.output.delta"),
    payload: z.discriminatedUnion("operation", [
      z.object({
        operation: z.literal("append"),
        target: z.enum(["text", "thinking"]),
        text: z.string(),
      }),
      z.object({
        operation: z.literal("replace"),
        target: z.literal("toolProgress"),
        callId: z.string(),
        status: z.string(),
        summary: z.string().optional(),
      }),
    ]),
  }),
  "run.phase.changed": z.object({
    ...runScope,
    type: z.literal("run.phase.changed"),
    payload: z.object({
      phase: z.enum([
        "queued",
        "thinking",
        "streaming",
        "tool",
        "settling",
        "terminal",
      ]),
      label: z.string().max(160).optional(),
    }),
  }),
  "models.changed": z.object({
    ...envelope,
    type: z.literal("models.changed"),
    payload: z.object({ revision: z.number().int().nonnegative() }),
  }),
  "providerAuth.changed": z.object({
    ...envelope,
    type: z.literal("providerAuth.changed"),
    payload: ProviderAuthStatusSchema,
  }),
  "authFlow.changed": z.object({
    ...envelope,
    type: z.literal("authFlow.changed"),
    payload: AuthFlowSchema,
  }),
} as const;

export const GatewayEventSchema = z.union(
  Object.values(gatewayEventSchemas) as unknown as [
    z.ZodType,
    z.ZodType,
    ...z.ZodType[],
  ],
);
export const StreamControlEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("stream.ready"),
    latestCursor: EventCursorSchema,
  }),
  z.object({
    type: z.literal("stream.reset"),
    reason: z.enum([
      "cursor_invalid",
      "epoch_changed",
      "replay_unavailable",
      "client_lagged",
    ]),
    requestedCursor: EventCursorSchema.optional(),
    oldestCursor: EventCursorSchema.optional(),
    latestCursor: EventCursorSchema,
  }),
]);
export const EventsQuerySchema = z.strictObject({
  after: EventCursorSchema.optional(),
});

export type GatewayEvent = z.infer<
  (typeof gatewayEventSchemas)[keyof typeof gatewayEventSchemas]
>;
export type StreamControlEvent = z.infer<typeof StreamControlEventSchema>;
export type GatewayStreamItem =
  | { kind: "connection"; state: "connecting" | "reconnecting" | "live" }
  | { kind: "event"; event: GatewayEvent | StreamControlEvent };
