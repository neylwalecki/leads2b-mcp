import "dotenv/config";
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

class LiveMcpClient {
  private readonly process: ChildProcessWithoutNullStreams;
  private readonly pending = new Map<JsonRpcId, PendingRequest>();
  private buffer = "";
  private nextId = 1;
  private stderr = "";

  constructor() {
    this.process = spawn(process.execPath, ["--import", "tsx", "src/index.ts"], {
      cwd: process.cwd(),
      env: process.env,
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
        name: "leads2b-mcp-live-smoke",
        version: "0.1.0"
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
    return withTimeout(response, 10_000, method);
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
      } catch {
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

const runIntegration = process.env.RUN_LEADS2B_INTEGRATION_TESTS === "true";

let client: LiveMcpClient | undefined;

afterEach(async () => {
  await client?.stop();
  client = undefined;
});

describe.skipIf(!runIntegration)("Leads2b MCP live smoke", () => {
  it("calls representative read-only tools through stdio", async () => {
    expect(process.env.LEADS2B_API_V1_TOKEN).toBeTruthy();
    expect(process.env.LEADS2B_API_V2_TOKEN).toBeTruthy();

    client = new LiveMcpClient();

    const initialized = await client.initialize();
    expect(initialized.error).toBeUndefined();

    const health = await callTool("leads2b_health_check", {});
    expect(health.result?.structuredContent).toMatchObject({
      ok: true,
      data: {
        tokens: {
          v1Configured: true,
          v2Configured: true
        },
        apis: {
          v1: { ok: true },
          v2: { ok: true }
        }
      }
    });

    await expectToolOk("leads2b_list_pipelines_by_entity", { entity: "LEAD" });
    await expectToolOk("leads2b_get_dashboard_counts", {});
    await expectToolOk("leads2b_search_campaigns", {});
    await expectToolOk("leads2b_list_segmentations", { entity: "OPPORTUNITY", limit: 20, offset: 0 });
    await expectToolOk("leads2b_list_calendar_events", {
      calendars: ["leads2b"],
      types: ["action", "meet"],
      start: "2026-04-26T03:00:00.000Z",
      end: "2026-06-07T03:00:00.000Z",
      limit: 200,
      offset: 0
    });
  }, 30_000);
});

async function expectToolOk(name: string, args: Record<string, unknown>): Promise<void> {
  const response = await callTool(name, args);
  expect(response.error).toBeUndefined();
  expect(response.result?.isError).toBeUndefined();
  expect(response.result?.structuredContent).toMatchObject({ ok: true });
}

async function callTool(name: string, args: Record<string, unknown>): Promise<JsonRpcResponse> {
  if (!client) {
    throw new Error("MCP client not initialized.");
  }

  return client.request("tools/call", {
    name,
    arguments: args
  });
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  const timeout = delay(timeoutMs).then(() => {
    throw new Error(`Timed out waiting for MCP response to ${label}.`);
  });

  return Promise.race([promise, timeout]);
}
