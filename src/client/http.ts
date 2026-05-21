export type Leads2bApi = "v1" | "v2" | "snippet";

export type Leads2bHttpClientOptions = {
  api: Leads2bApi;
  baseUrl: string;
  token?: string;
};

export type Leads2bRequestOptions = {
  query?: Record<string, string | number | boolean | Array<string | number | boolean> | undefined>;
  headers?: Record<string, string>;
  body?: unknown;
};

type Leads2bHttpMethod = "GET" | "OPTIONS" | "POST" | "PUT" | "PATCH" | "DELETE";

export class Leads2bHttpError extends Error {
  readonly status?: number;
  readonly endpoint: string;
  readonly details?: unknown;

  constructor(input: { message: string; endpoint: string; status?: number; details?: unknown }) {
    super(input.message);
    this.name = "Leads2bHttpError";
    this.status = input.status;
    this.endpoint = input.endpoint;
    this.details = input.details;
  }
}

export class Leads2bHttpClient {
  readonly api: Leads2bApi;
  readonly baseUrl: string;
  private readonly token?: string;

  constructor(options: Leads2bHttpClientOptions) {
    this.api = options.api;
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.token = options.token;
  }

  hasToken(): boolean {
    return Boolean(this.token);
  }

  async get<T>(path: string, options: Leads2bRequestOptions = {}): Promise<T> {
    return this.request<T>("GET", path, options);
  }

  async post<T>(path: string, options: Leads2bRequestOptions = {}): Promise<T> {
    return this.request<T>("POST", path, options);
  }

  async put<T>(path: string, options: Leads2bRequestOptions = {}): Promise<T> {
    return this.request<T>("PUT", path, options);
  }

  async patch<T>(path: string, options: Leads2bRequestOptions = {}): Promise<T> {
    return this.request<T>("PATCH", path, options);
  }

  async delete<T>(path: string, options: Leads2bRequestOptions = {}): Promise<T> {
    return this.request<T>("DELETE", path, options);
  }

  async request<T>(method: Leads2bHttpMethod, path: string, options: Leads2bRequestOptions = {}): Promise<T> {
    if (!this.token) {
      throw new Leads2bHttpError({
        message: `Token da API ${this.api} não configurado.`,
        endpoint: path
      });
    }

    const url = this.buildUrl(path, options.query);
    const body = options.body === undefined ? undefined : JSON.stringify(options.body);
    const response = await fetch(url, {
      method,
      headers: {
        Accept: "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        Authorization: `Bearer ${this.token}`,
        ...options.headers
      },
      body
    });
    const responseText = await response.text();
    const parsedBody = parseResponseBody(responseText);

    if (!response.ok) {
      throw new Leads2bHttpError({
        message: `Leads2b ${this.api} respondeu com HTTP ${response.status}.`,
        endpoint: path,
        status: response.status,
        details: parsedBody ?? responseText
      });
    }

    return (parsedBody ?? responseText) as T;
  }

  private buildUrl(path: string, query?: Leads2bRequestOptions["query"]): string {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const url = new URL(`${this.baseUrl}${normalizedPath}`);

    for (const [key, value] of Object.entries(query ?? {})) {
      if (Array.isArray(value)) {
        for (const item of value) {
          url.searchParams.append(key, String(item));
        }
      } else if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }

    return url.toString();
  }
}

function parseResponseBody(text: string): unknown {
  if (!text.trim()) {
    return undefined;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
