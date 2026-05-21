import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Leads2bV2Client } from "../client/v2.js";
import { evaluateWriteGate } from "../safety/write-gates.js";
import { errorResult, okResult } from "./result.js";

type WriteDeps = {
  v2: Leads2bV2Client;
};

const FieldsSchema = z.record(z.string(), z.unknown()).refine((value) => Object.keys(value).length > 0, {
  message: "Informe ao menos um campo em fields."
});

export const WRITE_TOOL_NAMES = ["leads2b_update_customer"];

export function registerWriteTools(server: McpServer, deps: WriteDeps): void {
  server.registerTool(
    "leads2b_update_customer",
    {
      title: "Update customer",
      description:
        "Atualiza um customer pela API v2. Ferramenta de escrita opt-in: dry_run=true por padrão e execução real exige confirm_live=true e reason.",
      inputSchema: {
        id: z.union([z.string().min(1), z.number()]),
        fields: FieldsSchema,
        dry_run: z.boolean().optional(),
        confirm_live: z.boolean().optional(),
        reason: z.string().min(1)
      },
      annotations: {
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
        readOnlyHint: false
      }
    },
    async ({ id, fields, dry_run, confirm_live, reason }) => {
      try {
        const gate = evaluateWriteGate({ dry_run, confirm_live, reason });
        const planned = {
          operation: "update_customer",
          api: "v2",
          method: "PATCH",
          endpoint: `/customer/${id}`,
          id,
          fields,
          reason,
          dryRun: gate.dryRun,
          executed: false,
          warnings: gate.warnings
        };

        if (!gate.canExecute) {
          return okResult({
            ok: true,
            data: planned,
            warnings: gate.warnings,
            summary: "Update customer: dry-run/validação concluída; nenhuma alteração enviada.",
            source: { api: "v2", endpoint: "/customer/{id}", stability: "experimental" }
          });
        }

        const result = await deps.v2.updateCustomer({ id, fields });

        return okResult({
          ok: true,
          data: {
            ...planned,
            dryRun: false,
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
