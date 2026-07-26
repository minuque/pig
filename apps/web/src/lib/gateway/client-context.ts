import { type App, type InjectionKey, inject } from "vue";
import type { WebGatewayClient } from "@/lib/gateway/client";

export const GatewayClientKey: InjectionKey<WebGatewayClient> = Symbol("GatewayClient");

export function provideGatewayClient(app: App, client: WebGatewayClient): void {
  app.provide(GatewayClientKey, client);
}

export function useGatewayClient(): WebGatewayClient {
  const client = inject(GatewayClientKey);
  if (!client) {
    throw new Error("Gateway client was not provided on this application");
  }
  return client;
}
