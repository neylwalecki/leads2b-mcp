export type Leads2bApi = "v1" | "v2" | "snippet";

export type Leads2bHttpClientOptions = {
  api: Leads2bApi;
  baseUrl: string;
  token?: string;
  timeoutMs?: number;
  maxReadRetries?: number;
  retryDelayMs?: number;
};

export type Leads2bRequestOptions = {
  query?: Record<string, string | number | boolean | Array<string | number | boolean> | undefined>;
  headers?: Record<string, string>;
  body?: unknown;
  formBody?: Record<string, string>;
  signal?: AbortSignal;
};

export type Leads2bHttpMethod = "GET" | "OPTIONS" | "POST" | "PUT" | "PATCH" | "DELETE";

export class Leads2bHttpError extends Error {
  readonly code: string;
  readonly status?: number;
  readonly endpoint: string;
  readonly details?: unknown;

  constructor(input: { message: string; endpoint: string; status?: number; details?: unknown; code?: string }) {
    super(input.message);
    this.name = "Leads2bHttpError";
    this.code = input.code ?? "LEADS2B_HTTP_ERROR";
    this.status = input.status;
    this.endpoint = input.endpoint;
    this.details = input.details;
  }
}

export class Leads2bHttpClient {
  readonly api: Leads2bApi;
  readonly baseUrl: string;
  private readonly token?: string;
  private readonly timeoutMs: number;
  private readonly maxReadRetries: number;
  private readonly retryDelayMs: number;

  constructor(options: Leads2bHttpClientOptions) {
    this.api = options.api;
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.token = options.token;
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.maxReadRetries = options.maxReadRetries ?? 2;
    this.retryDelayMs = options.retryDelayMs ?? 250;
    if (!Number.isInteger(this.timeoutMs) || this.timeoutMs < 1 || this.timeoutMs > 120_000
      || !Number.isInteger(this.maxReadRetries) || this.maxReadRetries < 0 || this.maxReadRetries > 3
      || !Number.isInteger(this.retryDelayMs) || this.retryDelayMs < 0 || this.retryDelayMs > 5_000) {
      throw new Error("Limites HTTP inválidos: timeout 1..120000 ms, retries 0..3, atraso 0..5000 ms.");
    }
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
    if (options.formBody !== undefined && options.body !== undefined) throw new Error("Use body ou formBody, não ambos.");
    const body = options.formBody !== undefined ? new URLSearchParams(options.formBody).toString()
      : options.body === undefined ? undefined : JSON.stringify(options.body);
    const maxRetries = method === "GET" || method === "OPTIONS" ? this.maxReadRetries : 0;
    for (let attempt = 0; ; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      let retryAfter: string | null = null;
      try {
        const signal = options.signal
          ? AbortSignal.any([controller.signal, options.signal]) : controller.signal;
        signal.throwIfAborted();
        const response = await fetch(url, {
          method,
          headers: {
            Accept: "application/json",
            ...(body === undefined ? {} : { "Content-Type": options.formBody !== undefined ? "application/x-www-form-urlencoded" : "application/json" }),
            Authorization: `Bearer ${this.token}`,
            ...options.headers
          },
          body,
          signal
        });
        retryAfter = response.headers.get("retry-after");
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
      } catch (error) {
        const cancelled = options.signal?.aborted;
        const failure = error instanceof Leads2bHttpError ? error : new Leads2bHttpError({
          message: cancelled ? "Consulta cancelada." : controller.signal.aborted
            ? `Leads2b ${this.api}: tempo limite da consulta excedido.`
            : `Leads2b ${this.api}: falha de conexão.`,
          endpoint: path,
          code: cancelled ? "LEADS2B_CANCELLED" : controller.signal.aborted ? "LEADS2B_TIMEOUT" : "LEADS2B_NETWORK_ERROR"
        });
        const transient = failure.status === undefined || [429, 502, 503, 504].includes(failure.status);
        const delayMs = retryAfter === null ? this.retryDelayMs * 2 ** attempt
          : retryAfterDelay(retryAfter);
        if (cancelled || !transient || attempt >= maxRetries || delayMs > 5_000) throw failure;
        clearTimeout(timer);
        await wait(delayMs, options.signal);
      } finally {
        clearTimeout(timer);
      }
    }
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

function retryAfterDelay(value: string): number {
  const seconds = Number(value);
  const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - Date.now();
  return Number.isFinite(delay) ? Math.max(0, delay) : 5_001;
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(signal.reason); return; }
    const abort = () => { clearTimeout(timer); reject(signal?.reason); };
    const timer = setTimeout(() => { signal?.removeEventListener("abort", abort); resolve(); }, ms);
    signal?.addEventListener("abort", abort, { once: true });
  });
}
