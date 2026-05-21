import { describe, expect, it } from "vitest";
import { evaluateWriteOperation, isDestructiveOperation } from "../src/safety/write-gates.js";

describe("evaluateWriteOperation", () => {
  it("blocks write execution in disabled mode", () => {
    const gate = evaluateWriteOperation({
      writeMode: "disabled",
      destructive: false
    });

    expect(gate).toEqual({
      mode: "disabled",
      shouldExecute: false,
      executed: false,
      warnings: ["LEADS2B_WRITE_MODE=disabled; nenhuma escrita será enviada para a Leads2b."]
    });
  });

  it("returns plans without execution in preview mode", () => {
    const gate = evaluateWriteOperation({
      writeMode: "preview",
      destructive: false
    });

    expect(gate).toEqual({
      mode: "preview",
      shouldExecute: false,
      executed: false,
      warnings: ["LEADS2B_WRITE_MODE=preview; operação planejada sem alteração real."]
    });
  });

  it("allows simple creates and updates in live mode", () => {
    const gate = evaluateWriteOperation({
      writeMode: "live",
      destructive: false
    });

    expect(gate).toEqual({
      mode: "live",
      shouldExecute: true,
      executed: false,
      warnings: []
    });
  });

  it("requires explicit confirmation for destructive live operations", () => {
    const blocked = evaluateWriteOperation({
      writeMode: "live",
      destructive: true
    });
    const allowed = evaluateWriteOperation({
      writeMode: "live",
      destructive: true,
      confirmDestructive: true
    });

    expect(blocked.shouldExecute).toBe(false);
    expect(blocked.warnings).toContain("confirm_destructive=true é obrigatório para delete, bulk, merge ou operação destrutiva.");
    expect(allowed.shouldExecute).toBe(true);
    expect(allowed.warnings).toEqual([]);
  });
});

describe("isDestructiveOperation", () => {
  it("flags delete, bulk and merge operations", () => {
    expect(isDestructiveOperation("DELETE", "/customer/123")).toBe(true);
    expect(isDestructiveOperation("POST", "/customers/bulk-update")).toBe(true);
    expect(isDestructiveOperation("PATCH", "/opportunities/merge")).toBe(true);
  });

  it("does not flag simple creates and updates", () => {
    expect(isDestructiveOperation("POST", "/customer")).toBe(false);
    expect(isDestructiveOperation("PATCH", "/customer/123")).toBe(false);
  });
});
