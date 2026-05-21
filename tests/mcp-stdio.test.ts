import { ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { afterEach, describe, expect, it } from "vitest";

type JsonRpcId = number | string;

type JsonRpcResponse = {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  result?: Record<string, unknown>;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
};

type PendingRequest = {
  resolve: (response: JsonRpcResponse) => void;
  reject: (error: Error) => void;
};

class McpStdioTestClient {
  private readonly process: ChildProcessWithoutNullStreams;
  private readonly pending = new Map<JsonRpcId, PendingRequest>();
  private buffer = "";
  private nextId = 1;
  private stderr = "";

  constructor(env: NodeJS.ProcessEnv = {}) {
    this.process = spawn(process.execPath, ["--import", "tsx", "src/index.ts"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        LEADS2B_API_V1_TOKEN: "",
        LEADS2B_API_V2_TOKEN: "",
        ...env
      },
      stdio: ["pipe", "pipe", "pipe"]
    });

    this.process.stdout.setEncoding("utf8");
    this.process.stderr.setEncoding("utf8");
    this.process.stdout.on("data", (chunk) => this.handleStdout(chunk));
    this.process.stderr.on("data", (chunk) => {
      this.stderr += chunk;
    });
    this.process.on("error", (error) => this.rejectPending(error));
    this.process.on("exit", (code, signal) => {
      this.rejectPending(
        new Error(`MCP process exited before responding. code=${code ?? "null"} signal=${signal ?? "null"}`)
      );
    });
  }

  async initialize(): Promise<JsonRpcResponse> {
    const response = await this.request("initialize", {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: {
        name: "leads2b-mcp-stdio-test",
        version: "0.2.0"
      }
    });

    this.notify("notifications/initialized", {});
    return response;
  }

  request(method: string, params: Record<string, unknown> = {}): Promise<JsonRpcResponse> {
    const id = this.nextId++;
    const message = {
      jsonrpc: "2.0",
      id,
      method,
      params
    };

    const response = new Promise<JsonRpcResponse>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });

    this.process.stdin.write(`${JSON.stringify(message)}\n`);
    return withTimeout(response, 3_000, method);
  }

  notify(method: string, params: Record<string, unknown> = {}): void {
    this.process.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method, params })}\n`);
  }

  async stop(): Promise<void> {
    if (!this.process.killed) {
      this.process.kill("SIGTERM");
    }

    await delay(50);

    if (!this.process.killed) {
      this.process.kill("SIGKILL");
    }
  }

  private handleStdout(chunk: string): void {
    this.buffer += chunk;

    while (this.buffer.includes("\n")) {
      const lineEnd = this.buffer.indexOf("\n");
      const line = this.buffer.slice(0, lineEnd).trim();
      this.buffer = this.buffer.slice(lineEnd + 1);

      if (!line) {
        continue;
      }

      let message: JsonRpcResponse;
      try {
        message = JSON.parse(line) as JsonRpcResponse;
      } catch (error) {
        this.rejectPending(new Error(`MCP stdout emitted non-JSON content: ${line}`));
        return;
      }

      if (message.id === undefined) {
        continue;
      }

      const pending = this.pending.get(message.id);
      if (!pending) {
        continue;
      }

      this.pending.delete(message.id);
      pending.resolve(message);
    }
  }

  private rejectPending(error: Error): void {
    const message = this.stderr ? `${error.message}\nstderr:\n${this.stderr}` : error.message;

    for (const pending of this.pending.values()) {
      pending.reject(new Error(message));
    }

    this.pending.clear();
  }
}

let client: McpStdioTestClient | undefined;

afterEach(async () => {
  await client?.stop();
  client = undefined;
});

describe("MCP stdio server", () => {
  it("starts, lists read-only tools and calls local attribution normalization", async () => {
    client = new McpStdioTestClient();

    const initialized = await client.initialize();
    expect(initialized.error).toBeUndefined();
    expect(initialized.result?.serverInfo).toMatchObject({
      name: "leads2b-mcp",
      version: "0.2.0"
    });

    const listed = await client.request("tools/list");
    expect(listed.error).toBeUndefined();

    const tools = listed.result?.tools;
    expect(Array.isArray(tools)).toBe(true);

    const toolNames = (tools as Array<{ name: string }>).map((tool) => tool.name);
    expect(toolNames).not.toContain("leads2b_update_customer");
    expect(toolNames).not.toContain("leads2b_create_customer");
    expect(toolNames).not.toContain("leads2b_api_request");
    expect(toolNames).toEqual(
      expect.arrayContaining([
        "leads2b_health_check",
        "leads2b_find_customer",
        "leads2b_search_customers",
        "leads2b_get_customer",
        "leads2b_get_lead_detail",
        "leads2b_get_dashboard_counts",
        "leads2b_list_pipelines_by_entity",
        "leads2b_list_users_by_access_level",
        "leads2b_list_loss_reasons",
        "leads2b_list_tags",
        "leads2b_list_cnaes",
        "leads2b_list_mail_accounts",
        "leads2b_list_company_feedbacks",
        "leads2b_get_company_events",
        "leads2b_list_calendar_events",
        "leads2b_list_segmentations",
        "leads2b_list_chrome_extension_users",
        "leads2b_list_actions",
        "leads2b_search_campaigns",
        "leads2b_search_flows",
        "leads2b_count_deals",
        "leads2b_get_entity_columns",
        "leads2b_list_customer_types",
        "leads2b_get_receita_by_cnpj",
        "leads2b_diagnose_customer_attribution",
        "leads2b_normalize_source"
      ])
    );

    const normalized = await client.request("tools/call", {
      name: "leads2b_normalize_source",
      arguments: {
        utm_source: "chatgpt.com",
        host: "example.com",
        vendorLeadOrigin: "organic | Twitter"
      }
    });

    expect(normalized.error).toBeUndefined();
    expect(normalized.result?.isError).toBeUndefined();
    expect(normalized.result?.structuredContent).toMatchObject({
      ok: true,
      data: {
        channel: "ai_referral",
        normalizedSource: "AI / LLM Referral"
      }
    });
  });

  it("lists write tools in preview mode and returns plans without external calls", async () => {
    client = new McpStdioTestClient({
      LEADS2B_WRITE_MODE: "preview"
    });

    await client.initialize();

    const listed = await client.request("tools/list");
    expect(listed.error).toBeUndefined();

    const tools = listed.result?.tools;
    expect(Array.isArray(tools)).toBe(true);

    const toolNames = (tools as Array<{ name: string }>).map((tool) => tool.name);
    expect(toolNames).toContain("leads2b_update_customer");
    expect(toolNames).toContain("leads2b_create_customer");

    const previewUpdate = await client.request("tools/call", {
      name: "leads2b_update_customer",
      arguments: {
        id: 123,
        fields: {
          name: "Example"
        }
      }
    });

    expect(previewUpdate.error).toBeUndefined();
    expect(previewUpdate.result?.isError).toBeUndefined();
    expect(previewUpdate.result?.structuredContent).toMatchObject({
      ok: true,
      data: {
        mode: "preview",
        executed: false,
        operation: "update_customer"
      }
    });

    const previewCreate = await client.request("tools/call", {
      name: "leads2b_create_customer",
      arguments: {
        fields: {
          name: "Example",
          email: "lead@example.com"
        }
      }
    });

    expect(previewCreate.error).toBeUndefined();
    expect(previewCreate.result?.isError).toBeUndefined();
    expect(previewCreate.result?.structuredContent).toMatchObject({
      ok: true,
      data: {
        mode: "preview",
        executed: false,
        operation: "create_customer",
        method: "POST",
        endpoint: "/customer"
      }
    });
  });

  it("lists the raw API tool only behind the raw API env flag", async () => {
    client = new McpStdioTestClient({
      LEADS2B_WRITE_MODE: "preview",
      LEADS2B_ENABLE_RAW_API: "true"
    });

    await client.initialize();

    const listed = await client.request("tools/list");
    expect(listed.error).toBeUndefined();

    const tools = listed.result?.tools;
    expect(Array.isArray(tools)).toBe(true);

    const toolNames = (tools as Array<{ name: string }>).map((tool) => tool.name);
    expect(toolNames).toContain("leads2b_api_request");

    const planned = await client.request("tools/call", {
      name: "leads2b_api_request",
      arguments: {
        api: "v2",
        method: "POST",
        path: "/customer",
        body: {
          name: "Example"
        }
      }
    });

    expect(planned.error).toBeUndefined();
    expect(planned.result?.isError).toBeUndefined();
    expect(planned.result?.structuredContent).toMatchObject({
      ok: true,
      data: {
        api: "v2",
        mode: "preview",
        executed: false,
        method: "POST",
        endpoint: "/customer"
      }
    });
  });
});

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  const timeout = delay(timeoutMs).then(() => {
    throw new Error(`Timed out waiting for MCP response to ${label}.`);
  });

  return Promise.race([promise, timeout]);
}
