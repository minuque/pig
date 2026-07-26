import { describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { buildRun } from "@no-pi-no-gang/testkit";
import PromptComposer from "@/features/session/components/PromptComposer.vue";
import { GatewayClientKey } from "@/lib/gateway/client-context";
import {
  createMockGatewayClient,
  mockMutationResult,
} from "@/test-support/mock-client";

async function mountComposer() {
  const client = createMockGatewayClient();
  vi.mocked(client.models.list).mockResolvedValue([
    {
      modelId: "model_new",
      providerId: "provider_1",
      name: "New model",
      available: true,
      thinkingLevels: ["off", "medium"],
    } as never,
  ]);
  vi.mocked(client.runs.create).mockResolvedValue(
    mockMutationResult(buildRun({ modelId: "model_new" })),
  );
  vi.mocked(client.runs.steer).mockResolvedValue(
    mockMutationResult(buildRun({ state: "running" })),
  );
  const activeRun = buildRun({
    state: "running",
    executionProfile: { modelId: "model_frozen", thinkingLevel: "high" },
  });
  const wrapper = mount(PromptComposer, {
    props: {
      sessionId: "session_1" as never,
      activeRun,
      sessionAvailable: true,
    },
    global: {
      plugins: [
        createPinia(),
        [VueQueryPlugin, { queryClient: new QueryClient() }],
      ],
      provide: { [GatewayClientKey as symbol]: client },
    },
  });
  await flushPromises();
  return { wrapper, client };
}

describe("PromptComposer Run semantics", () => {
  it("ordinary submit always creates a Run while Steer remains explicit", async () => {
    const { wrapper, client } = await mountComposer();
    const input = wrapper.find("#prompt-input");
    await input.setValue("ordinary prompt");
    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(client.runs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "session_1",
        prompt: "ordinary prompt",
        executionProfile: { modelId: "model_new", thinkingLevel: "off" },
      }),
    );
    expect(client.runs.steer).not.toHaveBeenCalled();

    await input.setValue("explicit correction");
    const steer = wrapper
      .findAll("button")
      .find((button) => button.text() === "Steer 当前 Run");
    expect(steer).toBeDefined();
    await steer!.trigger("click");
    await flushPromises();
    expect(client.runs.steer).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: "run_1",
        instruction: "explicit correction",
      }),
    );
    expect(wrapper.text()).toContain("model_frozen / high（已冻结）");
    expect(
      wrapper.find('select[aria-label="模型"]').attributes("disabled"),
    ).toBeUndefined();
    wrapper.unmount();
  });
});
