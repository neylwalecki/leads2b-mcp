import { access, cp, link, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createBundleArchive, validateBundleManifest } from "./mcpb-support.mjs";

/** Build a new local candidate. Importing this module never runs npm.
 * @param {string} root @param {string | undefined} npmCli
 */
export async function packageMcpb(root = resolve(dirname(fileURLToPath(import.meta.url)), ".."), npmCli = process.env.npm_execpath) {
  const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  const manifest = JSON.parse(await readFile(join(root, "manifest.json"), "utf8"));
  const output = join(root, "artifacts", `leads2b-mcp-${pkg.version}.mcpb`);
  await mkdir(dirname(output), { recursive: true });
  try {
    await access(output);
    throw new Error(`Candidate already exists: ${output}`);
  } catch (error) { if (error.code !== "ENOENT") throw error; }
  if (!npmCli) throw new Error("Run through npm run package:mcpb.");
  const stage = await mkdtemp(join(tmpdir(), "leads2b-mcpb-"));
  const temporary = `${output}.${randomUUID()}.tmp`;
  try {
    // Explicit allowlist: no account data, research, Git history or devDependencies.
    for (const name of ["dist", "docs", "examples", "CHANGELOG.md", "manifest.json", "README.md", "LICENSE", "package.json", "package-lock.json"])
      await cp(join(root, name), join(stage, name), { recursive: true, verbatimSymlinks: true });
    // Root ignore files were never staged by the old script. Reject their introduction.
    try {
      await access(join(root, ".mcpbignore"));
      throw new Error("Root .mcpbignore is not supported.");
    } catch (error) { if (error.code !== "ENOENT") throw error; }
    await validateBundleManifest(manifest, pkg.version, stage);
    // npm exposes its own CLI path on Windows too; no shell expansion.
    const result = spawnSync(process.execPath, [npmCli, "ci", "--omit=dev", "--ignore-scripts", "--cache", join(root, ".npm-cache")], { cwd: stage, stdio: "inherit" });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`Packaging step failed (${result.status}).`);
    const runtimePackage = { name: pkg.name, version: pkg.version, type: pkg.type, license: pkg.license, dependencies: pkg.dependencies, engines: pkg.engines, exports: pkg.exports };
    await writeFile(join(stage, "package.json"), JSON.stringify(runtimePackage, null, 2) + "\n");
    await rm(join(stage, "package-lock.json"));
    const bytes = await createBundleArchive(stage);
    await writeFile(temporary, bytes, { flag: "wx" });
    // Same-directory hard link publishes a complete file and atomically refuses overwrite.
    try { await link(temporary, output); }
    catch (error) {
      if (error.code === "EEXIST") throw new Error(`Candidate already exists: ${output}`);
      throw error;
    }
    console.log(`Bundle created: ${output} (${bytes.length} bytes)`);
  } finally {
    await rm(temporary, { force: true });
    await rm(stage, { recursive: true, force: true });
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await packageMcpb();
