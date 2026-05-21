import { Leads2bHttpClient } from "./http.js";

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

  listOrigins(): Promise<unknown> {
    return this.http.get("/origin/index/");
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
