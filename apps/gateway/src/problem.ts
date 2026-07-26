import { randomUUID } from "node:crypto";
export function problem(
  code: string,
  status: number,
  requestId = randomUUID(),
  details?: Record<string, string | number | boolean>,
) {
  return {
    type: `https://no-pi-no-gang.dev/problems/${code}`,
    title: code,
    status,
    detail: code,
    instance: "gateway",
    code,
    requestId,
    retryable: status >= 500,
    ...(details ? { details } : {}),
  };
}
