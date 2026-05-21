import { Leads2bEntity } from "../attribution/normalize.js";
import { Leads2bHttpClient } from "./http.js";

export class Leads2bV2Client {
  constructor(private readonly http: Leads2bHttpClient) {}

  hasToken(): boolean {
    return this.http.hasToken();
  }

  listUsers(): Promise<unknown> {
    return this.http.get("/users");
  }

  listWebhooks(): Promise<unknown> {
    return this.http.get("/webhooks");
  }

  getSnippetConfig(): Promise<unknown> {
    return this.http.get("/integrations/config/token");
  }

  getSnippetScript(): Promise<unknown> {
    return this.http.get("/integrations/config/script");
  }

  searchCustomers(input: { search: string }): Promise<unknown> {
    return this.http.get("/customer", {
      query: {
        search: input.search
      }
    });
  }

  getCustomer(input: { id: string | number }): Promise<unknown> {
    return this.http.get(`/customer/${input.id}`);
  }

  getConversions(input: { id: string | number; entity: Leads2bEntity }): Promise<unknown> {
    return this.http.get("/conversions", {
      query: {
        id: input.id,
        entity: input.entity
      }
    });
  }

  getTracking(input: { id: string | number; entity: Leads2bEntity }): Promise<unknown> {
    return this.http.get("/conversions/tracking", {
      query: {
        id: input.id,
        entity: input.entity
      }
    });
  }
}
