import { mkdir } from "node:fs/promises";
import { request } from "node:http";
import { join } from "node:path";
import { ProblemDetailsSchema, endpoints } from "@no-pi-no-gang/contracts";
import { afterEach, describe, expect, it } from "vitest";
import type { CapabilityAdapter } from "../src/capabilities.js";
import { createHttpGateway } from "../src/server.js";
import { openStore, removeTempDir, rootsFor, tempDir } from "./helpers.js";

const cleanups: string[] = [];
afterEach(async () => {
  await Promise.all(cleanups.splice(0).map(removeTempDir));
});

const capabilities: CapabilityAdapter = {
  async models() {
    return [];
  },
  async providerAuth() {
    return [];
  },
  async setApiKey() {
    throw new Error("not used");
  },
  async deleteCredential() {
    throw new Error("not used");
  },
  async login() {
    throw new Error("not used");
  },
};

function concretePath(path: string): string {
  return path.replace(/:[^/]+/g, "missing_1");
}

function requestStatus(
  url: string,
  headers: Record<string, string>,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const outgoing = request(url, { headers }, (response) => {
      response.resume();
      response.once("end", () => resolve(response.statusCode ?? 0));
    });
    outgoing.once("error", reject);
    outgoing.end();
  });
}

describe("server contract registry", () => {
  it("implements every endpoint and returns a parseable success or Problem", async () => {
    const dir = await tempDir();
    cleanups.push(dir);
    const roots = rootsFor(dir);
    await mkdir(roots.data, { recursive: true });
    const { store } = await openStore(roots.database);
    const gateway = await createHttpGateway(store, roots, undefined, dir, {
      capabilities,
    });
    try {
      for (const endpoint of endpoints) {
        const headers = new Headers();
        if (endpoint.method !== "GET") {
          headers.set("origin", gateway.origin);
          headers.set("content-type", "application/json");
        }
        const response = await fetch(
          `${gateway.origin}${concretePath(endpoint.path)}`,
          {
            method: endpoint.method,
            headers,
            ...(endpoint.method === "GET"
              ? {}
              : {
                  body: JSON.stringify(
                    endpoint.operationId === "gatewayAuthBootstrap"
                      ? { secret: "x".repeat(43) }
                      : {},
                  ),
                }),
          },
        );
        expect(response.status, endpoint.operationId).not.toBe(404);
        const body = await response.json();
        if (response.status === endpoint.successStatus) {
          expect(
            endpoint.successSchema.safeParse(body).success,
            endpoint.operationId,
          ).toBe(true);
        } else {
          expect(
            ProblemDetailsSchema.safeParse(body).success,
            endpoint.operationId,
          ).toBe(true);
        }
      }
    } finally {
      await gateway.close();
    }
  });

  it("does not expose unknown Error messages and gates static files by Host and Origin", async () => {
    const dir = await tempDir();
    cleanups.push(dir);
    const roots = rootsFor(dir);
    await mkdir(roots.data, { recursive: true });
    const { store } = await openStore(roots.database);
    const gateway = await createHttpGateway(store, roots, undefined, dir, {
      capabilities: {
        ...capabilities,
        async models() {
          throw new Error("unknown-secret-canary");
        },
      },
    });
    try {
      const secret = new URL(gateway.bootstrapUrl).hash.slice(
        "#bootstrap=".length,
      );
      const exchanged = await fetch(
        `${gateway.origin}/api/v1/gateway-auth/bootstrap`,
        {
          method: "POST",
          headers: {
            origin: gateway.origin,
            "content-type": "application/json",
          },
          body: JSON.stringify({ secret }),
        },
      );
      const cookie = exchanged.headers.get("set-cookie")!.split(";")[0]!;
      const internal = await fetch(`${gateway.origin}/api/v1/bootstrap`, {
        headers: { origin: gateway.origin, cookie },
      });
      expect(internal.status).toBe(500);
      expect(await internal.text()).not.toContain("unknown-secret-canary");

      const badOrigin = await fetch(`${gateway.origin}/`, {
        headers: { origin: "https://evil.example" },
      });
      expect(badOrigin.status).toBe(403);
      const badHostStatus = await requestStatus(`${gateway.origin}/`, {
        host: "evil.example",
      });
      expect(badHostStatus).toBe(403);
    } finally {
      await gateway.close();
    }
  });
});
