import { afterEach, describe, expect, it } from "vitest";

import type { PlatformPort } from "@no-pi-no-gang/contracts";
import Gateway from "../src/index.js";

const platformPort: PlatformPort = {
  async canonicalizeWorkspacePath(path) {
    if (!path.startsWith("C:/")) throw new Error("invalid path");
    return path.replace(/\\/g, "/").replace(/\/$/, "").toLowerCase();
  },
};

let gateway: Gateway | undefined;
afterEach(async () => gateway?.stop());

async function request(
  port: number,
  path: string,
  body?: unknown,
  credential?: string,
  method = body === undefined ? "GET" : "POST",
) {
  return fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(credential ? { authorization: `Bearer ${credential}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function bootstrap(port: number) {
  const response = await request(port, "/api/v1/bootstrap", { secret: "test-secret" });
  expect(response.status).toBe(201);
  return (await response.json()) as { credential: string; identityId: string };
}

describe("workspace access", () => {
  it("previews without granting, confirms a canonical workspace, and gates resources", async () => {
    gateway = new Gateway({ platformPort, bootstrapSecret: "test-secret" });
    const port = await gateway.start();
    const { credential } = await bootstrap(port);

    const preview = await request(
      port,
      "/api/v1/workspaces/preview",
      { path: "C:/Project/" },
      credential,
    );
    expect(await preview.json()).toEqual({ canonicalPath: "c:/project" });
    expect(await (await request(port, "/api/v1/workspaces", undefined, credential)).json()).toEqual(
      {
        workspaces: [],
      },
    );

    const confirm = await request(
      port,
      "/api/v1/workspaces/confirm",
      { path: "C:/Project/", name: "Project", commandId: "command-1" },
      credential,
    );
    expect(confirm.status).toBe(201);
    const first = (await confirm.json()) as { workspace: { id: string; canonicalPath: string } };
    expect(first.workspace.canonicalPath).toBe("c:/project");

    expect((await request(port, `/api/v1/workspaces/${first.workspace.id}`)).status).toBe(401);
    expect(
      (await request(port, "/api/v1/workspaces/not-authorized", undefined, credential)).status,
    ).toBe(403);

    const retry = await request(
      port,
      "/api/v1/workspaces/confirm",
      { path: "C:/Project/", name: "Project", commandId: "command-1" },
      credential,
    );
    expect(((await retry.json()) as typeof first).workspace.id).toBe(first.workspace.id);
  });

  it("rejects command reuse and a second canonical workspace", async () => {
    gateway = new Gateway({ platformPort, bootstrapSecret: "test-secret" });
    const port = await gateway.start();
    const { credential } = await bootstrap(port);
    const confirm = (body: unknown) =>
      request(port, "/api/v1/workspaces/confirm", body, credential);

    expect((await confirm({ path: "C:/One", commandId: "same-command" })).status).toBe(201);
    expect(
      (await confirm({ path: "C:/One", name: "changed", commandId: "same-command" })).status,
    ).toBe(409);
    const limited = await confirm({ path: "C:/Two", commandId: "other-command" });
    expect(limited.status).toBe(409);
    expect(await limited.json()).toEqual({ code: "SINGLE_WORKSPACE_LIMIT" });
  });
});
