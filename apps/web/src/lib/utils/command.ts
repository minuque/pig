import { CommandIdSchema, type CommandId } from "@no-pi-no-gang/contracts";

export function newCommandId(): CommandId {
  return CommandIdSchema.parse(crypto.randomUUID().replaceAll("-", "_"));
}
