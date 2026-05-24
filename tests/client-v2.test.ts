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

  it("calls the observed deals endpoint with entity, pagination and search", async () => {
    const calls: Array<{ path: string; query?: Record<string, unknown> }> = [];
    const http = {
      get: async (path: string, options?: { query?: Record<string, unknown> }) => {
        calls.push({ path, query: options?.query });
        return { data: [], total: 0, entity: "OPPORTUNITY" };
      }
    } as unknown as Leads2bHttpClient;
    const client = new Leads2bV2Client(http);

    await client.listDeals({
      entity: "OPPORTUNITY",
      limit: 50,
      offset: 10,
      search: "lead@example.com"
    });

    expect(calls).toEqual([
      {
        path: "/deals",
        query: {
          entity: "OPPORTUNITY",
          limit: 50,
          offset: 10,
          search: "lead@example.com"
        }
      }
    ]);
  });

  it("calls observed v2 account metadata endpoints", async () => {
    const calls: string[] = [];
    const http = {
      get: async (path: string) => {
        calls.push(path);
        return { data: [] };
      }
    } as unknown as Leads2bHttpClient;
    const client = new Leads2bV2Client(http);

    await client.listCnaes();
    await client.listMailAccounts();
    await client.listCompanyFeedbacks();
    await client.getCompanyEvents();
    await client.listSegmentations({ entity: "CUSTOMER", limit: 20, offset: 0 });

    expect(calls).toEqual([
      "/markets/cnaes/all",
      "/mail/accounts",
      "/feedbacks/company",
      "/companies/event",
      "/segmentations"
    ]);
  });

  it("calls the observed segmentations endpoint", async () => {
    const calls: Array<{ path: string; query?: Record<string, unknown> }> = [];
    const http = {
      get: async (path: string, options?: { query?: Record<string, unknown> }) => {
        calls.push({ path, query: options?.query });
        return { data: [], statistics: {} };
      }
    } as unknown as Leads2bHttpClient;
    const client = new Leads2bV2Client(http);

    await client.listSegmentations({ entity: "OPPORTUNITY", limit: 20, offset: 0 });

    expect(calls).toEqual([
      {
        path: "/segmentations",
        query: {
          entity: "OPPORTUNITY",
          limit: 20,
          offset: 0
        }
      }
    ]);
  });

  it("calls the experimental customer update endpoint", async () => {
    const calls: Array<{ path: string; body?: unknown }> = [];
    const http = {
      patch: async (path: string, options?: { body?: unknown }) => {
        calls.push({ path, body: options?.body });
        return { data: { id: 123 } };
      }
    } as unknown as Leads2bHttpClient;
    const client = new Leads2bV2Client(http);

    await client.updateCustomer({
      id: 123,
      fields: {
        name: "Example"
      }
    });

    expect(calls).toEqual([
      {
        path: "/customer/123",
        body: {
          name: "Example"
        }
      }
    ]);
  });

  it("calls the experimental customer create endpoint", async () => {
    const calls: Array<{ path: string; body?: unknown }> = [];
    const http = {
      post: async (path: string, options?: { body?: unknown }) => {
        calls.push({ path, body: options?.body });
        return { data: { id: 456 } };
      }
    } as unknown as Leads2bHttpClient;
    const client = new Leads2bV2Client(http);

    await client.createCustomer({
      fields: {
        name: "Example",
        email: "lead@example.com"
      }
    });

    expect(calls).toEqual([
      {
        path: "/customer",
        body: {
          name: "Example",
          email: "lead@example.com"
        }
      }
    ]);
  });

  it("passes raw API requests through the v2 HTTP client", async () => {
    const calls: Array<{ method: string; path: string; query?: Record<string, unknown>; body?: unknown }> = [];
    const http = {
      request: async (method: string, path: string, options?: { query?: Record<string, unknown>; body?: unknown }) => {
        calls.push({ method, path, query: options?.query, body: options?.body });
        return { data: [] };
      }
    } as unknown as Leads2bHttpClient;
    const client = new Leads2bV2Client(http);

    await client.rawRequest({
      method: "GET",
      path: "/customer",
      query: {
        search: "lead@example.com"
      }
    });

    expect(calls).toEqual([
      {
        method: "GET",
        path: "/customer",
        query: {
          search: "lead@example.com"
        },
        body: undefined
      }
    ]);
  });

  it("calls the observed calendar events endpoint with array filters", async () => {
    const calls: Array<{ path: string; query?: Record<string, unknown> }> = [];
    const http = {
      get: async (path: string, options?: { query?: Record<string, unknown> }) => {
        calls.push({ path, query: options?.query });
        return { data: [], statistics: {} };
      }
    } as unknown as Leads2bHttpClient;
    const client = new Leads2bV2Client(http);

    await client.listCalendarEvents({
      userIds: [10],
      calendars: ["leads2b"],
      types: ["action", "meet"],
      start: "2026-04-26T03:00:00.000Z",
      end: "2026-06-07T03:00:00.000Z",
      limit: 200,
      offset: 0
    });

    expect(calls).toEqual([
      {
        path: "/mail/calendars/events",
        query: {
          "users[]": [10],
          "calendars[]": ["leads2b"],
          "types[]": ["action", "meet"],
          start: "2026-04-26T03:00:00.000Z",
          end: "2026-06-07T03:00:00.000Z",
          limit: 200,
          offset: 0
        }
      }
    ]);
  });
});
