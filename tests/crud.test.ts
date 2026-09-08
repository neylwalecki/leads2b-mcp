import { describe, expect, it, vi } from "vitest";
import { Leads2bV1Client } from "../src/client/v1.js";
import { registerWriteTools, WRITE_TOOL_NAMES } from "../src/tools/write.js";
import { CustomerCreateSchema, ContactCreateSchema, LeadCreateSchema } from "../src/crud/schemas.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Leads2bWriteMode } from "../src/config.js";

function setup(mode: Leads2bWriteMode) {
  const request = vi.fn().mockResolvedValue({ data: { id: 123 } });
  const v1 = { rawRequest: request, getLoggedUser: vi.fn().mockResolvedValue({ data: { user: { id: 7 } } }) };
  const handlers = new Map<string, { config: any; call: (input: any) => Promise<any> }>();
  registerWriteTools({ registerTool: (name: string, config: any, call: any) => handlers.set(name, { config, call }) } as unknown as McpServer, { v1, writeMode: mode });
  return { request, handlers };
}
const routes = [
  ["customer", "/customer/index", "/customer/index/123"],
  ["lead", "/lead", "/deal/index"],
  ["contact", "/customer/contact", "/customer/contact/123"],
  ["opportunity", "/opportunity/index/", "/deal/index"]
] as const;

describe("entity CRUD contracts", () => {
  it("registers no writes when disabled, even if called directly", () => {
    expect(setup("disabled").handlers.size).toBe(0);
  });
  it("publishes twelve operations", () => expect(WRITE_TOOL_NAMES).toHaveLength(12));
  for (const [entity, create, update] of routes) {
    it(`${entity}: previews exact payload without requests and sends simple writes once`, async () => {
      const preview = setup("preview");
      const fields = entity === "contact" ? { name: "Example", id_customer: 10 } : entity === "customer"
        ? { name: "Example", type: "ORGANIZATION" } : { name_contact: "Example", id_pipeline: 10, id_pipeline_item: 11, id_user: 12 };
      const response = await preview.handlers.get(`leads2b_create_${entity}`)!.call({ fields });
      expect(response.structuredContent.data).toMatchObject({ executed: false, api: "v1", endpoint: create, fields });
      expect(preview.request).not.toHaveBeenCalled();
      const live = setup("live");
      await live.handlers.get(`leads2b_create_${entity}`)!.call({ fields });
      expect(live.request).toHaveBeenCalledExactlyOnceWith({ method: "POST", path: create, body: fields });
      live.request.mockClear();
      const updateFields = entity === "opportunity" ? { description: "Example" } : { name: "Example" };
      await live.handlers.get(`leads2b_update_${entity}`)!.call({ id: 123, fields: updateFields });
      const body = entity === "lead" || entity === "opportunity" ? { deal: { id: 123, type: entity.toUpperCase() }, edit_data: updateFields } : updateFields;
      expect(live.request).toHaveBeenCalledExactlyOnceWith({ method: "PUT", path: update, body });
    });
    it(`${entity}: requires deletion confirmation and keeps readback unverified`, async () => {
      const live = setup("live");
      const tool = live.handlers.get(`leads2b_delete_${entity}`)!;
      expect(tool.config.annotations.destructiveHint).toBe(true);
      await tool.call({ id: 123 });
      expect(live.request).not.toHaveBeenCalled();
      const response = await tool.call({ id: 123, confirm_destructive: true });
      const path = entity === "lead" ? "/lead/index/123" : entity === "opportunity" ? "/opportunity/index/123" : update;
      expect(live.request).toHaveBeenCalledExactlyOnceWith({ method: "DELETE", path, body: undefined });
      expect(response.structuredContent.data).toMatchObject({ executed: true, readback: { status: "not_performed" } });
    });
  }
  it("rejects empty, unknown fields and invalid entity identities before network", () => {
    expect(CustomerCreateSchema.safeParse({ name: "Example" }).success).toBe(false);
    expect(ContactCreateSchema.safeParse({ name: "Example" }).success).toBe(false);
    expect(LeadCreateSchema.safeParse({ name_contact: "Example", id_pipeline: "../1", id_pipeline_item: 2, id_user: 3 }).success).toBe(false);
    expect(CustomerCreateSchema.safeParse({ name: "Example", type: "PERSON", unknown: true }).success).toBe(false);
  });
  it("rejects API business failure in a 200 response", async () => {
    const live = setup("live");
    live.request.mockResolvedValueOnce({ data: "contact_already_exists" } as never);
    const response = await live.handlers.get("leads2b_create_contact")!.call({ fields: { name: "Example", id_customer: 10 } });
    expect(response.isError).toBe(true);
    expect(response.structuredContent.data.executed).toBe(true);
  });
});

it("stops deal mutations before POST when v1 has no user context", async () => {
  const request = vi.fn();
  const handlers = new Map<string, (input: any) => Promise<any>>();
  const v1 = { rawRequest: request, getLoggedUser: vi.fn().mockResolvedValue({ data: { user: [] } }) };
  registerWriteTools({ registerTool: (name: string, _config: any, call: any) => handlers.set(name, call) } as unknown as McpServer, { v1, writeMode: "live" });
  const result = await handlers.get("leads2b_create_lead")!({ fields: { name_contact: "Example", id_pipeline: 1, id_pipeline_item: 2, id_user: 3 } });
  expect(result.isError).toBe(true);
  expect(result.structuredContent.error.code).toBe("LEADS2B_USER_CONTEXT_REQUIRED");
  expect(request).not.toHaveBeenCalled();
});

it("maps lead create email/phone aliases and preserves explicit contact fields", async () => {
  const live = setup("live");
  const fields = { name_contact: "Example", id_pipeline: 1, id_pipeline_item: 2, id_user: 3, email: "lead@example.com", phone: "554100000000" };
  await live.handlers.get("leads2b_create_lead")!.call({ fields });
  expect(live.request).toHaveBeenCalledWith({ method: "POST", path: "/lead", body: { ...fields, email_contact: fields.email, phone_contact: fields.phone } });
});

it("rereads an update after HTTP 500 and reports matching state without pretending the request succeeded", async () => {
  const live = setup("live");
  const { Leads2bHttpError } = await import("../src/client/http.js");
  live.request.mockRejectedValueOnce(new Leads2bHttpError({ status: 500, endpoint: "/deal/index", message: "HTTP 500" }))
    .mockResolvedValueOnce({ opportunity_data: [{ id: "123", parameters: '{"op_name":"Example"}' }] } as never);
  const result = await live.handlers.get("leads2b_update_opportunity")!.call({ id: 123, fields: { parameters: { op_name: "Example" } } });
  expect(result.isError).toBe(true);
  expect(result.structuredContent.writeState).toMatchObject({ requestSent: true, outcome: "unknown", automaticRetry: false });
  expect(result.structuredContent.readback).toMatchObject({ status: "fetched", requestedFieldsMatch: true });
  expect(live.request).toHaveBeenNthCalledWith(2, { method: "GET", path: "/opportunity/index/123" });
});
