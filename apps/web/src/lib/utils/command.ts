import { type CommandId, CommandIdSchema } from "@no-pi-no-gang/contracts";

export function newCommandId(): CommandId {
  return CommandIdSchema.parse(crypto.randomUUID().replaceAll("-", "_"));
}
