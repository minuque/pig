import { afterEach, describe, expect, it } from "vitest";
import { ServerMessageDecoder } from "@earendil-works/pi-protocol";
import { WebSocket } from "ws";

import Gateway from "../src/index.js";
import type { DirectoryPort } from "../src/native/directory.js";

let selectedDirectory: string | undefined;
const directoryPort: DirectoryPort = {
  async selectDirectory() {
    return selectedDirectory;
  },
  async validateDirectory(path) {
    return path;
  },
};

let gateway: Gateway | undefined;
afterEach(async () => {
  selectedDirectory = undefined;
  await gateway?.stop();
  gateway = undefined;
});

async function startGateway(options?: ConstructorParameters<typeof Gateway>[0]) {
  gateway = new Gateway({
    bootstrapSecret: "test-secret",
    platformPort: directoryPort,
    ...options,
  });
  return `http://127.0.0.1:${await gateway.start()}`;
}

async function request(
  base: string,
  path: string,
  body?: unknown,
  credential?: string,
  method = body === undefined ? "GET" : "POST",
) {
  return fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(credential ? { authorization: `Bearer ${credential}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

describe("thin host HTTP shell", () => {
  it("serves /health", async () => {
    const base = await startGateway();
    expect(await (await request(base, "/health")).json()).toEqual({ status: "ok" });
  });

  it("exchanges bootstrap secret for a one-time credential", async () => {
    const base = await startGateway();
    expect((await request(base, "/api/v1/bootstrap", { secret: "wrong" })).status).toBe(401);
    const response = await request(base, "/api/v1/bootstrap", { secret: "test-secret" });
    expect(response.status).toBe(201);
    const { credential } = (await response.json()) as { credential: string };
    expect(credential).toBeTruthy();
    // 一次性：重复兑换被拒绝
    expect((await request(base, "/api/v1/bootstrap", { secret: "test-secret" })).status).toBe(401);
  });

  it("selects a directory only with a valid credential", async () => {
    const base = await startGateway();
    const { credential } = (await (
      await request(base, "/api/v1/bootstrap", { secret: "test-secret" })
    ).json()) as { credential: string };

    expect(
      (await request(base, "/api/v1/platform/select-directory", undefined, undefined, "POST"))
        .status,
    ).toBe(401);

    selectedDirectory = "C:/projects/demo";
    expect(
      await (
        await request(base, "/api/v1/platform/select-directory", undefined, credential, "POST")
      ).json(),
    ).toEqual({ path: "C:/projects/demo", requiresManualInput: false });

    // 用户取消时返回 null，可重试
    selectedDirectory = undefined;
    expect(
      await (
        await request(base, "/api/v1/platform/select-directory", undefined, credential, "POST")
      ).json(),
    ).toEqual({ path: null, requiresManualInput: false });
  });

  it("renames and deletes sessions only with a valid credential", async () => {
    const base = await startGateway();
    expect(
      (await request(base, "/api/v1/platform/rename-session", { id: "s", name: "a" })).status,
    ).toBe(401);
    expect((await request(base, "/api/v1/platform/delete-session", { id: "s" })).status).toBe(401);

    const { credential } = (await (
      await request(base, "/api/v1/bootstrap", { secret: "test-secret" })
    ).json()) as { credential: string };
    expect(
      (
        await request(
          base,
          "/api/v1/platform/rename-session",
          { id: "missing", name: "a" },
          credential,
        )
      ).status,
    ).toBe(404);
  });
});

describe("thin host WebSocket", () => {
  it("rejects upgrades without a valid credential", async () => {
    await startGateway();
    const port = gateway!.getPort();

    for (const url of [
      `ws://127.0.0.1:${port}/api/v1/pi`,
      `ws://127.0.0.1:${port}/api/v1/pi?credential=bad`,
    ]) {
      const status = await new Promise<number>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error("upgrade 未返回 unexpected-response")),
          3000,
        );
        const socket = new WebSocket(url);
        socket.once("unexpected-response", (_req, res) => {
          clearTimeout(timer);
          socket.terminate();
          resolve(res.statusCode ?? 0);
        });
        socket.once("error", () => {
          // unexpected-response 后底层 socket 被销毁也会触发 error，忽略
        });
      });
      expect(status).toBe(401);
    }
  });

  it("hands authenticated connections to PiServer after upgrade", async () => {
    const base = await startGateway();
    const port = gateway!.getPort();
    const { credential } = (await (
      await request(base, "/api/v1/bootstrap", { secret: "test-secret" })
    ).json()) as { credential: string };

    const socket = new WebSocket(`ws://127.0.0.1:${port}/api/v1/pi?credential=${credential}`);
    const result = await new Promise<{ message: unknown; closed: boolean }>((resolve, reject) => {
      const decoder = new ServerMessageDecoder();
      socket.on("message", (data) => {
        // 发送一个长度=1、载荷非法 CBOR 的帧：PiServer 应回 hello_error 并关闭
        const messages = decoder.push(data as Buffer);
        for (const message of messages) {
          if (message.type === "hello_error") {
            socket.close();
            resolve({ message, closed: false });
          }
        }
      });
      socket.once("close", () => resolve({ message: undefined, closed: true }));
      socket.once("error", reject);
      socket.once("open", () => socket.send(new Uint8Array([0x00, 0x00, 0x00, 0x01, 0xff])));
    });

    const message = result.message as { type: string; error?: { code: string } };
    expect(message.type).toBe("hello_error");
    expect(message.error?.code).toBe("invalid_request");
    expect(result.closed).toBe(false);
  });
});
