import type { ProviderId } from "@no-pi-no-gang/contracts";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import ProviderAuthFlow from "@/features/auth/components/ProviderAuthFlow.vue";
import { GatewayClientKey } from "@/lib/gateway/client-context";
import {
  createMockGatewayClient,
  mockAuthFlow,
  mockMutationResult,
  mockProviderAuth,
} from "@/test-support/mock-client";

function mountFlow(
  client: ReturnType<typeof createMockGatewayClient>,
  queryClient = new QueryClient(),
) {
  return mount(ProviderAuthFlow, {
    props: { open: true },
    attachTo: document.body,
    global: {
      plugins: [[VueQueryPlugin, { queryClient }]],
      provide: { [GatewayClientKey as symbol]: client },
      stubs: { teleport: true },
    },
  });
}

function passwordInput(wrapper: VueWrapper) {
  return wrapper.find('input[type="password"]');
}

function startButton(wrapper: VueWrapper) {
  return wrapper.findAll("button").find((button) => button.text() === "开始授权");
}

describe("ProviderAuthFlow secrets", () => {
  it("clears the API key input immediately after save (write-only secret)", async () => {
    const client = createMockGatewayClient();
    vi.mocked(client.providerAuth.list).mockResolvedValue([
      mockProviderAuth({ methods: ["apiKey"] }),
    ]);
    vi.mocked(client.providerAuth.setApiKey).mockResolvedValue(
      mockMutationResult(mockProviderAuth({ state: "ready" })),
    );
    const wrapper = mountFlow(client);
    await flushPromises();

    const input = passwordInput(wrapper);
    await input.setValue("sk-secret-value");
    await wrapper.find("form.provider-row").trigger("submit");
    await flushPromises();

    expect(client.providerAuth.setApiKey).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: "sk-secret-value" }),
    );
    expect((passwordInput(wrapper).element as HTMLInputElement).value).toBe("");
    wrapper.unmount();
  });

  it("clears the API key from state and DOM before the write promise settles", async () => {
    const client = createMockGatewayClient();
    vi.mocked(client.providerAuth.list).mockResolvedValue([
      mockProviderAuth({ methods: ["apiKey"] }),
    ]);
    let resolveWrite!: (value: unknown) => void;
    vi.mocked(client.providerAuth.setApiKey).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveWrite = resolve as (value: unknown) => void;
        }),
    );
    const queryClient = new QueryClient();
    const wrapper = mountFlow(client, queryClient);
    await flushPromises();

    const input = passwordInput(wrapper);
    await input.setValue("sk-canary-pending");
    await wrapper.find("form.provider-row").trigger("submit");

    // The write is still in flight, yet state and DOM are already empty.
    expect(client.providerAuth.setApiKey).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: "sk-canary-pending" }),
    );
    expect((passwordInput(wrapper).element as HTMLInputElement).value).toBe("");

    resolveWrite(mockMutationResult(mockProviderAuth({ state: "ready" })));
    await flushPromises();
    expect((passwordInput(wrapper).element as HTMLInputElement).value).toBe("");
    expect(JSON.stringify(queryClient.getQueryCache().getAll())).not.toContain("sk-canary-pending");
    wrapper.unmount();
  });

  it("clears a sensitive prompt answer before the respond promise settles", async () => {
    const client = createMockGatewayClient();
    vi.mocked(client.providerAuth.list).mockResolvedValue([
      mockProviderAuth({
        providerId: "openai" as ProviderId,
        methods: ["authFlow"],
      }),
    ]);
    const flow = mockAuthFlow({
      providerId: "openai" as ProviderId,
      interaction: {
        kind: "prompt",
        promptId: "p1",
        label: "输入验证码",
        sensitive: true,
      },
    });
    vi.mocked(client.authFlows.create).mockResolvedValue(mockMutationResult(flow));
    vi.mocked(client.authFlows.get).mockResolvedValue(flow);
    let resolveRespond!: (value: unknown) => void;
    vi.mocked(client.authFlows.respond).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRespond = resolve as (value: unknown) => void;
        }),
    );
    const queryClient = new QueryClient();
    const wrapper = mountFlow(client, queryClient);
    await flushPromises();

    await startButton(wrapper)!.trigger("click");
    await flushPromises();
    const input = wrapper.find("#auth-prompt-response");
    await input.setValue("my-canary-answer");
    await wrapper.find("form.interaction").trigger("submit");

    // Pending respond promise: the secret is already gone from state and DOM.
    expect(client.authFlows.respond).toHaveBeenCalledWith(
      expect.objectContaining({ response: "my-canary-answer" }),
    );
    expect((wrapper.find("#auth-prompt-response").element as HTMLInputElement).value).toBe("");

    resolveRespond(mockMutationResult(flow));
    await flushPromises();
    expect(wrapper.text()).not.toContain("my-canary-answer");
    expect(JSON.stringify(queryClient.getQueryCache().getAll())).not.toContain("my-canary-answer");
    wrapper.unmount();
  });

  it("clears the prompt answer after respond and never keeps it locally", async () => {
    const client = createMockGatewayClient();
    vi.mocked(client.providerAuth.list).mockResolvedValue([
      mockProviderAuth({
        providerId: "openai" as ProviderId,
        methods: ["authFlow"],
      }),
    ]);
    const flow = mockAuthFlow({
      providerId: "openai" as ProviderId,
      interaction: {
        kind: "prompt",
        promptId: "p1",
        label: "输入验证码",
        sensitive: true,
      },
    });
    vi.mocked(client.authFlows.create).mockResolvedValue(mockMutationResult(flow));
    vi.mocked(client.authFlows.get).mockResolvedValue(flow);
    vi.mocked(client.authFlows.respond).mockResolvedValue(mockMutationResult(flow));
    const wrapper = mountFlow(client);
    await flushPromises();

    await startButton(wrapper)!.trigger("click");
    await flushPromises();
    const input = wrapper.find("#auth-prompt-response");
    expect(input.exists()).toBe(true);
    expect(input.attributes("type")).toBe("password");
    await input.setValue("my-secret-answer");
    await wrapper.find("form.interaction").trigger("submit");
    await flushPromises();

    expect(client.authFlows.respond).toHaveBeenCalledWith(
      expect.objectContaining({
        flowId: "flow_1",
        promptId: "p1",
        response: "my-secret-answer",
      }),
    );
    expect((wrapper.find("#auth-prompt-response").element as HTMLInputElement).value).toBe("");
    wrapper.unmount();
  });

  it("cancelling a flow clears secrets and terminates the flow", async () => {
    const client = createMockGatewayClient();
    vi.mocked(client.providerAuth.list).mockResolvedValue([
      mockProviderAuth({ methods: ["authFlow"] }),
    ]);
    const flow = mockAuthFlow({
      interaction: {
        kind: "prompt",
        promptId: "p1",
        label: "输入验证码",
        sensitive: true,
      },
    });
    vi.mocked(client.authFlows.create).mockResolvedValue(mockMutationResult(flow));
    vi.mocked(client.authFlows.get).mockResolvedValue(flow);
    vi.mocked(client.authFlows.cancel).mockResolvedValue(
      mockMutationResult(mockAuthFlow({ state: "cancelled" })),
    );
    const wrapper = mountFlow(client);
    await flushPromises();

    await startButton(wrapper)!.trigger("click");
    await flushPromises();
    await wrapper.find("#auth-prompt-response").setValue("half-typed");
    const cancelButton = wrapper.findAll("button").find((button) => button.text() === "取消授权");
    expect(cancelButton).toBeDefined();
    await cancelButton!.trigger("click");
    await flushPromises();

    expect(client.authFlows.cancel).toHaveBeenCalledWith(
      expect.objectContaining({ flowId: "flow_1" }),
    );
    expect(wrapper.find("#auth-prompt-response").exists()).toBe(false);
    wrapper.unmount();
  });

  it("closing the sheet cancels a pending flow", async () => {
    const client = createMockGatewayClient();
    vi.mocked(client.providerAuth.list).mockResolvedValue([
      mockProviderAuth({ methods: ["authFlow"] }),
    ]);
    const flow = mockAuthFlow({
      interaction: {
        kind: "openUrl",
        url: "https://example.com/auth",
        label: "打开授权页",
      },
    });
    vi.mocked(client.authFlows.create).mockResolvedValue(mockMutationResult(flow));
    vi.mocked(client.authFlows.get).mockResolvedValue(flow);
    vi.mocked(client.authFlows.cancel).mockResolvedValue(
      mockMutationResult(mockAuthFlow({ state: "cancelled" })),
    );
    const wrapper = mountFlow(client);
    await flushPromises();

    await startButton(wrapper)!.trigger("click");
    await flushPromises();
    expect(wrapper.find('a[href="https://example.com/auth"]').exists()).toBe(true);

    await wrapper.setProps({ open: false });
    await flushPromises();
    expect(client.authFlows.cancel).toHaveBeenCalledWith(
      expect.objectContaining({ flowId: "flow_1" }),
    );
    wrapper.unmount();
  });
});

describe("ProviderAuthFlow interactions", () => {
  it("renders device code with verification link and user code", async () => {
    const client = createMockGatewayClient();
    vi.mocked(client.providerAuth.list).mockResolvedValue([
      mockProviderAuth({ methods: ["authFlow"] }),
    ]);
    const flow = mockAuthFlow({
      interaction: {
        kind: "deviceCode",
        verificationUrl: "https://example.com/device",
        userCode: "ABCD-1234",
        expiresAt: "2025-01-02T04:04:05.000Z",
      },
    });
    vi.mocked(client.authFlows.create).mockResolvedValue(mockMutationResult(flow));
    vi.mocked(client.authFlows.get).mockResolvedValue(flow);
    const wrapper = mountFlow(client);
    await flushPromises();

    await startButton(wrapper)!.trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("ABCD-1234");
    expect(wrapper.find('a[href="https://example.com/device"]').exists()).toBe(true);
    wrapper.unmount();
  });

  it("renders select options and responds with the chosen value", async () => {
    const client = createMockGatewayClient();
    vi.mocked(client.providerAuth.list).mockResolvedValue([
      mockProviderAuth({ methods: ["authFlow"] }),
    ]);
    const flow = mockAuthFlow({
      interaction: {
        kind: "select",
        promptId: "s1",
        label: "选择账户",
        options: [
          { value: "personal", label: "个人账户" },
          { value: "team", label: "团队账户" },
        ],
      },
    });
    vi.mocked(client.authFlows.create).mockResolvedValue(mockMutationResult(flow));
    vi.mocked(client.authFlows.get).mockResolvedValue(flow);
    vi.mocked(client.authFlows.respond).mockResolvedValue(mockMutationResult(flow));
    const wrapper = mountFlow(client);
    await flushPromises();

    let resolveRespond!: (value: unknown) => void;
    vi.mocked(client.authFlows.respond).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRespond = resolve as (value: unknown) => void;
        }),
    );
    await startButton(wrapper)!.trigger("click");
    await flushPromises();
    const radios = wrapper.findAll('input[type="radio"]');
    expect(radios).toHaveLength(2);
    await radios[1]!.setValue(true);
    await wrapper.find("form.interaction").trigger("submit");

    // The choice is cleared from state and DOM before the promise settles.
    expect(client.authFlows.respond).toHaveBeenCalledWith(
      expect.objectContaining({ promptId: "s1", response: "team" }),
    );
    expect((wrapper.findAll('input[type="radio"]')[1]!.element as HTMLInputElement).checked).toBe(
      false,
    );

    resolveRespond(mockMutationResult(flow));
    await flushPromises();
    expect((wrapper.findAll('input[type="radio"]')[1]!.element as HTMLInputElement).checked).toBe(
      false,
    );
    wrapper.unmount();
  });
});
