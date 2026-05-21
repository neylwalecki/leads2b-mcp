import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Leads2bEntity } from "../../attribution/normalize.js";
import { errorResult, okResult } from "../result.js";
import { EntitySchema, IdSchema, ReadDeps, sortApiEvents } from "./shared.js";

export function registerEventTools(server: McpServer, deps: ReadDeps): void {
  server.registerTool(
    "leads2b_get_conversions",
    {
      title: "Get conversions",
      description: "Consulta conversões por id e entity. Não aceita busca por e-mail no MVP.",
      inputSchema: {
        id: IdSchema,
        entity: EntitySchema
      },
      annotations: {
        readOnlyHint: true
      }
    },
    async ({ id, entity }) => {
      try {
        const data = sortApiEvents(await deps.v2.getConversions({ id, entity: entity as Leads2bEntity }));
        return okResult({
          ok: true,
          data,
          summary: `Conversões consultadas para ${entity} ${id}.`,
          source: { api: "v2", endpoint: "/conversions", stability: "confirmed" }
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "leads2b_get_tracking",
    {
      title: "Get tracking",
      description: "Consulta tracking por id e entity. Não aceita busca por e-mail no MVP.",
      inputSchema: {
        id: IdSchema,
        entity: EntitySchema
      },
      annotations: {
        readOnlyHint: true
      }
    },
    async ({ id, entity }) => {
      try {
        const data = sortApiEvents(await deps.v2.getTracking({ id, entity: entity as Leads2bEntity }));
        return okResult({
          ok: true,
          data,
          summary: `Tracking consultado para ${entity} ${id}.`,
          source: { api: "v2", endpoint: "/conversions/tracking", stability: "confirmed" }
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );
}
