import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Leads2bV2Client } from "../client/v2.js";
import type { Leads2bWriteMode } from "../config.js";
import { evaluateWriteOperation } from "../safety/write-gates.js";
import { errorResult, okResult } from "./result.js";

type WriteDeps = {
  v2: Leads2bV2Client;
  writeMode: Leads2bWriteMode;
};

const FieldsSchema = z.record(z.string(), z.unknown()).refine((value) => Object.keys(value).length > 0, {
  message: "Informe ao menos um campo em fields."
});

export const WRITE_TOOL_NAMES = ["leads2b_create_customer", "leads2b_update_customer"];

export function registerWriteTools(server: McpServer, deps: WriteDeps): void {
  server.registerTool(
    "leads2b_create_customer",
    {
      title: "Create customer",
      description:
        "Cria um customer pela API v2. Em preview retorna o plano; em live executa diretamente. Endpoint experimental.",
      inputSchema: {
        fields: FieldsSchema
      },
      annotations: {
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
        readOnlyHint: false
      }
    },
    async ({ fields }) => {
      try {
        const gate = evaluateWriteOperation({
          writeMode: deps.writeMode,
          destructive: false
        });
        const planned = {
          operation: "create_customer",
          api: "v2",
          method: "POST",
          endpoint: "/customer",
          fields,
          mode: gate.mode,
          executed: false,
          warnings: gate.warnings
        };

        if (!gate.shouldExecute) {
          return okResult({
            ok: true,
            data: planned,
            warnings: gate.warnings,
            summary: "Create customer: operação planejada; nenhuma alteração enviada.",
            source: { api: "v2", endpoint: "/customer", stability: "experimental" }
          });
        }

        const result = await deps.v2.createCustomer({ fields });

        return okResult({
          ok: true,
          data: {
            ...planned,
            executed: true,
            result
          },
          summary: "Create customer: criação enviada.",
          source: { api: "v2", endpoint: "/customer", stability: "experimental" }
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "leads2b_update_customer",
    {
      title: "Update customer",
      description:
        "Atualiza um customer pela API v2. Em preview retorna o plano; em live executa diretamente. Endpoint experimental.",
      inputSchema: {
        id: z.union([z.string().min(1), z.number()]),
        fields: FieldsSchema
      },
      annotations: {
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
        readOnlyHint: false
      }
    },
    async ({ id, fields }) => {
      try {
        const gate = evaluateWriteOperation({
          writeMode: deps.writeMode,
          destructive: false
        });
        const planned = {
          operation: "update_customer",
          api: "v2",
          method: "PATCH",
          endpoint: `/customer/${id}`,
          id,
          fields,
          mode: gate.mode,
          executed: false,
          warnings: gate.warnings
        };

        if (!gate.shouldExecute) {
          return okResult({
            ok: true,
            data: planned,
            warnings: gate.warnings,
            summary: "Update customer: operação planejada; nenhuma alteração enviada.",
            source: { api: "v2", endpoint: "/customer/{id}", stability: "experimental" }
          });
        }

        const result = await deps.v2.updateCustomer({ id, fields });

        return okResult({
          ok: true,
          data: {
            ...planned,
            executed: true,
            result
          },
          summary: `Customer ${id}: atualização enviada.`,
          source: { api: "v2", endpoint: "/customer/{id}", stability: "experimental" }
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );
}
