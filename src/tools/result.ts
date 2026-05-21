import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { Leads2bHttpError } from "../client/http.js";

export type ToolSource = {
  api: "v1" | "v2" | "snippet" | "local";
  endpoint?: string;
  stability: "confirmed" | "observed" | "experimental" | "unknown";
};

export type ToolPayload<T> = {
  ok: true;
  data: T;
  summary?: string;
  warnings?: string[];
  source: ToolSource;
};

export type ToolErrorPayload = {
  ok: false;
  error: {
    status?: number;
    code?: string;
    message: string;
    endpoint?: string;
    details?: unknown;
  };
};

export function okResult<T>(payload: ToolPayload<T>): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text: payload.summary ?? JSON.stringify(payload, null, 2)
      }
    ],
    structuredContent: payload as unknown as Record<string, unknown>
  };
}

export function errorResult(error: unknown): CallToolResult {
  const payload = toToolError(error);

  return {
    isError: true,
    content: [
      {
        type: "text",
        text: payload.error.message
      }
    ],
    structuredContent: payload
  };
}

export function toToolError(error: unknown): ToolErrorPayload {
  if (error instanceof Leads2bHttpError) {
    return {
      ok: false,
      error: {
        status: error.status,
        code: "LEADS2B_HTTP_ERROR",
        message: error.message,
        endpoint: error.endpoint,
        details: error.details
      }
    };
  }

  if (error instanceof Error) {
    return {
      ok: false,
      error: {
        code: "MCP_TOOL_ERROR",
        message: error.message,
        details: {
          name: error.name,
          stack: error.stack
        }
      }
    };
  }

  return {
    ok: false,
    error: {
      code: "UNKNOWN_ERROR",
      message: "Erro desconhecido ao executar ferramenta.",
      details: error
    }
  };
}
