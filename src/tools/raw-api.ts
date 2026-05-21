import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Leads2bHttpMethod } from "../client/http.js";
import type { Leads2bV1Client } from "../client/v1.js";
import type { Leads2bV2Client } from "../client/v2.js";
import type { Leads2bWriteMode } from "../config.js";
import { evaluateWriteOperation, isDestructiveOperation } from "../safety/write-gates.js";
import { errorResult, okResult } from "./result.js";

type RawApiDeps = {
  v1: Leads2bV1Client;
  v2: Leads2bV2Client;
  writeMode: Leads2bWriteMode;
};

const MethodSchema = z.enum(["GET", "OPTIONS", "POST", "PUT", "PATCH", "DELETE"]);
const QueryValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.union([z.string(), z.number(), z.boolean()]))
]);
const QuerySchema = z.record(z.string(), QueryValueSchema);
const PathSchema = z.string().min(1).refine((value) => value.startsWith("/") && !value.startsWith("//"), {
  message: "path deve começar com uma única barra, por exemplo /customer."
});

export const RAW_API_TOOL_NAME = "leads2b_api_request";

export function registerRawApiTool(server: McpServer, deps: RawApiDeps): void {
  server.registerTool(
    RAW_API_TOOL_NAME,
    {
      title: "Leads2b API request",
      description:
        "Executa uma chamada avançada nas APIs v1/v2. GET/OPTIONS executam direto; POST/PUT/PATCH/DELETE respeitam LEADS2B_WRITE_MODE.",
      inputSchema: {
        api: z.enum(["v1", "v2"]),
        method: MethodSchema,
        path: PathSchema,
        query: QuerySchema.optional(),
        body: z.unknown().optional(),
        confirm_destructive: z.boolean().optional()
      },
      annotations: {
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
        readOnlyHint: false
      }
    },
    async ({ api, method, path, query, body, confirm_destructive }) => {
      try {
        const normalizedMethod = method as Leads2bHttpMethod;
        const readOnly = normalizedMethod === "GET" || normalizedMethod === "OPTIONS";
        const destructive = isDestructiveOperation(normalizedMethod, path);
        const gate = readOnly
          ? {
              mode: deps.writeMode,
              shouldExecute: true,
              executed: false,
              warnings: [] as string[]
            }
          : evaluateWriteOperation({
              writeMode: deps.writeMode,
              destructive,
              confirmDestructive: confirm_destructive
            });
        const planned = {
          api,
          mode: gate.mode,
          method: normalizedMethod,
          endpoint: path,
          query,
          body,
          destructive,
          executed: false,
          warnings: gate.warnings
        };

        if (!gate.shouldExecute) {
          return okResult({
            ok: true,
            data: planned,
            warnings: gate.warnings,
            summary: "API request: operação planejada; nenhuma alteração enviada.",
            source: { api, endpoint: path, stability: "unknown" }
          });
        }

        const client = api === "v1" ? deps.v1 : deps.v2;
        const result = await client.rawRequest({
          method: normalizedMethod,
          path,
          query,
          body
        });

        return okResult({
          ok: true,
          data: {
            ...planned,
            executed: true,
            result
          },
          summary: `API request: ${normalizedMethod} ${path} executado.`,
          source: { api, endpoint: path, stability: "unknown" }
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );
}
