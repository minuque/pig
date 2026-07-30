import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { basename, join } from "path";

import { afterEach, describe, expect, it } from "vitest";

import Gateway from "../src/index.js";

let gateway: Gateway | undefined;
let root: string | undefined;
let outside: string | undefined;

afterEach(async () => {
  await gateway?.stop();
  if (root) await rm(root, { recursive: true, force: true });
  if (outside) await rm(outside, { force: true });
});

describe("production web server", () => {
  it("serves assets and falls back to the SPA without exposing other files", async () => {
    root = await mkdtemp(join(tmpdir(), "gateway-web-"));
    await writeFile(join(root, "index.html"), "<main>app</main>");
    await writeFile(join(root, "app.js"), "console.log('app')");
    outside = `${root}.txt`;
    await writeFile(outside, "secret");
    gateway = new Gateway({ webRoot: root });
    const origin = `http://127.0.0.1:${await gateway.start()}`;

    expect(await (await fetch(origin)).text()).toBe("<main>app</main>");
    expect(await (await fetch(`${origin}/sessions/one`)).text()).toBe("<main>app</main>");
    expect((await fetch(`${origin}/app.js`)).headers.get("content-type")).toContain("javascript");
    expect((await fetch(`${origin}/missing.js`)).status).toBe(404);
    expect(
      (await fetch(`${origin}/%2e%2e%2f${encodeURIComponent(basename(outside))}`)).status,
    ).toBe(404);
  });
});
