import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  it("keeps write tools disabled by default", () => {
    const config = loadConfig({});

    expect(config.writeToolsEnabled).toBe(false);
  });

  it("enables write tools only with an explicit true value", () => {
    expect(loadConfig({ LEADS2B_ENABLE_WRITE_TOOLS: "true" }).writeToolsEnabled).toBe(true);
    expect(loadConfig({ LEADS2B_ENABLE_WRITE_TOOLS: "1" }).writeToolsEnabled).toBe(true);
    expect(loadConfig({ LEADS2B_ENABLE_WRITE_TOOLS: "false" }).writeToolsEnabled).toBe(false);
  });
});
