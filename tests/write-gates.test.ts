import { describe, expect, it } from "vitest";
import { evaluateWriteGate } from "../src/safety/write-gates.js";

describe("evaluateWriteGate", () => {
  it("defaults to dry-run and does not execute live writes", () => {
    const gate = evaluateWriteGate({
      reason: "Corrigir cadastro solicitado pelo usuário."
    });

    expect(gate).toEqual({
      dryRun: true,
      canExecute: false,
      warnings: ["dry_run=true; nenhuma alteração será enviada para a Leads2b."]
    });
  });

  it("requires confirm_live=true when dry_run is false", () => {
    const gate = evaluateWriteGate({
      dry_run: false,
      reason: "Atualização pontual aprovada."
    });

    expect(gate.canExecute).toBe(false);
    expect(gate.warnings).toContain("confirm_live=true é obrigatório para executar gravação real.");
  });

  it("allows execution only with dry_run=false, confirm_live=true and reason", () => {
    const gate = evaluateWriteGate({
      dry_run: false,
      confirm_live: true,
      reason: "Atualização pontual aprovada."
    });

    expect(gate).toEqual({
      dryRun: false,
      canExecute: true,
      warnings: []
    });
  });
});
