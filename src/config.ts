import "dotenv/config";
import { z } from "zod";

const DEFAULT_V1_BASE_URL = "https://app.leads2b.com/api/v1";
const DEFAULT_V2_BASE_URL = "https://app.leads2b.com/api/v2";
const DEFAULT_PUBLIC_WORKER_URL = "https://js.app.leads2b.com";
const WRITE_MODES = ["disabled", "preview", "live"] as const;

export type Leads2bWriteMode = (typeof WRITE_MODES)[number];

const optionalTrimmedString = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}, z.string().optional());

const optionalBoolean = z.preprocess((value) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "string") {
    return value;
  }

  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "y", "on"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no", "n", "off", ""].includes(normalized)) {
    return false;
  }

  return value;
}, z.boolean().optional());

const optionalWriteMode = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "" ? undefined : normalized;
}, z.enum(WRITE_MODES).optional());

const EnvSchema = z.object({
  LEADS2B_API_V1_TOKEN: optionalTrimmedString,
  LEADS2B_API_V2_TOKEN: optionalTrimmedString,
  LEADS2B_API_V1_BASE_URL: optionalTrimmedString.default(DEFAULT_V1_BASE_URL),
  LEADS2B_API_V2_BASE_URL: optionalTrimmedString.default(DEFAULT_V2_BASE_URL),
  LEADS2B_PUBLIC_WORKER_URL: optionalTrimmedString.default(DEFAULT_PUBLIC_WORKER_URL),
  LEADS2B_WRITE_MODE: optionalWriteMode,
  LEADS2B_ENABLE_WRITE_TOOLS: optionalBoolean.default(false),
  LEADS2B_ENABLE_RAW_API: optionalBoolean.default(false)
});

export type Leads2bConfig = {
  apiV1Token?: string;
  apiV2Token?: string;
  apiV1BaseUrl: string;
  apiV2BaseUrl: string;
  publicWorkerUrl: string;
  writeMode: Leads2bWriteMode;
  rawApiEnabled: boolean;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Leads2bConfig {
  const parsed = EnvSchema.parse(env);
  const writeMode = parsed.LEADS2B_WRITE_MODE ?? (parsed.LEADS2B_ENABLE_WRITE_TOOLS ? "preview" : "disabled");

  return {
    apiV1Token: parsed.LEADS2B_API_V1_TOKEN,
    apiV2Token: parsed.LEADS2B_API_V2_TOKEN,
    apiV1BaseUrl: parsed.LEADS2B_API_V1_BASE_URL,
    apiV2BaseUrl: parsed.LEADS2B_API_V2_BASE_URL,
    publicWorkerUrl: parsed.LEADS2B_PUBLIC_WORKER_URL,
    writeMode,
    rawApiEnabled: parsed.LEADS2B_ENABLE_RAW_API
  };
}

export function getJwtExpiration(token?: string): string | undefined {
  if (!token) {
    return undefined;
  }

  const payload = token.split(".")[1];
  if (!payload) {
    return undefined;
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      exp?: unknown;
    };

    if (typeof decoded.exp !== "number") {
      return undefined;
    }

    return new Date(decoded.exp * 1000).toISOString();
  } catch {
    return undefined;
  }
}
