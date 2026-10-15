import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { toToolError } from "../result.js";

type ReadRequest = {
  api: "v1";
  method: "GET";
  endpoint: string;
  entity: "LEAD" | "OPPORTUNITY";
  id: string | number;
  limit?: number;
  offset?: number;
};

// Preserve the upstream failure. Diagnosis must not retry with a different token,
// entity or ID, or replace a missing detail with a row from a list window.
export function readErrorResult(error: unknown, request: ReadRequest): CallToolResult {
  const failure = toToolError(error);
  const warnings = [
    "Falha de leitura não comprova ausência do registro, histórico vazio ou estado comercial."
  ];
  if (failure.error.status === 400 || failure.error.status === 500) {
    warnings.push(
      "HTTP 400/500 em endpoints internos pode depender do contexto de usuário v1. Consulte leads2b_health_check e apis.v1.userContext; este erro não confirma a causa. Tokens não são trocados automaticamente."
    );
  }
  const payload = {
    ...failure,
    readState: {
      outcome: "unavailable",
      request,
      coverage: { status: "unknown", reason: "request_failed" },
      userContext: "unverified"
    },
    warnings
  };
  return {
    isError: true,
    content: [{ type: "text", text: [failure.error.message, ...warnings].join("\n") }],
    structuredContent: payload
  };
}
