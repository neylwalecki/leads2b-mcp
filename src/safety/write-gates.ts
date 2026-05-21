import type { Leads2bWriteMode } from "../config.js";
import type { Leads2bHttpMethod } from "../client/http.js";

export type WriteOperationInput = {
  writeMode: Leads2bWriteMode;
  destructive: boolean;
  confirmDestructive?: boolean;
};

export type WriteOperationGate = {
  mode: Leads2bWriteMode;
  shouldExecute: boolean;
  executed: boolean;
  warnings: string[];
};

export function evaluateWriteOperation(input: WriteOperationInput): WriteOperationGate {
  const warnings: string[] = [];

  if (input.writeMode === "disabled") {
    warnings.push("LEADS2B_WRITE_MODE=disabled; nenhuma escrita será enviada para a Leads2b.");
  }

  if (input.writeMode === "preview") {
    warnings.push("LEADS2B_WRITE_MODE=preview; operação planejada sem alteração real.");
  }

  if (input.writeMode === "live" && input.destructive && input.confirmDestructive !== true) {
    warnings.push("confirm_destructive=true é obrigatório para delete, bulk, merge ou operação destrutiva.");
  }

  return {
    mode: input.writeMode,
    shouldExecute:
      input.writeMode === "live" && (!input.destructive || input.confirmDestructive === true),
    executed: false,
    warnings
  };
}

export function isDestructiveOperation(method: Leads2bHttpMethod, path: string): boolean {
  if (method === "DELETE") {
    return true;
  }

  const normalizedPath = path.toLowerCase();
  return /(^|[/?_-])(bulk|delete|destroy|merge)([/?_-]|$)/.test(normalizedPath);
}
