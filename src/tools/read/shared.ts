import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Leads2bV1Client } from "../../client/v1.js";
import { Leads2bV2Client } from "../../client/v2.js";
import { errorResult, okResult, ToolSource } from "../result.js";

export type ReadDeps = {
  v1: Leads2bV1Client;
  v2: Leads2bV2Client;
};

export const EntitySchema = z.enum(["LEAD", "CONTACT", "OPPORTUNITY"]);
export const IdSchema = z.union([z.string().min(1), z.number()]);
export const PipelineEntitySchema = z.enum(["LEAD", "OPPORTUNITY"]);
export const LossEntitySchema = z.enum(["OPPORTUNITY"]);
export const SegmentationEntitySchema = z.enum(["CUSTOMER", "LEAD", "OPPORTUNITY"]);

export function registerSimpleReadTool(
  server: McpServer,
  input: {
    name: string;
    title: string;
    description: string;
    source: ToolSource;
    handler: () => Promise<unknown>;
  }
): void {
  server.registerTool(
    input.name,
    {
      title: input.title,
      description: input.description,
      annotations: {
        readOnlyHint: true
      }
    },
    async () => {
      try {
        const data = await input.handler();
        return okResult({
          ok: true,
          data,
          summary: `${input.title}: consulta concluída.`,
          source: input.source
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );
}

export function sortApiEvents(response: unknown): unknown {
  if (Array.isArray(response)) {
    return sortEventsArray(response);
  }

  if (response && typeof response === "object" && Array.isArray((response as { data?: unknown }).data)) {
    return {
      ...(response as Record<string, unknown>),
      data: sortEventsArray((response as { data: unknown[] }).data)
    };
  }

  return response;
}

function sortEventsArray(events: unknown[]): unknown[] {
  return [...events].sort((a, b) => {
    const aTime = eventTimestamp(a);
    const bTime = eventTimestamp(b);
    return aTime - bTime;
  });
}

function eventTimestamp(event: unknown): number {
  if (!event || typeof event !== "object") {
    return Number.POSITIVE_INFINITY;
  }

  const record = event as Record<string, unknown>;
  const value = record.created_at ?? record.message_date_sql;

  if (typeof value !== "string" && typeof value !== "number") {
    return Number.POSITIVE_INFINITY;
  }

  const timestamp = Date.parse(String(value));
  return Number.isNaN(timestamp) ? Number.POSITIVE_INFINITY : timestamp;
}
