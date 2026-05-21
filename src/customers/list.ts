export type CustomerListOptions = {
  limit?: number;
  offset?: number;
  search?: string;
  summaryOnly?: boolean;
};

export type CustomerFindOptions = CustomerListOptions & {
  email?: string;
  phone?: string;
  document?: string;
  name?: string;
};

type CustomerRecord = Record<string, unknown>;

export type CustomerFindResult = {
  data: {
    customers: unknown[];
    total: number;
    matchedTotal: number;
    offset: number;
    limit: number;
    criteria: {
      query?: string;
      email?: string;
      phone?: string;
      document?: string;
      name?: string;
    };
  };
};

export function prepareCustomerListOutput(response: unknown, options: CustomerListOptions): unknown {
  if (!hasLocalOptions(options)) {
    return response;
  }

  const customers = extractCustomers(response);
  const filtered = filterCustomers(customers, options.search);
  const offset = options.offset ?? 0;
  const limit = options.limit ?? filtered.length;
  const sliced = filtered.slice(offset, offset + limit);
  const outputCustomers = options.summaryOnly ? sliced.map(toCustomerSummary) : sliced;

  return {
    data: {
      customers: outputCustomers,
      total: customers.length,
      filteredTotal: filtered.length,
      offset,
      limit
    }
  };
}

export function extractCustomers(response: unknown): CustomerRecord[] {
  if (!response || typeof response !== "object") {
    return [];
  }

  const data = (response as { data?: unknown }).data;
  if (!data || typeof data !== "object") {
    return [];
  }

  const customers = (data as { customers?: unknown }).customers;
  return Array.isArray(customers) ? (customers as CustomerRecord[]) : [];
}

export function findCustomers(response: unknown, options: CustomerFindOptions): CustomerFindResult {
  const customers = extractCustomers(response);
  const matched = customers.filter((customer) => matchesCustomer(customer, options));
  const offset = options.offset ?? 0;
  const limit = options.limit ?? matched.length;
  const sliced = matched.slice(offset, offset + limit);

  return {
    data: {
      customers: options.summaryOnly ? sliced.map(toCustomerSummary) : sliced,
      total: customers.length,
      matchedTotal: matched.length,
      offset,
      limit,
      criteria: {
        query: options.search,
        email: options.email,
        phone: options.phone,
        document: options.document,
        name: options.name
      }
    }
  };
}

function hasLocalOptions(options: CustomerListOptions): boolean {
  return Boolean(options.limit || options.offset || options.search || options.summaryOnly);
}

function filterCustomers(customers: CustomerRecord[], search?: string): CustomerRecord[] {
  const needle = search?.trim().toLowerCase();
  if (!needle) {
    return customers;
  }

  return customers.filter((customer) => {
    const haystack = [
      customer.id,
      customer.name,
      customer.company_name,
      customer.email,
      customer.phone_com,
      customer.cel_phone,
      customer.cnpj
    ]
      .map((value) => (value === null || value === undefined ? "" : String(value).toLowerCase()))
      .join(" ");

    return haystack.includes(needle);
  });
}

function matchesCustomer(customer: CustomerRecord, options: CustomerFindOptions): boolean {
  const checks: boolean[] = [];

  if (options.search) {
    checks.push(customerSearchText(customer).includes(options.search.trim().toLowerCase()));
  }

  if (options.email) {
    const needle = options.email.trim().toLowerCase();
    checks.push(splitEmails(customer.email).some((email) => email === needle));
  }

  if (options.phone) {
    const needle = onlyDigits(options.phone);
    checks.push(
      Boolean(needle) &&
        [customer.phone_com, customer.cel_phone, customer.ddd]
          .map((value) => onlyDigits(value))
          .some((value) => value.includes(needle) || needle.includes(value))
    );
  }

  if (options.document) {
    const needle = onlyDigits(options.document);
    checks.push(
      Boolean(needle) &&
        [customer.cnpj, customer.cpf]
          .map((value) => onlyDigits(value))
          .some((value) => value === needle)
    );
  }

  if (options.name) {
    const needle = options.name.trim().toLowerCase();
    checks.push(
      [customer.name, customer.company_name]
        .map((value) => textValue(value).toLowerCase())
        .some((value) => value.includes(needle))
    );
  }

  return checks.length > 0 && checks.every(Boolean);
}

function customerSearchText(customer: CustomerRecord): string {
  return [
    customer.id,
    customer.name,
    customer.company_name,
    customer.email,
    customer.phone_com,
    customer.cel_phone,
    customer.cnpj,
    customer.cpf
  ]
    .map((value) => textValue(value).toLowerCase())
    .join(" ");
}

function splitEmails(value: unknown): string[] {
  return textValue(value)
    .split(/[;,]/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function onlyDigits(value: unknown): string {
  return textValue(value).replace(/\D/g, "");
}

function textValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

function toCustomerSummary(customer: CustomerRecord): Record<string, unknown> {
  return {
    id: customer.id,
    name: customer.name,
    companyName: customer.company_name,
    email: customer.email,
    phone: customer.phone_com,
    mobilePhone: customer.cel_phone,
    cnpj: customer.cnpj,
    originId: customer.id_origin,
    userId: customer.id_user,
    createdAt: customer.create_date,
    updatedAt: customer.update_date
  };
}
