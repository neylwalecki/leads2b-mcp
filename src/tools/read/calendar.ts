import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { errorResult, okResult } from "../result.js";
import { IdSchema, ReadDeps } from "./shared.js";

export function registerCalendarTools(server: McpServer, deps: ReadDeps): void {
  server.registerTool(
    "leads2b_list_calendar_events",
    {
      title: "List calendar events",
      description: "Lista eventos de calendário da Leads2b pela API v2.",
      inputSchema: {
        start: z.string().min(1),
        end: z.string().min(1),
        userIds: z.array(IdSchema).optional(),
        calendars: z.array(z.string().min(1)).optional(),
        types: z.array(z.string().min(1)).optional(),
        limit: z.number().int().min(1).max(500).optional(),
        offset: z.number().int().min(0).optional()
      },
      annotations: {
        readOnlyHint: true
      }
    },
    async ({ start, end, userIds, calendars = ["leads2b"], types = ["action", "meet"], limit = 200, offset = 0 }) => {
      try {
        const data = await deps.v2.listCalendarEvents({
          userIds,
          calendars,
          types,
          start,
          end,
          limit,
          offset
        });
        return okResult({
          ok: true,
          data,
          summary: "Eventos de calendário consultados.",
          source: { api: "v2", endpoint: "/mail/calendars/events", stability: "observed" }
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );
}
