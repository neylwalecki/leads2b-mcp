import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  it("keeps write mode disabled by default", () => {
    const config = loadConfig({});

    expect(config.writeMode).toBe("disabled");
    expect(config.rawApiEnabled).toBe(false);
  });

  it("accepts explicit write modes", () => {
    expect(loadConfig({ LEADS2B_WRITE_MODE: "disabled" }).writeMode).toBe("disabled");
    expect(loadConfig({ LEADS2B_WRITE_MODE: "preview" }).writeMode).toBe("preview");
    expect(loadConfig({ LEADS2B_WRITE_MODE: "live" }).writeMode).toBe("live");
  });

  it("maps the legacy write-tools flag to preview mode when write mode is absent", () => {
    expect(loadConfig({ LEADS2B_ENABLE_WRITE_TOOLS: "true" }).writeMode).toBe("preview");
    expect(loadConfig({ LEADS2B_ENABLE_WRITE_TOOLS: "1" }).writeMode).toBe("preview");
    expect(loadConfig({ LEADS2B_ENABLE_WRITE_TOOLS: "false" }).writeMode).toBe("disabled");
  });

  it("lets the explicit write mode override the legacy flag", () => {
    expect(loadConfig({ LEADS2B_WRITE_MODE: "live", LEADS2B_ENABLE_WRITE_TOOLS: "false" }).writeMode).toBe("live");
  });

  it("enables the raw API tool only with an explicit true value", () => {
    expect(loadConfig({ LEADS2B_ENABLE_RAW_API: "true" }).rawApiEnabled).toBe(true);
    expect(loadConfig({ LEADS2B_ENABLE_RAW_API: "1" }).rawApiEnabled).toBe(true);
    expect(loadConfig({ LEADS2B_ENABLE_RAW_API: "false" }).rawApiEnabled).toBe(false);
  });
});
