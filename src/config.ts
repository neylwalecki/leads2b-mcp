import "dotenv/config";
import { z } from "zod";

const DEFAULT_V1_BASE_URL = "https://app.leads2b.com/api/v1";
const DEFAULT_V2_BASE_URL = "https://app.leads2b.com/api/v2";
const DEFAULT_PUBLIC_WORKER_URL = "https://js.app.leads2b.com";

const optionalTrimmedString = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}, z.string().optional());

const EnvSchema = z.object({
  LEADS2B_API_V1_TOKEN: optionalTrimmedString,
  LEADS2B_API_V2_TOKEN: optionalTrimmedString,
  LEADS2B_API_V1_BASE_URL: optionalTrimmedString.default(DEFAULT_V1_BASE_URL),
  LEADS2B_API_V2_BASE_URL: optionalTrimmedString.default(DEFAULT_V2_BASE_URL),
  LEADS2B_PUBLIC_WORKER_URL: optionalTrimmedString.default(DEFAULT_PUBLIC_WORKER_URL)
});

export type Leads2bConfig = {
  apiV1Token?: string;
  apiV2Token?: string;
  apiV1BaseUrl: string;
  apiV2BaseUrl: string;
  publicWorkerUrl: string;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Leads2bConfig {
  const parsed = EnvSchema.parse(env);

  return {
    apiV1Token: parsed.LEADS2B_API_V1_TOKEN,
    apiV2Token: parsed.LEADS2B_API_V2_TOKEN,
    apiV1BaseUrl: parsed.LEADS2B_API_V1_BASE_URL,
    apiV2BaseUrl: parsed.LEADS2B_API_V2_BASE_URL,
    publicWorkerUrl: parsed.LEADS2B_PUBLIC_WORKER_URL
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
