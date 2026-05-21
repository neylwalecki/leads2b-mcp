import { describe, expect, it } from "vitest";
import { Leads2bHttpClient } from "../src/client/http.js";
import { Leads2bV2Client } from "../src/client/v2.js";

describe("Leads2bV2Client", () => {
  it("calls the observed customer search endpoint", async () => {
    const calls: Array<{ path: string; query?: Record<string, unknown> }> = [];
    const http = {
      get: async (path: string, options?: { query?: Record<string, unknown> }) => {
        calls.push({ path, query: options?.query });
        return { data: [], total: 0 };
      }
    } as unknown as Leads2bHttpClient;
    const client = new Leads2bV2Client(http);

    await client.searchCustomers({ search: "lead@example.com" });

    expect(calls).toEqual([
      {
        path: "/customer",
        query: {
          search: "lead@example.com"
        }
      }
    ]);
  });

  it("calls the observed customer detail endpoint", async () => {
    const calls: string[] = [];
    const http = {
      get: async (path: string) => {
        calls.push(path);
        return { data: { id: 123 } };
      }
    } as unknown as Leads2bHttpClient;
    const client = new Leads2bV2Client(http);

    await client.getCustomer({ id: 123 });

    expect(calls).toEqual(["/customer/123"]);
  });
});
