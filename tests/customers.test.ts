import { describe, expect, it } from "vitest";
import customerFixture from "./fixtures/customer-index.example.json" with { type: "json" };
import { findCustomers, prepareCustomerListOutput } from "../src/customers/list.js";

describe("prepareCustomerListOutput", () => {
  it("returns the raw API response unchanged when no local options are provided", () => {
    const result = prepareCustomerListOutput(customerFixture, {});

    expect(result).toBe(customerFixture);
  });

  it("filters, limits and summarizes customers only when explicitly requested", () => {
    const result = prepareCustomerListOutput(customerFixture, {
      search: "plastics",
      limit: 1,
      summaryOnly: true
    });

    expect(result).toEqual({
      data: {
        customers: [
          {
            id: "101",
            name: "Demo Plastics Ltda",
            companyName: "Demo Plastics",
            email: "contact@example.com",
            phone: "+55 11 97777-0000",
            mobilePhone: null,
            cnpj: "00000000000200",
            originId: "12",
            userId: "7",
            createdAt: "2026-05-15 09:00:00",
            updatedAt: "2026-05-16 11:00:00"
          }
        ],
        total: 2,
        filteredTotal: 1,
        offset: 0,
        limit: 1
      }
    });
  });
});

describe("findCustomers", () => {
  it("finds customers by exact e-mail and returns full records by default", () => {
    const result = findCustomers(customerFixture, {
      email: "LEAD@example.com"
    });

    expect(result.data.matchedTotal).toBe(1);
    expect(result.data.customers).toEqual([customerFixture.data.customers[0]]);
  });

  it("finds customers by normalized phone, document and name with optional summary output", () => {
    const byPhone = findCustomers(customerFixture, {
      phone: "41999990000",
      summaryOnly: true
    });
    const byDocument = findCustomers(customerFixture, {
      document: "00.000.000/0002-00",
      summaryOnly: true
    });
    const byName = findCustomers(customerFixture, {
      name: "demo plastics",
      summaryOnly: true
    });

    expect(byPhone.data.customers[0]).toMatchObject({
      id: "100",
      email: "lead@example.com"
    });
    expect(byDocument.data.customers[0]).toMatchObject({
      id: "101",
      cnpj: "00000000000200"
    });
    expect(byName.data.customers[0]).toMatchObject({
      id: "101",
      name: "Demo Plastics Ltda"
    });
  });
});
