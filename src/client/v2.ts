import { Leads2bEntity } from "../attribution/normalize.js";
import { Leads2bHttpClient, Leads2bHttpMethod, Leads2bRequestOptions } from "./http.js";

export type Leads2bSegmentationEntity = "CUSTOMER" | "LEAD" | "OPPORTUNITY";
export type Leads2bRawRequestInput = {
  method: Leads2bHttpMethod;
  path: string;
  query?: Leads2bRequestOptions["query"];
  body?: unknown;
};

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

  updateCustomer(input: { id: string | number; fields: Record<string, unknown> }): Promise<unknown> {
    return this.http.patch(`/customer/${input.id}`, {
      body: input.fields
    });
  }

  createCustomer(input: { fields: Record<string, unknown> }): Promise<unknown> {
    return this.http.post("/customer", {
      body: input.fields
    });
  }

  listCnaes(): Promise<unknown> {
    return this.http.get("/markets/cnaes/all");
  }

  listMailAccounts(): Promise<unknown> {
    return this.http.get("/mail/accounts");
  }

  listCompanyFeedbacks(): Promise<unknown> {
    return this.http.get("/feedbacks/company");
  }

  getCompanyEvents(): Promise<unknown> {
    return this.http.get("/companies/event");
  }

  listSegmentations(input: { entity: Leads2bSegmentationEntity; limit?: number; offset?: number }): Promise<unknown> {
    return this.http.get("/segmentations", {
      query: {
        entity: input.entity,
        limit: input.limit,
        offset: input.offset
      }
    });
  }

  listCalendarEvents(input: {
    userIds?: Array<string | number>;
    calendars?: string[];
    types?: string[];
    start: string;
    end: string;
    limit?: number;
    offset?: number;
  }): Promise<unknown> {
    return this.http.get("/mail/calendars/events", {
      query: {
        "users[]": input.userIds,
        "calendars[]": input.calendars,
        "types[]": input.types,
        start: input.start,
        end: input.end,
        limit: input.limit,
        offset: input.offset
      }
    });
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

  rawRequest(input: Leads2bRawRequestInput): Promise<unknown> {
    return this.http.request(input.method, input.path, {
      query: input.query,
      body: input.body
    });
  }
}
