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

  it("calls the observed dashboard count endpoints", async () => {
    const calls: string[] = [];
    const http = {
      get: async (path: string) => {
        calls.push(path);
        return { result: "0" };
      }
    } as unknown as Leads2bHttpClient;
    const client = new Leads2bV1Client(http);

    await client.getDashboardCounts();

    expect(calls).toEqual([
      "/dashboard/lead_count/",
      "/dashboard/opportunity_count/",
      "/dashboard/won_opportunity_count/",
      "/dashboard/hot_opportunity_count/",
      "/dashboard/after_sales_count/"
    ]);
  });

  it("calls observed v1 metadata endpoints", async () => {
    const calls: string[] = [];
    const http = {
      get: async (path: string) => {
        calls.push(path);
        return {};
      }
    } as unknown as Leads2bHttpClient;
    const client = new Leads2bV1Client(http);

    await client.listPipelinesByEntity({ entity: "LEAD" });
    await client.listUsersByAccessLevel();
    await client.listLossReasons({ entity: "OPPORTUNITY" });
    await client.listTags();
    await client.listChromeExtensionUsers();
    await client.listActions();
    await client.searchCampaigns({ search: "codex" });
    await client.searchFlows();
    await client.countDeals({ pipelineId: 3, status: "lost" });
    await client.getEntityColumns({ entity: "CONTACT", withDeleted: false, onlyCount: false });
    await client.listCustomerTypes();
    await client.getReceitaByCnpj({ cnpj: "00111222000133" });

    expect(calls).toEqual([
      "/pipeline/byEntity/LEAD",
      "/user/users_by_access_level",
      "/loss/index/opportunity",
      "/tag/index/",
      "/chrome_extension/users",
      "/action/list/",
      "/campaign/search",
      "/flow/search",
      "/deal/count_deals",
      "/custom_column/entity_columns/CONTACT/",
      "/customer_type",
      "/receita/index/00111222000133"
    ]);
  });

  it("calls the observed campaign search endpoint with datatables query keys", async () => {
    const calls: Array<{ path: string; query?: Record<string, unknown> }> = [];
    const http = {
      get: async (path: string, options?: { query?: Record<string, unknown> }) => {
        calls.push({ path, query: options?.query });
        return { data: [] };
      }
    } as unknown as Leads2bHttpClient;
    const client = new Leads2bV1Client(http);

    await client.searchCampaigns({ search: "codex", draw: 2 });

    expect(calls).toEqual([
      {
        path: "/campaign/search",
        query: {
          draw: 2,
          "search[value]": "codex",
          "search[regex]": false
        }
      }
    ]);
  });

  it("calls observed flow search and deal count endpoints with compact query keys", async () => {
    const calls: Array<{ path: string; query?: Record<string, unknown> }> = [];
    const http = {
      get: async (path: string, options?: { query?: Record<string, unknown> }) => {
        calls.push({ path, query: options?.query });
        return { data: [] };
      }
    } as unknown as Leads2bHttpClient;
    const client = new Leads2bV1Client(http);

    await client.searchFlows({ draw: 3, search: "codex" });
    await client.countDeals({ pipelineId: 3, status: "lost", search: "codex" });

    expect(calls).toEqual([
      {
        path: "/flow/search",
        query: {
          draw: 3,
          "search[value]": "codex",
          "search[regex]": false
        }
      },
      {
        path: "/deal/count_deals",
        query: {
          pipelineId: 3,
          status: "lost",
          search: "codex"
        }
      }
    ]);
  });

  it("calls observed entity columns and customer type endpoints", async () => {
    const calls: Array<{ path: string; query?: Record<string, unknown> }> = [];
    const http = {
      get: async (path: string, options?: { query?: Record<string, unknown> }) => {
        calls.push({ path, query: options?.query });
        return { data: {} };
      }
    } as unknown as Leads2bHttpClient;
    const client = new Leads2bV1Client(http);

    await client.getEntityColumns({ entity: "OPPORTUNITY", withDeleted: true, onlyCount: false });
    await client.listCustomerTypes();

    expect(calls).toEqual([
      {
        path: "/custom_column/entity_columns/OPPORTUNITY/",
        query: {
          with_deleted: true,
          only_count: false
        }
      },
      {
        path: "/customer_type",
        query: undefined
      }
    ]);
  });

  it("calls the observed receita endpoint by CNPJ", async () => {
    const calls: string[] = [];
    const http = {
      get: async (path: string) => {
        calls.push(path);
        return { data: {} };
      }
    } as unknown as Leads2bHttpClient;
    const client = new Leads2bV1Client(http);

    await client.getReceitaByCnpj({ cnpj: "00.111.222/0001-33" });

    expect(calls).toEqual(["/receita/index/00111222000133"]);
  });

  it("passes raw API requests through the v1 HTTP client", async () => {
    const calls: Array<{ method: string; path: string; query?: Record<string, unknown>; body?: unknown }> = [];
    const http = {
      request: async (method: string, path: string, options?: { query?: Record<string, unknown>; body?: unknown }) => {
        calls.push({ method, path, query: options?.query, body: options?.body });
        return { data: [] };
      }
    } as unknown as Leads2bHttpClient;
    const client = new Leads2bV1Client(http);

    await client.rawRequest({
      method: "OPTIONS",
      path: "/external_resources/create_lead"
    });

    expect(calls).toEqual([
      {
        method: "OPTIONS",
        path: "/external_resources/create_lead",
        query: undefined,
        body: undefined
      }
    ]);
  });
});
