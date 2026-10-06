import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, readFile, rm, writeFile, chmod, symlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { unzipSync } from "fflate";
import { validateBundleManifest, createBundleArchive } from "../scripts/mcpb-support.mjs";

const fixture = JSON.parse(await readFile(new URL("../manifest.json", import.meta.url), "utf8"));
let stage;
beforeEach(async () => {
  stage = await mkdtemp(join(tmpdir(), "leads2b-pack-test-"));
  await mkdir(join(stage, "dist"));
  await writeFile(join(stage, "dist/index.js"), "export {};\n");
});
afterEach(async () => { await rm(stage, { recursive: true, force: true }); });

// Missing schema/policy checks would accept a bundle the installer cannot safely use.
describe("bundle manifest validation", () => {
  it("accepts the current supported manifest and entry file", async () => {
    await expect(validateBundleManifest(fixture, fixture.version, stage)).resolves.toBeUndefined();
  });
  it.each([
    ["missing required field", m => { delete m.author; }],
    ["wrong field type", m => { m.tools_generated = "yes"; }],
    ["unknown property", m => { m.unrecognized = true; }],
    ["invalid URI", m => { m.author.url = "invalid"; }],
    ["invalid email", m => { m.author.email = "invalid"; }],
    ["missing manifest version", m => { delete m.manifest_version; }],
    ["unsupported manifest version", m => { m.manifest_version = "0.4"; }],
    ["conflicting legacy version", m => { m.dxt_version = "0.2"; }],
    ["package version mismatch", m => { m.version = "0.0.0"; }],
    ["non-node server", m => { m.server.type = "python"; }],
    ["unsupported runtime", m => { m.compatibility.runtimes.node = ">=18"; }],
    ["write enabled by default", m => { m.user_config.write_mode.default = "live"; }],
    ["token not sensitive", m => { m.user_config.token_v1.sensitive = false; }],
    ["raw API enabled", m => { m.server.mcp_config.env.LEADS2B_ENABLE_RAW_API = "true"; }],
    ["missing configuration reference", m => { m.server.mcp_config.env.EXAMPLE = "${user_config.missing}"; }],
    ["missing entry file", m => { m.server.entry_point = "dist/missing.js"; }],
    ["absolute entry", m => { m.server.entry_point = "/dist/index.js"; }],
    ["traversing entry", m => { m.server.entry_point = "dist/../index.js"; }],
    ["Windows drive entry", m => { m.server.entry_point = "C:/dist/index.js"; }],
    ["backslash entry", m => { m.server.entry_point = "dist\\index.js"; }]
  ])("rejects %s", async (_name, mutate) => {
    const manifest = structuredClone(fixture);
    mutate(manifest);
    await expect(validateBundleManifest(manifest, fixture.version, stage)).rejects.toThrow();
  });
});

async function put(name, content = "excluded") {
  const path = join(stage, name);
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, content);
}

describe("bundle ZIP", () => {
  it("keeps root paths, sorted names and production bytes", async () => {
    await put("manifest.json", JSON.stringify(fixture));
    await put("node_modules/example/index.js", new Uint8Array([0, 255, 20]));
    await put("LICENSE", "license");
    const files = unzipSync(await createBundleArchive(stage));
    expect(Object.keys(files)).toEqual(["LICENSE", "dist/index.js", "manifest.json", "node_modules/example/index.js"]);
    expect([...files["node_modules/example/index.js"]]).toEqual([0, 255, 20]);
    expect(new TextDecoder().decode(files["dist/index.js"])).toBe("export {};\n");
  });
  it("excludes private and development files without omitting runtime assets", async () => {
    for (const name of ["docs/.env", "docs/.env.local", "docs/.npmrc", "docs/.git/config", "docs/research/private.md", "docs/credentials/token", "docs/.internal/data", "docs/test.log", "dist/index.js.map", "dist/index.d.ts", "node_modules/.bin/example", "node_modules/.cache/data", "node_modules/.package-lock.json", "node_modules/example/tsconfig.json", "node_modules/example/yarn.lock"]) await put(name);
    await put("node_modules/example/license.txt", "license");
    await put("node_modules/example/package.json", "{}");
    const files = unzipSync(await createBundleArchive(stage));
    expect(Object.keys(files)).toEqual(["dist/index.js", "node_modules/.package-lock.json", "node_modules/example/license.txt", "node_modules/example/package.json"]);
  });
  it("rejects unknown top-level files", async () => {
    await put("private.json");
    await expect(createBundleArchive(stage)).rejects.toThrow(/Unexpected/);
  });
  it("rejects unsupported root ignore configuration", async () => {
    await put(".mcpbignore", "dist/index.js");
    await expect(createBundleArchive(stage)).rejects.toThrow(/mcpbignore/);
  });
  it.skipIf(process.platform === "win32")("rejects included symlinks", async () => {
    await symlink(join(stage, "dist/index.js"), join(stage, "dist/link.js"));
    await expect(createBundleArchive(stage)).rejects.toThrow(/Symbolic/);
  });
  it.skipIf(process.platform === "win32")("rejects backslash archive names", async () => {
    await put("docs/back\\slash.txt");
    await expect(createBundleArchive(stage)).rejects.toThrow(/Unsafe/);
  });
  it.skipIf(process.platform === "win32")("preserves executable Unix permissions", async () => {
    await chmod(join(stage, "dist/index.js"), 0o755);
    const bytes = await createBundleArchive(stage);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let central = -1;
    for (let i = 0; i <= bytes.length - 46; i++) if (view.getUint32(i, true) === 0x02014b50) { central = i; break; }
    expect(central).toBeGreaterThanOrEqual(0);
    expect(view.getUint32(central + 38, true) >>> 16).toBe(0o755);
  });
});
