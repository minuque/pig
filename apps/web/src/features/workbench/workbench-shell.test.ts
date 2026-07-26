import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { createPinia } from "pinia";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { buildSession, buildWorkspace } from "@no-pi-no-gang/testkit";
import WorkbenchShell from "@/features/workbench/components/WorkbenchShell.vue";
import { createAppRouter } from "@/router";
import { GatewayClientKey } from "@/lib/gateway/client-context";
import { createMockGatewayClient } from "@/test-support/mock-client";

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

async function mountShell(client = createMockGatewayClient()) {
  const router = createAppRouter();
  await router.push("/");
  await router.isReady();
  const wrapper = mount(WorkbenchShell, {
    attachTo: document.body,
    global: {
      plugins: [createPinia(), [VueQueryPlugin, { queryClient: new QueryClient() }], router],
      provide: { [GatewayClientKey as symbol]: client },
      stubs: { teleport: true },
    },
  });
  await flushPromises();
  return { wrapper, client, router };
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
