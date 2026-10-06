import { readFile, realpath, stat, readdir, lstat } from "node:fs/promises";
import { relative, resolve, isAbsolute, join } from "node:path";
import { zipSync } from "fflate";
import Ajv from "ajv";
import addFormats from "ajv-formats";

const schema = JSON.parse(await readFile(new URL("./vendor/mcpb-manifest-v0.3.schema.json", import.meta.url), "utf8"));
const ajv = new Ajv({ strict: true, allErrors: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);

/** Validate the supported manifest and project policies, without rewriting input.
 * @param {object} manifest @param {string} packageVersion @param {string} stageDir
 * @returns {Promise<void>}
 */
export async function validateBundleManifest(manifest, packageVersion, stageDir) {
  if (!validateSchema(manifest)) throw new Error(`Invalid MCPB manifest: ${ajv.errorsText(validateSchema.errors)}`);
  if (manifest.manifest_version !== "0.3" || (manifest.dxt_version && manifest.dxt_version !== "0.3"))
    throw new Error("Only manifest_version 0.3 is supported.");
  if (manifest.version !== packageVersion) throw new Error("Manifest and package versions differ.");
  if (manifest.server.type !== "node" || manifest.compatibility?.runtimes?.node !== ">=22")
    throw new Error("Bundle requires a Node server with runtime >=22.");
  const entry = manifest.server.entry_point;
  if (!entry || entry.startsWith("/") || /[\\:]/.test(entry) || entry.split("/").some(part => part === ".." || part === "." || !part))
    throw new Error("Unsafe manifest entry point.");
  const base = await realpath(stageDir);
  const entryPath = await realpath(resolve(base, entry));
  const entryRelative = relative(base, entryPath);
  if (isAbsolute(entryRelative) || entryRelative === ".." || entryRelative.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) || !(await stat(entryPath)).isFile())
    throw new Error("Manifest entry point must be a file inside the staging directory.");
  const config = manifest.user_config;
  const env = manifest.server.mcp_config.env;
  if (config?.write_mode?.default !== "disabled" || env?.LEADS2B_WRITE_MODE !== "${user_config.write_mode}")
    throw new Error("Bundle write mode must default to disabled and use user_config.");
  for (const key of ["token_v1", "token_v2"]) {
    if (config?.[key]?.sensitive !== true) throw new Error(`Bundle ${key} must be sensitive.`);
  }
  if (env?.LEADS2B_ENABLE_RAW_API !== "false") throw new Error("Bundle raw API must default to false.");
  for (const match of JSON.stringify(manifest).matchAll(/\$\{user_config\.([^}]+)\}/g)) {
    if (!Object.hasOwn(config, match[1])) throw new Error(`Unknown user_config reference: ${match[1]}`);
  }
}

// Finite project filters, based on mcpb 2.1.2 dist/node/files.js.
// No general gitignore syntax: introducing .mcpbignore requires explicit support.
const excludedNames = new Set([
  ".DS_Store", "Thumbs.db", ".gitignore", ".git", ".mcpbignore", ".npm", ".npmrc",
  ".yarnrc", ".yarn", ".eslintrc", ".editorconfig", ".prettierrc", ".prettierignore",
  ".eslintignore", ".nycrc", ".babelrc", "package-lock.json", "yarn.lock", "tsconfig.json",
  ".internal", "research", "credentials", "credenciais", "artifacts", ".superpowers"
]);
const allowedRoots = new Set(["dist", "docs", "examples", "node_modules", "CHANGELOG.md", "CONTRIBUTING.md", "manifest.json", "package.json", "README.md", "LICENSE"]);
function excluded(path) {
  const name = path.split("/").at(-1);
  return excludedNames.has(name) || name.startsWith(".env") || name.startsWith(".pnp.") ||
    /\.(log|map|mcpb|d\.ts|tsbuildinfo)$/.test(name) ||
    /^(npm-debug\.log|yarn-debug\.log|yarn-error\.log)/.test(name) ||
    /(^|\/)node_modules\/(\.cache|\.bin)(\/|$)/.test(path);
}
function safePath(path) {
  if (path.startsWith("/") || /[\\:]/.test(path) || path.split("/").some(part => !part || part === "." || part === ".."))
    throw new Error(`Unsafe archive path: ${path}`);
}

/** @param {string} stageDir @returns {Promise<Uint8Array>} */
export async function createBundleArchive(stageDir) {
  const entries = Object.create(null);
  async function walk(dir, prefix = "") {
    for (const name of (await readdir(dir)).sort()) {
      const path = prefix ? `${prefix}/${name}` : name;
      safePath(path);
      if (!prefix && name === ".mcpbignore") throw new Error("Root .mcpbignore is not supported.");
      if (excluded(path)) continue;
      if (!prefix && !allowedRoots.has(name)) throw new Error(`Unexpected staging file: ${path}`);
      const absolute = join(dir, name);
      const info = await lstat(absolute);
      if (info.isSymbolicLink()) throw new Error(`Symbolic link in bundle: ${path}`);
      if (info.isDirectory()) await walk(absolute, path);
      else if (info.isFile()) entries[path] = [await readFile(absolute), process.platform === "win32" ? {} : { os: 3, attrs: (info.mode & 0o777) << 16 }];
      else throw new Error(`Unsupported staging file: ${path}`);
    }
  }
  await walk(stageDir);
  return zipSync(entries, { level: 9, mtime: new Date() });
}
