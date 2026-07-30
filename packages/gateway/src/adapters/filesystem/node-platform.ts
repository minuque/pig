import { realpath } from "fs/promises";
import { resolve } from "path";
import type { PlatformPort } from "@no-pi-no-gang/contracts";

export class NodePlatformPort implements PlatformPort {
  async canonicalizeWorkspacePath(candidatePath: string): Promise<string> {
    return realpath(resolve(candidatePath));
  }
}
