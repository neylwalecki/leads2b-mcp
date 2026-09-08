import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Leads2bHttpError } from "../client/http.js";
import type { Leads2bV1Client } from "../client/v1.js";
import type { Leads2bWriteMode } from "../config.js";
import { evaluateWriteOperation } from "../safety/write-gates.js";
import { okResult, errorResult } from "./result.js";
import { readbackAfterFailure } from "../crud/readback.js";
import { EntityIdSchema, CustomerCreateSchema, CustomerUpdateSchema, ContactCreateSchema, ContactUpdateSchema, LeadCreateSchema, LeadUpdateSchema, OpportunityCreateSchema, OpportunityUpdateSchema } from "../crud/schemas.js";

const entities = [
  { name: "customer", create: "/customer/index", update: "/customer/index", remove: "/customer/index", createSchema: CustomerCreateSchema, updateSchema: CustomerUpdateSchema },
  { name: "lead", create: "/lead", update: "/deal/index", remove: "/lead/index", createSchema: LeadCreateSchema, updateSchema: LeadUpdateSchema },
  { name: "contact", create: "/customer/contact", update: "/customer/contact", remove: "/customer/contact", createSchema: ContactCreateSchema, updateSchema: ContactUpdateSchema },
  { name: "opportunity", create: "/opportunity/index/", update: "/deal/index", remove: "/opportunity/index", createSchema: OpportunityCreateSchema, updateSchema: OpportunityUpdateSchema }
] as const;
export const WRITE_TOOL_NAMES = entities.flatMap(entity => ["create", "update", "delete"].map(action => `leads2b_${action}_${entity.name}`));

type WriteDeps = { v1: Pick<Leads2bV1Client, "rawRequest" | "getLoggedUser">; writeMode: Leads2bWriteMode };

export function registerWriteTools(server: McpServer, deps: WriteDeps): void {
  if (deps.writeMode === "disabled") return;
  for (const entity of entities) {
    for (const action of ["create", "update", "delete"] as const) {
      const destructive = action === "delete";
      const inputSchema: z.ZodRawShape = action === "create" ? { fields: entity.createSchema }
        : destructive ? { id: EntityIdSchema, confirm_destructive: z.boolean().optional() }
        : { id: EntityIdSchema, fields: entity.updateSchema };
      server.registerTool(`leads2b_${action}_${entity.name}`, {
        title: `${action} ${entity.name}`,
        description: `${action} ${entity.name} pela API interna v1 observada no aplicativo. Contrato instável; escrita ainda não validada em conta de teste. Preview retorna plano. Live envia uma única vez${destructive ? " após confirm_destructive=true" : ""}. Releia o registro antes de confirmar persistência.`,
        inputSchema,
        annotations: { readOnlyHint: false, destructiveHint: destructive, idempotentHint: false, openWorldHint: true }
      }, async (input) => {
        let requestSent = false;
        let requestedId: string | number | undefined;
        let requestedFields: Record<string, unknown> | undefined;
        try {
          const id = "id" in input ? EntityIdSchema.parse(input.id) : undefined;
          let fields: Record<string, unknown> | undefined = "fields" in input ? (action === "create" ? entity.createSchema : entity.updateSchema).parse(input.fields) : undefined;
          if (action === "create" && entity.name === "lead" && fields) {
            if (fields.email_contact === undefined && fields.email !== undefined) fields.email_contact = fields.email;
            if (fields.phone_contact === undefined && fields.phone !== undefined) fields.phone_contact = fields.phone;
          }
          const gate = evaluateWriteOperation({ writeMode: deps.writeMode, destructive, confirmDestructive: "confirm_destructive" in input && input.confirm_destructive === true });
          const dealUpdate = action === "update" && (entity.name === "lead" || entity.name === "opportunity");
          const endpoint = action === "create" ? entity.create : dealUpdate ? entity.update : `${destructive ? entity.remove : entity.update}/${id}`;
          const body = dealUpdate ? { deal: { id, type: entity.name.toUpperCase() }, edit_data: fields } : fields;
          const method = action === "create" ? "POST" : destructive ? "DELETE" : "PUT";
          const planned = { operation: `${action}_${entity.name}`, api: "v1", method, endpoint, id, fields, body, mode: gate.mode, executed: false };
          const source = { api: "v1", endpoint, stability: "experimental" } as const;
          if (!gate.shouldExecute) return okResult({ ok: true, data: planned, warnings: gate.warnings, summary: "Operação planejada; nenhuma alteração enviada.", source });
          if (entity.name === "lead" || entity.name === "opportunity") {
            const logged = await deps.v1.getLoggedUser() as { data?: { user?: unknown } };
            const user = Array.isArray(logged?.data?.user) ? logged.data.user[0] : logged?.data?.user;
            if (!user || typeof user !== "object" || !("id" in user) || !user.id) {
              throw new Leads2bHttpError({ endpoint, code: "LEADS2B_USER_CONTEXT_REQUIRED", message: "Esta operação exige token v1 com contexto de usuário. A chave de empresa pode permitir customers/contatos sem permitir CRUD de negócios. Configure um token de usuário autorizado; nenhuma mutação foi enviada." });
            }
          }
          requestedId = id;
          requestedFields = fields;
          requestSent = true;
          const result = await deps.v1.rawRequest({ method, path: endpoint, body });
          const rejected = isBusinessFailure(result);
          const output = okResult({
            ok: true,
            data: { ...planned, executed: true, result, readback: { status: "not_performed" } },
            warnings: rejected ? ["A API devolveu uma rejeição de negócio. Não repita a escrita sem verificar o estado real."] : [],
            summary: rejected ? "Solicitação enviada, mas rejeitada pela API." : "Solicitação enviada; persistência deve ser conferida por releitura.", source
          });
          return rejected ? { ...output, isError: true, structuredContent: { ...output.structuredContent, ok: false } } : output;
        } catch (error) {
          const failure = errorResult(error);
          if (!requestSent) return failure;
          const readback = await readbackAfterFailure(deps.v1, entity.name, requestedId, requestedFields);
          return { ...failure, structuredContent: {
            ...failure.structuredContent,
            writeState: { requestSent: true, outcome: "unknown", automaticRetry: false }, readback,
            warnings: ["Uma resposta de erro não comprova rollback. Confira a releitura antes de repetir a operação."]
          } };
        }
      });
    }
  }
}

function isBusinessFailure(result: unknown): boolean {
  if (typeof result === "string") return /already.?exists|already.?registered|invalid|error/i.test(result);
  if (!result || typeof result !== "object") return false;
  const value = result as Record<string, unknown>;
  return value.success === false || value.ok === false || value.status === false || Boolean(value.error)
    || (value.data !== undefined && isBusinessFailure(value.data));
}
