import { z } from "zod";
import { InstantSchema, RevisionSchema } from "./common.js";
import {
  CommandIdSchema,
  ModelIdSchema,
  RunIdSchema,
  SessionIdSchema,
} from "./ids.js";

export const ThinkingLevelSchema = z.enum([
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
]);
export const ExecutionProfileSchema = z.object({
  modelId: ModelIdSchema,
  thinkingLevel: ThinkingLevelSchema,
});
export const RunStateSchema = z.enum([
  "queued",
  "starting",
  "running",
  "cancelling",
  "completed",
  "failed",
  "cancelled",
  "interrupted",
]);
export const RunSummarySchema = z.object({
  runId: RunIdSchema,
  sessionId: SessionIdSchema,
  revision: RevisionSchema,
  state: RunStateSchema,
  executionProfile: ExecutionProfileSchema,
  createdAt: InstantSchema,
  updatedAt: InstantSchema,
});
export const RunDetailSchema = RunSummarySchema.extend({
  prompt: z.string().min(1).max(200_000),
  retryOfRunId: RunIdSchema.optional(),
  failureCode: z.string().max(120).optional(),
});
export const CreateRunSchema = z.strictObject({
  commandId: CommandIdSchema,
  prompt: z.string().trim().min(1).max(200_000),
  executionProfile: ExecutionProfileSchema,
  retryOfRunId: RunIdSchema.optional(),
});
export const SteerRunSchema = z.strictObject({
  commandId: CommandIdSchema,
  instruction: z.string().trim().min(1).max(50_000),
});
export const CancelRunSchema = z.strictObject({ commandId: CommandIdSchema });

export type ThinkingLevel = z.infer<typeof ThinkingLevelSchema>;
export type ExecutionProfile = z.infer<typeof ExecutionProfileSchema>;
export type RunState = z.infer<typeof RunStateSchema>;
export type RunSummary = z.infer<typeof RunSummarySchema>;
export type RunDetail = z.infer<typeof RunDetailSchema>;
