export type WriteGateInput = {
  dry_run?: boolean;
  confirm_live?: boolean;
  reason?: string;
};

export type WriteGate = {
  dryRun: boolean;
  canExecute: boolean;
  warnings: string[];
};

export function evaluateWriteGate(input: WriteGateInput): WriteGate {
  const dryRun = input.dry_run ?? true;
  const warnings: string[] = [];

  if (dryRun) {
    warnings.push("dry_run=true; nenhuma alteração será enviada para a Leads2b.");
  }

  if (!dryRun && input.confirm_live !== true) {
    warnings.push("confirm_live=true é obrigatório para executar gravação real.");
  }

  if (!input.reason?.trim()) {
    warnings.push("reason é obrigatório para ferramentas de escrita.");
  }

  return {
    dryRun,
    canExecute: !dryRun && input.confirm_live === true && Boolean(input.reason?.trim()),
    warnings
  };
}
