import { expect, it } from "vitest";
import { registerLeadOpsTools } from "../src/tools/read/lead-ops.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

it("reads exact IDs and unwraps native v1 detail envelopes without a list window", async () => {
  const handlers = new Map<string, (input: any) => Promise<any>>();
  const deps = {
    v1: {
      getDefaultLead: async () => ({ data: { lead: { id: "601", name: "Example", parameters: '{"deal_name":"Example title"}' } } }),
      getContact: async () => ({ data: { id: "602", name: "Example", email: "lead@example.com" } }),
      getOpportunity: async () => ({ opportunity_data: [{ id: "603", contact_name: "Example", contact_email: "lead@example.com", customer_name: "Example Co", name_user: "Example User", total_value: "20.50", opportunity_date: "2026-09-08 12:00:00", parameters: '{"op_name":"Example title"}' }] })
    }, v2: {}
  };
  registerLeadOpsTools({ registerTool: (name: string, _config: any, call: any) => handlers.set(name, call) } as unknown as McpServer, deps as never);
  for (const [entity, id] of [["LEAD", 601], ["CONTACT", 602], ["OPPORTUNITY", 603]]) {
    const result = await handlers.get("leads2b_get_record_detail")!({ entity, id, includeAttribution: false, includeRaw: true });
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent.data.detail.technicalId).toBe(`${entity}:${id}`);
    expect(result.structuredContent.data.detail.basic.name).toBe("Example");
    if (entity === "OPPORTUNITY") {
      expect(result.structuredContent.data.detail.commercial.value).toBe(20.5);
      expect(result.structuredContent.data.detail.customFields.parameters.op_name).toBe("Example title");
    }
  }
});
