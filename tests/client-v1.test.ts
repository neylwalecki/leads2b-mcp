import { describe, expect, it } from "vitest";
import { Leads2bV1Client } from "../src/client/v1.js";
import { Leads2bHttpClient } from "../src/client/http.js";

describe("Leads2bV1Client", () => {
  it("calls the confirmed customer index endpoint", async () => {
    const calls: string[] = [];
    const http = {
      get: async (path: string) => {
        calls.push(path);
        return { data: { customers: [] } };
      }
    } as unknown as Leads2bHttpClient;
    const client = new Leads2bV1Client(http);

    await client.listCustomers();

    expect(calls).toEqual(["/customer/index"]);
  });

  it("calls the observed default lead detail endpoint", async () => {
    const calls: string[] = [];
    const http = {
      get: async (path: string) => {
        calls.push(path);
        return { data: { lead: {} } };
      }
    } as unknown as Leads2bHttpClient;
    const client = new Leads2bV1Client(http);

    await client.getDefaultLead({ id: 123 });

    expect(calls).toEqual(["/lead/index/123/defaultLead"]);
  });
});
