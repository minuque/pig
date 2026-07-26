import { z } from "zod";
import { CommandIdSchema, OpaqueCursorSchema } from "./ids.js";

export const InstantSchema = z.iso.datetime({ offset: true });
export const RevisionSchema = z.number().int().nonnegative();
export const ContractRevisionSchema = z.number().int().positive();
export const CommandReceiptSchema = z.object({
  commandId: CommandIdSchema,
  disposition: z.enum(["applied", "accepted", "replayed"]),
  acceptedAt: InstantSchema,
});

export const mutationResultSchema = <T extends z.ZodType>(result: T) =>
  z.object({ receipt: CommandReceiptSchema, result });

export const cursorPageSchema = <T extends z.ZodType>(item: T) =>
  z.object({ items: z.array(item), nextCursor: OpaqueCursorSchema.nullable() });

export const PaginationQuerySchema = z.strictObject({
  cursor: OpaqueCursorSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
export const EmptySchema = z.strictObject({});
export const CommandOnlySchema = z.strictObject({ commandId: CommandIdSchema });
export const RevisionCommandSchema = z.strictObject({
  commandId: CommandIdSchema,
  expectedRevision: RevisionSchema,
});

export type Instant = z.infer<typeof InstantSchema>;
export type Revision = z.infer<typeof RevisionSchema>;
export type CommandReceipt = z.infer<typeof CommandReceiptSchema>;
export type MutationResult<T> = { receipt: CommandReceipt; result: T };
export type CursorPage<T> = {
  items: T[];
  nextCursor: z.infer<typeof OpaqueCursorSchema> | null;
};
