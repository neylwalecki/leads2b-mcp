import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const manifest = JSON.parse(await readFile(join(root, "manifest.json"), "utf8"));
if (manifest.version !== pkg.version) throw new Error("Manifest and package versions differ.");
const stage = await mkdtemp(join(tmpdir(), "leads2b-mcpb-"));
const output = join(root, "artifacts", `leads2b-mcp-${pkg.version}.mcpb`);
function runNode(script, args, cwd) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Packaging step failed (${result.status}).`);
}
try {
  // Explicit allowlist: no .env, source account data, research, git history or developer dependencies.
  for (const name of ["dist", "docs", "examples", "CHANGELOG.md", "manifest.json", "README.md", "LICENSE", "package.json", "package-lock.json"])
    await cp(join(root, name), join(stage, name), { recursive: true });
  // npm provides its own CLI path on Windows too; avoid cmd.exe quoting/shell expansion.
  if (!process.env.npm_execpath) throw new Error("Run through npm run package:mcpb.");
  runNode(process.env.npm_execpath, ["ci", "--omit=dev", "--ignore-scripts", "--cache", join(root, ".npm-cache")], stage);
  const runtimePackage = { name: pkg.name, version: pkg.version, type: pkg.type, license: pkg.license, dependencies: pkg.dependencies, engines: pkg.engines, exports: pkg.exports };
  await writeFile(join(stage, "package.json"), JSON.stringify(runtimePackage, null, 2) + "\n");
  await rm(join(stage, "package-lock.json"));
  await mkdir(dirname(output), { recursive: true });
  runNode(join(root, "node_modules/@anthropic-ai/mcpb/dist/cli/cli.js"), ["pack", stage, output], root);
} finally { await rm(stage, { recursive: true, force: true }); }
