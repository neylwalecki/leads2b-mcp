import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, writeFile, readFile, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unzipSync } from "fflate";
import { packageMcpb } from "../scripts/package-mcpb.mjs";

// Only the external npm/CLI subprocess is replaced; filesystem effects remain real.
const subprocess = vi.hoisted(() => ({ failure: false, stage: "" }));
vi.mock("node:child_process", () => ({ spawnSync: (_command, _args, options) => {
  subprocess.stage = options.cwd;
  return { status: subprocess.failure ? 1 : 0 };
} }));
const manifest = JSON.parse(await readFile(new URL("../manifest.json", import.meta.url), "utf8"));
let root;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "leads2b-package-root-"));
  subprocess.failure = false;
  subprocess.stage = "";
  for (const directory of ["dist", "docs", "examples", "artifacts"]) await mkdir(join(root, directory));
  await writeFile(join(root, "dist/index.js"), "export {};\n");
  for (const file of ["README.md", "CHANGELOG.md", "LICENSE"]) await writeFile(join(root, file), "example");
  await writeFile(join(root, "package.json"), JSON.stringify({ name: "example", version: manifest.version, type: "module", dependencies: {}, engines: { node: ">=22" } }));
  await writeFile(join(root, "package-lock.json"), "{}");
  await writeFile(join(root, "manifest.json"), JSON.stringify(manifest));
});
afterEach(async () => { await rm(root, { recursive: true, force: true }); });
const output = () => join(root, "artifacts", `leads2b-mcp-${manifest.version}.mcpb`);

it("cleans staging when npm fails and leaves no output", async () => {
  subprocess.failure = true;
  await expect(packageMcpb(root, "example-npm-cli")).rejects.toThrow(/Packaging step failed/);
  await expect(access(subprocess.stage)).rejects.toThrow();
  await expect(access(output())).rejects.toThrow();
});
it("refuses to overwrite an existing candidate", async () => {
  await writeFile(output(), "original");
  await expect(packageMcpb(root, "example-npm-cli")).rejects.toThrow(/already exists/);
  expect(await readFile(output(), "utf8")).toBe("original");
});
it("publishes a complete ZIP and cleans staging after success", async () => {
  await packageMcpb(root, "example-npm-cli");
  const files = unzipSync(await readFile(output()));
  expect(new TextDecoder().decode(files["dist/index.js"])).toBe("export {};\n");
  expect(files["package-lock.json"]).toBeUndefined();
  expect(JSON.parse(new TextDecoder().decode(files["package.json"])).dependencies).toEqual({});
  await expect(access(subprocess.stage)).rejects.toThrow();
});
