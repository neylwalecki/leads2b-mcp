import { Leads2bHttpClient } from "./http.js";

export type Leads2bPipelineEntity = "LEAD" | "OPPORTUNITY";
export type Leads2bLossEntity = "OPPORTUNITY";
export type Leads2bColumnEntity = "LEAD" | "CONTACT" | "OPPORTUNITY";

export class Leads2bV1Client {
  constructor(private readonly http: Leads2bHttpClient) {}

  hasToken(): boolean {
    return this.http.hasToken();
  }

  getLoggedUser(): Promise<unknown> {
    return this.http.get("/user/logged/");
  }

  listPipelines(): Promise<unknown> {
    return this.http.get("/pipeline/active");
  }

  async getDashboardCounts(): Promise<unknown> {
    const [
      leadCount,
      opportunityCount,
      wonOpportunityCount,
      hotOpportunityCount,
      afterSalesCount
    ] = await Promise.all([
      this.http.get("/dashboard/lead_count/"),
      this.http.get("/dashboard/opportunity_count/"),
      this.http.get("/dashboard/won_opportunity_count/"),
      this.http.get("/dashboard/hot_opportunity_count/"),
      this.http.get("/dashboard/after_sales_count/")
    ]);

    return {
      leadCount,
      opportunityCount,
      wonOpportunityCount,
      hotOpportunityCount,
      afterSalesCount
    };
  }

  listPipelinesByEntity(input: { entity: Leads2bPipelineEntity }): Promise<unknown> {
    return this.http.get(`/pipeline/byEntity/${input.entity}`);
  }

  listUsersByAccessLevel(): Promise<unknown> {
    return this.http.get("/user/users_by_access_level");
  }

  listOrigins(): Promise<unknown> {
    return this.http.get("/origin/index/");
  }

  listTags(): Promise<unknown> {
    return this.http.get("/tag/index/");
  }

  listChromeExtensionUsers(): Promise<unknown> {
    return this.http.get("/chrome_extension/users");
  }

  listActions(): Promise<unknown> {
    return this.http.get("/action/list/");
  }

  searchCampaigns(input: { search?: string; draw?: number } = {}): Promise<unknown> {
    return this.http.get("/campaign/search", {
      query: {
        draw: input.draw ?? 1,
        "search[value]": input.search ?? "",
        "search[regex]": false
      }
    });
  }

  searchFlows(input: { search?: string; draw?: number } = {}): Promise<unknown> {
    return this.http.get("/flow/search", {
      query: {
        draw: input.draw ?? 1,
        "search[value]": input.search ?? "",
        "search[regex]": false
      }
    });
  }

  countDeals(input: { pipelineId: string | number; status: string; search?: string }): Promise<unknown> {
    return this.http.get("/deal/count_deals", {
      query: {
        pipelineId: input.pipelineId,
        status: input.status,
        search: input.search
      }
    });
  }

  getEntityColumns(input: {
    entity: Leads2bColumnEntity;
    withDeleted?: boolean;
    onlyCount?: boolean;
  }): Promise<unknown> {
    return this.http.get(`/custom_column/entity_columns/${input.entity}/`, {
      query: {
        with_deleted: input.withDeleted ?? false,
        only_count: input.onlyCount ?? false
      }
    });
  }

  listCustomerTypes(): Promise<unknown> {
    return this.http.get("/customer_type");
  }

  getReceitaByCnpj(input: { cnpj: string }): Promise<unknown> {
    const digits = input.cnpj.replace(/\D/g, "");

    if (!digits) {
      throw new Error("Informe um CNPJ.");
    }

    return this.http.get(`/receita/index/${digits}`);
  }

  listLossReasons(input: { entity: Leads2bLossEntity }): Promise<unknown> {
    return this.http.get(`/loss/index/${input.entity.toLowerCase()}`);
  }

  listForms(): Promise<unknown> {
    return this.http.get("/form/index");
  }

  getLeadColumns(): Promise<unknown> {
    return this.http.get("/lead/columns");
  }

  listCustomers(): Promise<unknown> {
    return this.http.get("/customer/index");
  }

  getDefaultLead(input: { id: string | number }): Promise<unknown> {
    return this.http.get(`/lead/index/${input.id}/defaultLead`);
  }
}
