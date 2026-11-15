import { scanDeals, type DealScanInput } from "./deals.js";
import { Leads2bEntity } from "../attribution/normalize.js";
import { Leads2bHttpClient, Leads2bHttpMethod, Leads2bRequestOptions } from "./http.js";

export type Leads2bSegmentationEntity = "CUSTOMER" | "LEAD" | "OPPORTUNITY" | "COMPANIES";
export type Leads2bDealEntity = "LEAD" | "OPPORTUNITY";
export type Leads2bChatEntity = "opportunity";
export type Leads2bChatOrder = "asc" | "desc";
export type Leads2bRawRequestInput = {
  method: Leads2bHttpMethod;
  path: string;
  query?: Leads2bRequestOptions["query"];
  body?: unknown;
};

export const CHAT_USERS_ENDPOINT = "/messages/chats/users";

export function chatUsersRequest(situation: "open" | "closed") {
  return { path: CHAT_USERS_ENDPOINT, query: { situation, order: "desc" } };
}

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

  listDeals(input: {
    entity: Leads2bDealEntity;
    limit?: number;
    offset?: number;
    search?: string;
  }): Promise<unknown> {
    return this.http.get("/deals", {
      query: {
        entity: input.entity,
        limit: input.limit,
        offset: input.offset,
        search: input.search
      }
    });
  }

  scanDeals(input: DealScanInput) {
    return scanDeals(this, input);
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

  /**
   * Internal V2 endpoint observed by the Leads2b application. Keep this
   * wrapper narrow: chat records are scoped by the entity ID supplied by the
   * caller and are never joined locally by phone number.
   */
  listChats(input: {
    idEntity: string | number;
    entity?: Leads2bChatEntity;
    order?: Leads2bChatOrder;
    situation?: string;
    limit?: number;
    offset?: number;
  }): Promise<unknown> {
    return this.http.get("/messages/chats", {
      query: {
        id_entity: input.idEntity,
        entity: input.entity ?? "opportunity",
        order: input.order ?? "desc",
        situation: input.situation,
        limit: input.limit,
        offset: input.offset
      }
    });
  }

  /** Internal V2 endpoint observed in the authenticated application. */
  getChat(input: { id: string | number }): Promise<unknown> {
    return this.http.get(`/messages/chats/${input.id}`);
  }

  /** Internal V2 endpoint observed in the authenticated application. */
  listChatMessages(input: {
    id: string | number;
    offset?: number;
    limit?: number;
    order?: Leads2bChatOrder;
  }): Promise<unknown> {
    return this.http.get(`/messages/chats/${input.id}/messages`, {
      query: {
        offset: input.offset,
        limit: input.limit,
        order: input.order ?? "desc"
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
