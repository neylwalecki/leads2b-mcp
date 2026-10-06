import { expect, it, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerCustomerTools } from "../src/tools/read/customers.js";

function setup(response: unknown) {
  const handlers = new Map<string, (input: any) => Promise<any>>();
  const searchCustomers = vi.fn().mockResolvedValue(response);
  registerCustomerTools({ registerTool: (name: string, _config: any, call: any) => handlers.set(name, call) } as unknown as McpServer, { v1: {}, v2: { searchCustomers } } as never);
  return { call: handlers.get("leads2b_search_customers")!, searchCustomers };
}
const rows = Array.from({ length: 30 }, (_, id) => ({ id, name: "Example", custom_fields: { source: "Original" } }));
it("bounds output by default while declaring local slicing and unknown collection coverage", async () => {
  const { call, searchCustomers } = setup({ data: rows, total: 40 });
  const data = (await call({ search: "a" })).structuredContent.data;
  expect(data.customers).toEqual(rows.slice(0, 25));
  expect(data.coverage).toMatchObject({ fetched: 30, returned: 25, outputTruncated: true, nativePagination: "unverified", collection: "unknown", transferLimited: false, nextOffset: 25 });
  expect(searchCustomers).toHaveBeenCalledExactlyOnceWith({ search: "a" });
});
it("supports local offsets without discarding fields", async () => {
  const { call } = setup({ data: { customers: rows } });
  const data = (await call({ search: "a", offset: 28, limit: 2 })).structuredContent.data;
  expect(data.customers).toEqual(rows.slice(28));
  expect(data.coverage).toMatchObject({ fetched: 30, returned: 2, outputTruncated: true, nextOffset: null });
});
it("offers the exact original response explicitly", async () => {
  const response = { data: rows, meta: { unknown: true } };
  const { call } = setup(response);
  expect((await call({ search: "a", returnAll: true })).structuredContent.data).toMatchObject({ response, coverage: { returned: 30, outputTruncated: false } });
});
it("does not turn an unknown envelope into zero customers", async () => {
  const { call } = setup({ data: { unexpected: rows } });
  const result = await call({ search: "a" });
  expect(result.isError).toBe(true);
  expect(result.structuredContent.error.message).toContain("returnAll");
});
