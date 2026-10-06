import assert from "node:assert/strict";
import { validateBundleManifest } from "./mcpb-support.mjs";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { unzipSync } from "fflate";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport, getDefaultEnvironment } from "@modelcontextprotocol/sdk/client/stdio.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const artifact = join(root, "artifacts", `leads2b-mcp-${pkg.version}.mcpb`);
const bytes = await readFile(artifact);
const files = unzipSync(bytes);
const names = Object.keys(files);
const decoder = new TextDecoder();
for (const name of names) {
  assert(!name.startsWith("/") && !name.includes("\\") && !name.includes(":"), `Unsafe archive path: ${name}`);
  assert(!name.split("/").includes(".."), `Archive traversal: ${name}`);
  assert(/^(dist\/|docs\/|examples\/|CHANGELOG\.md$|CONTRIBUTING\.md$|node_modules\/|manifest\.json$|package\.json$|README\.md$|LICENSE$)/.test(name), `Unexpected artifact file: ${name}`);
  assert(!/(^|\/)(\.env(?:\..*)?|\.git|\.internal|research)(\/|$)/.test(name), `Private file in artifact: ${name}`);
  assert(!name.startsWith("node_modules/@anthropic-ai/") && !name.startsWith("node_modules/typescript/"), "Development dependency in artifact");
}
assert(files["dist/index.js"] && files["manifest.json"] && files["node_modules/@modelcontextprotocol/sdk/package.json"]);
assert(files["CONTRIBUTING.md"], "Missing contribution guide linked by documentation");
const manifest = JSON.parse(decoder.decode(files["manifest.json"]));
assert.equal(manifest.version, pkg.version);
assert.equal(manifest.user_config.write_mode.default, "disabled");
assert.equal(manifest.user_config.token_v1.sensitive, true);
assert.equal(manifest.user_config.token_v2.sensitive, true);
assert.equal(manifest.server.mcp_config.env.LEADS2B_ENABLE_RAW_API, "false");
const extractDir = await mkdtemp(join(tmpdir(), "leads2b-verify-"));
try {
  for (const [name, data] of Object.entries(files)) {
    const path = join(extractDir, name);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data);
  }
  await validateBundleManifest(manifest, pkg.version, extractDir);
  for (const mode of ["disabled", "preview"]) {
    const client = new Client({ name: "leads2b-package-verifier", version: pkg.version });
    const transport = new StdioClientTransport({ command: process.execPath, args: [join(extractDir, "dist/index.js")], env: {
      ...getDefaultEnvironment(), LEADS2B_API_V1_TOKEN: "", LEADS2B_API_V2_TOKEN: "",
      LEADS2B_WRITE_MODE: mode, LEADS2B_ENABLE_RAW_API: "false", DOTENV_CONFIG_PATH: join(extractDir, ".env.disabled")
    } });
    try {
      await client.connect(transport);
      const { tools } = await client.listTools();
      const toolNames = tools.map(tool => tool.name);
      assert(toolNames.includes("leads2b_scan_lead_ops") && toolNames.includes("leads2b_get_contact"));
      assert(!toolNames.includes("leads2b_api_request"));
      const writes = tools.filter(tool => tool.annotations?.readOnlyHint === false);
      assert.equal(writes.length, mode === "preview" ? 16 : 0);
      if (mode === "preview") {
        const result = await client.callTool({ name: "leads2b_create_customer", arguments: { fields: { name: "Example", type: "PERSON" } } });
        assert(!result.isError);
        assert.equal(result.structuredContent.data.executed, false);
        assert.equal(result.structuredContent.data.endpoint, "/customer/index");
      }
      const health = await client.callTool({ name: "leads2b_health_check", arguments: {} });
      assert.deepEqual(health.structuredContent.data.registeredTools.toSorted(), toolNames.toSorted());
      if (mode === "preview") {
        for (const [name, args] of [
          ["leads2b_win_opportunity", { id: 123 }],
          ["leads2b_lose_opportunity", { id: 123, id_loss: 2, loss_reason: "Example" }],
          ["leads2b_create_note", { entity: "LEAD", id: 123, message: "Example" }],
          ["leads2b_create_activity", { entity: "OPPORTUNITY", id: 123, message: "Example", receiver: 7, action: 2, data: "2026-10-05 12:00:00" }]
        ]) {
          const result = await client.callTool({ name, arguments: args });
          assert(!result.isError);
          assert.equal(result.structuredContent.data.executed, false);
        }
      }
      const normalized = await client.callTool({ name: "leads2b_normalize_source", arguments: { utm_source: "chatgpt.com", host: "example.com" } });
      assert(!normalized.isError);
      assert.equal(normalized.structuredContent.data.channel, "ai_referral");
      console.log(`Packaged MCP verified: mode=${mode}, tools=${toolNames.length}, Node=${process.version}`);
    } finally { await client.close(); }
  }
} finally { await rm(extractDir, { recursive: true, force: true }); }
const sha256 = createHash("sha256").update(bytes).digest("hex");
await writeFile(`${artifact}.sha256`, `${sha256}  leads2b-mcp-${pkg.version}.mcpb\n`);
console.log(`Archive verified: ${names.length} files; SHA-256 ${sha256}`);
