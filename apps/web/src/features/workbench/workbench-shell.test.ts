import type { SessionSnapshot } from "@no-pi-no-gang/contracts";
import { buildRun, buildSession, buildWorkspace } from "@no-pi-no-gang/testkit";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { createPinia } from "pinia";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useLiveOverlayStore } from "@/features/sync/live-overlay-store";
import WorkbenchShell from "@/features/workbench/components/WorkbenchShell.vue";
import { GatewayClientKey } from "@/lib/gateway/client-context";
import { createAppRouter } from "@/router";
import {
  createMockGatewayClient,
  mockProviderAuth,
  mockSessionSnapshot,
} from "@/test-support/mock-client";

function narrowMediaQuery(matches: boolean) {
  return (query: string): MediaQueryList =>
    ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }) as unknown as MediaQueryList;
}

async function mountShell(client = createMockGatewayClient(), pinia = createPinia()) {
  const router = createAppRouter();
  await router.push("/");
  await router.isReady();
  const wrapper = mount(WorkbenchShell, {
    attachTo: document.body,
    global: {
      plugins: [pinia, [VueQueryPlugin, { queryClient: new QueryClient() }], router],
      provide: { [GatewayClientKey as symbol]: client },
      stubs: { teleport: true },
    },
  });
  await flushPromises();
  return { wrapper, client, router, pinia };
}

/** jsdom scroll seam: layout metrics are defined per element. */
function setScrollGeometry(element: Element, scrollHeight: number, clientHeight: number): void {
  Object.defineProperties(element, {
    scrollHeight: { value: scrollHeight, configurable: true },
    clientHeight: { value: clientHeight, configurable: true },
  });
}

/** Simulate one coalesced token update on an existing live Run overlay. */
function appendLiveText(
  store: ReturnType<typeof useLiveOverlayStore>,
  sessionId: string,
  runId: string,
  text: string,
): void {
  const current = store.overlay;
  const session = current.bySession[sessionId] ?? {};
  const run = session[runId];
  if (!run) throw new Error(`missing live overlay for ${sessionId}/${runId}`);
  store.commit({
    ...current,
    bySession: {
      ...current.bySession,
      [sessionId]: { ...session, [runId]: { ...run, text } },
    },
  });
}

async function mountSessionJourney(
  client: ReturnType<typeof createMockGatewayClient>,
  pinia: ReturnType<typeof createPinia>,
  sessionIds: string[],
) {
  vi.mocked(client.workspaces.list).mockResolvedValue({
    items: [buildWorkspace()],
    nextCursor: null,
  });
  vi.mocked(client.sessions.list).mockResolvedValue({
    items: sessionIds.map((sessionId, index) =>
      buildSession({ sessionId, name: `Session ${index + 1}` }),
    ),
    nextCursor: null,
  });
  vi.mocked(client.sessions.snapshot).mockImplementation(async ({ sessionId }) => {
    const runId = `run_${sessionId}`;
    return {
      ...mockSessionSnapshot(),
      session: buildSession({ sessionId }),
      activeRuns: [buildRun({ sessionId, runId, state: "running" })],
      partialOutputs: [{ runId, text: `seed ${sessionId}`, thinking: "", tools: [] }],
      capturedEventCursor: "epoch_1:5",
    } as unknown as SessionSnapshot;
  });
  const mounted = await mountShell(client, pinia);
  await mounted.wrapper.find(".workspace-select").trigger("click");
  await flushPromises();
  return mounted;
}

describe("WorkbenchShell semantics", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("exposes banner, navigation and main landmarks", async () => {
    const { wrapper } = await mountShell();
    expect(wrapper.find("header.shell-banner").exists()).toBe(true);
    const navs = wrapper.findAll("nav");
    expect(navs.map((nav) => nav.attributes("aria-label")).sort()).toEqual(["会话", "工作区"]);
    expect(wrapper.find("main.shell-main").exists()).toBe(true);
    expect(wrapper.find('[role="status"]').text()).toContain("正在连接");
    const theme = wrapper.find('select[aria-label="主题"]');
    expect(theme.exists()).toBe(true);
    expect(theme.findAll("option")).toHaveLength(3);
    wrapper.unmount();
  });

  it("navigates the workspace → session journey by keyboard-activatable buttons", async () => {
    const client = createMockGatewayClient();
    vi.mocked(client.workspaces.list).mockResolvedValue({
      items: [buildWorkspace()],
      nextCursor: null,
    });
    vi.mocked(client.sessions.list).mockResolvedValue({
      items: [buildSession()],
      nextCursor: null,
    });
    const { wrapper, router } = await mountShell(client);

    const workspaceButton = wrapper.find(".workspace-select");
    expect(workspaceButton.exists()).toBe(true);
    (workspaceButton.element as HTMLElement).focus();
    expect(document.activeElement).toBe(workspaceButton.element);
    await workspaceButton.trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.params.workspaceId).toBe("workspace_1");

    const sessionButton = wrapper.find(".session-select");
    expect(sessionButton.exists()).toBe(true);
    await sessionButton.trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.params.sessionId).toBe("session_1");
    expect(wrapper.find("#prompt-input").exists()).toBe(true);
    wrapper.unmount();
  });

  it("opens the provider auth dialog with focus containment, closes on Escape and returns focus", async () => {
    const { wrapper } = await mountShell();
    const trigger = wrapper.findAll("button").find((button) => button.text() === "Provider 授权");
    expect(trigger).toBeDefined();
    (trigger!.element as HTMLElement).focus();
    await trigger!.trigger("click");
    await flushPromises();

    const dialog = wrapper.find('[role="dialog"]');
    expect(dialog.exists()).toBe(true);
    expect(dialog.attributes("aria-modal")).toBe("true");
    expect(dialog.element.contains(document.activeElement)).toBe(true);

    await dialog.trigger("keydown", { key: "Escape" });
    await flushPromises();
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    expect(document.activeElement).toBe(trigger!.element);
    wrapper.unmount();
  });

  it("opens the auth sheet targeted at the unavailable model's provider from the composer", async () => {
    const client = createMockGatewayClient();
    const pinia = createPinia();
    // The provider list is queried when the shell mounts.
    vi.mocked(client.providerAuth.list).mockResolvedValue([mockProviderAuth()]);
    const { wrapper } = await mountSessionJourney(client, pinia, ["session_auth"]);
    vi.mocked(client.models.list).mockResolvedValue([
      {
        modelId: "model_down",
        providerId: "anthropic",
        name: "Down model",
        available: false,
        thinkingLevels: ["medium"],
      } as never,
    ]);
    await wrapper.find(".session-select").trigger("click");
    await flushPromises();

    const trigger = wrapper.findAll("button").find((button) => button.text() === "授权 anthropic");
    expect(trigger).toBeDefined();
    (trigger!.element as HTMLElement).focus();
    await trigger!.trigger("click");
    await flushPromises();

    const dialog = wrapper.find('[role="dialog"]');
    expect(dialog.exists()).toBe(true);
    expect(dialog.text()).toContain("anthropic");
    expect(dialog.find(".provider-card--targeted").exists()).toBe(true);
    // AppSheet still owns focus: contained on open, returned on close.
    expect(dialog.element.contains(document.activeElement)).toBe(true);
    await dialog.trigger("keydown", { key: "Escape" });
    await flushPromises();
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    expect(document.activeElement).toBe(trigger!.element);
    wrapper.unmount();
  });

  it("contains Tab inside an open dialog", async () => {
    const { wrapper } = await mountShell();
    const trigger = wrapper.findAll("button").find((button) => button.text() === "Provider 授权");
    await trigger!.trigger("click");
    await flushPromises();

    const dialog = wrapper.find('[role="dialog"]');
    const focusable = dialog.element.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    expect(focusable.length).toBeGreaterThan(0);
    const last = focusable[focusable.length - 1]!;
    last.focus();
    await dialog.trigger("keydown", { key: "Tab" });
    expect(dialog.element.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(focusable[0]!);
    wrapper.unmount();
  });

  it("moves navigation into modal sheets on narrow viewports", async () => {
    vi.stubGlobal("matchMedia", narrowMediaQuery(true));
    const client = createMockGatewayClient();
    vi.mocked(client.workspaces.list).mockResolvedValue({
      items: [buildWorkspace()],
      nextCursor: null,
    });
    const { wrapper } = await mountShell(client);

    // Inline navigation landmarks are gone; a toolbar offers sheet triggers.
    expect(wrapper.findAll("nav")).toHaveLength(0);
    const toolbar = wrapper.find('[role="toolbar"][aria-label="导航"]');
    expect(toolbar.exists()).toBe(true);

    const railTrigger = toolbar.findAll("button").find((button) => button.text() === "工作区");
    expect(railTrigger).toBeDefined();
    (railTrigger!.element as HTMLElement).focus();
    await railTrigger!.trigger("click");
    await flushPromises();

    const dialog = wrapper.find('[role="dialog"]');
    expect(dialog.exists()).toBe(true);
    expect(dialog.find('nav[aria-label="工作区"]').exists()).toBe(true);
    expect(dialog.element.contains(document.activeElement)).toBe(true);

    await dialog.trigger("keydown", { key: "Escape" });
    await flushPromises();
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    expect(document.activeElement).toBe(railTrigger!.element);
    wrapper.unmount();
  });
});

describe("TranscriptList scroll behavior", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("follows the tail on live token updates even when the entry count is unchanged", async () => {
    const client = createMockGatewayClient();
    const pinia = createPinia();
    const { wrapper } = await mountSessionJourney(client, pinia, ["session_follow"]);
    await wrapper.find(".session-select").trigger("click");
    await flushPromises();

    const scroller = wrapper.find(".transcript-scroll");
    expect(scroller.exists()).toBe(true);
    setScrollGeometry(scroller.element, 1000, 200);
    (scroller.element as HTMLElement).scrollTop = 950;

    const store = useLiveOverlayStore(pinia);
    appendLiveText(store, "session_follow", "run_session_follow", "seed session_follow token");
    await flushPromises();

    expect(wrapper.findAll(".transcript-list li")).toHaveLength(1);
    expect((scroller.element as HTMLElement).scrollTop).toBe(1000);
    wrapper.unmount();
  });

  it("shows a keyboard-activatable jump-to-latest button once the user left the tail", async () => {
    const client = createMockGatewayClient();
    const pinia = createPinia();
    const { wrapper } = await mountSessionJourney(client, pinia, ["session_jump"]);
    await wrapper.find(".session-select").trigger("click");
    await flushPromises();

    const scroller = wrapper.find(".transcript-scroll");
    setScrollGeometry(scroller.element, 1000, 200);
    (scroller.element as HTMLElement).scrollTop = 0;
    await scroller.trigger("scroll");

    const store = useLiveOverlayStore(pinia);
    appendLiveText(store, "session_jump", "run_session_jump", "grew");
    await flushPromises();

    const jump = wrapper.findAll("button").find((button) => button.text() === "跳转到最新");
    expect(jump).toBeDefined();
    expect(jump!.attributes("type")).toBe("button");
    await jump!.trigger("click");
    await flushPromises();

    expect((scroller.element as HTMLElement).scrollTop).toBe(1000);
    expect(
      wrapper.findAll("button").find((button) => button.text() === "跳转到最新"),
    ).toBeUndefined();
    wrapper.unmount();
  });

  it("restores per-Session scroll positions across switches and remounts without cross-writing", async () => {
    const client = createMockGatewayClient();
    const pinia = createPinia();
    const { wrapper, router } = await mountSessionJourney(client, pinia, [
      "session_a",
      "session_b",
    ]);
    const sessionButtons = () => wrapper.findAll(".session-select");

    // Session A: user scrolls up, away from the tail.
    await sessionButtons()[0]!.trigger("click");
    await flushPromises();
    const scroller = wrapper.find(".transcript-scroll");
    setScrollGeometry(scroller.element, 1000, 200);
    (scroller.element as HTMLElement).scrollTop = 300;
    await scroller.trigger("scroll");

    // Session B (never visited): follows the tail.
    await sessionButtons()[1]!.trigger("click");
    await flushPromises();
    expect((scroller.element as HTMLElement).scrollTop).toBe(1000);

    // Back to A: the scrolled-up position is restored, not B's tail.
    await sessionButtons()[0]!.trigger("click");
    await flushPromises();
    expect((scroller.element as HTMLElement).scrollTop).toBe(300);

    // B again: still tail-pinned, not clobbered by A's position.
    await sessionButtons()[1]!.trigger("click");
    await flushPromises();
    expect((scroller.element as HTMLElement).scrollTop).toBe(1000);

    // Leaving the Session route unmounts the list; the per-process position
    // survives and is restored on the next visit.
    await router.push({
      name: "workspace",
      params: { workspaceId: "workspace_1" },
    });
    await flushPromises();
    expect(wrapper.find(".transcript-scroll").exists()).toBe(false);
    await sessionButtons()[0]!.trigger("click");
    await flushPromises();
    const remounted = wrapper.find(".transcript-scroll");
    expect(remounted.exists()).toBe(true);
    expect((remounted.element as HTMLElement).scrollTop).toBe(300);
    wrapper.unmount();
  });
});
