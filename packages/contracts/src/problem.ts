import { z } from "zod";

export const ProblemCodeSchema = z.enum([
  "request.invalid_json",
  "request.validation_failed",
  "auth.unauthenticated",
  "auth.forbidden",
  "auth.bootstrap_invalid",
  "auth.csrf_invalid",
  "protocol.client_too_old",
  "workspace.not_found",
  "workspace.revision_conflict",
  "workspace.path_invalid",
  "workspace.path_changed",
  "workspace.registration_preview_invalid",
  "workspace.in_use",
  "session.not_found",
  "session.revision_conflict",
  "session.unavailable",
  "run.not_found",
  "run.invalid_state",
  "run.queue_full",
  "command.idempotency_conflict",
  "command.admission_closed",
  "model.not_found",
  "model.unavailable",
  "provider_auth.required",
  "auth_flow.not_found",
  "auth_flow.invalid_state",
  "auth_flow.expired",
  "stream.cursor_invalid",
  "stream.replay_unavailable",
  "server.unavailable",
  "server.internal",
]);

export const ProblemDetailsSchema = z.object({
  type: z.string().url(),
  title: z.string().min(1).max(160),
  status: z.number().int().min(400).max(599),
  detail: z.string().min(1).max(1024),
  instance: z.string().min(1).max(512),
  code: ProblemCodeSchema,
  requestId: z.string().min(1).max(128),
  retryable: z.boolean(),
  retryAfterMs: z.number().int().nonnegative().optional(),
  details: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
    .optional(),
});

export type ProblemCode = z.infer<typeof ProblemCodeSchema>;
export type ProblemDetails = z.infer<typeof ProblemDetailsSchema>;
