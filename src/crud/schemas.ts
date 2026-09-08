import { z } from "zod";

export const EntityIdSchema = z.union([z.number().int().positive().max(Number.MAX_SAFE_INTEGER), z.string().regex(/^[1-9]\d*$/)]);
const text = z.string().nullable().optional();
const id = EntityIdSchema.nullable().optional();
const custom = z.record(z.string(), z.unknown()).optional();
const base = { name: z.string().trim().min(1).optional(), email: text, phone: text, parameters: custom, custom_fields: custom };
const customer = z.strictObject({
  ...base, type: z.enum(["PERSON", "ORGANIZATION"]).optional(), company_name: text,
  cpf: text, cnpj: text, cel_phone: text, id_user: id, id_group: id, id_parent: id,
  zipcode: text, address: text, number: text, complement: text, neighborhood: text,
  city: text, city_ibge: text, id_state: id, ie: text
});
const contact = z.strictObject({
  ...base, id_customer: EntityIdSchema.optional(), address: text, id_department: id,
  active: z.union([z.literal("0"), z.literal("1"), z.literal(0), z.literal(1)]).optional()
});
const deal = z.strictObject({
  ...base, name_contact: z.string().trim().min(1).optional(), company_name: text,
  email_contact: text, phone_contact: text, cnpj: text, description: text,
  id_customer: z.union([EntityIdSchema, z.literal("")]).optional(),
  id_contact: z.union([EntityIdSchema, z.literal("new")]).optional(),
  id_pipeline: EntityIdSchema.optional(), id_pipeline_item: EntityIdSchema.optional(),
  id_user: EntityIdSchema.optional(), id_group: id, id_origin: id,
  tags: z.array(EntityIdSchema).optional(), expected_close_date: z.iso.date().nullable().optional()
});
const nonempty = <T extends z.ZodRawShape>(schema: z.ZodObject<T>) => schema.refine(value => Object.values(value).some(v => v !== undefined), "Informe ao menos um campo.");
export const CustomerCreateSchema = customer.extend({ name: z.string().trim().min(1), type: z.enum(["PERSON", "ORGANIZATION"]) });
export const CustomerUpdateSchema = nonempty(customer);
export const ContactCreateSchema = contact.extend({ name: z.string().trim().min(1), id_customer: EntityIdSchema });
export const ContactUpdateSchema = nonempty(contact);
// Account rules can require additional custom fields. No pipeline, owner or linked identity is invented.
export const LeadCreateSchema = deal.extend({ name_contact: z.string().trim().min(1), id_pipeline: EntityIdSchema, id_pipeline_item: EntityIdSchema, id_user: EntityIdSchema });
export const OpportunityCreateSchema = LeadCreateSchema;
const dealUpdate = {
  email: text, phone: text, company_name: text, cnpj: text, id_origin: id,
  id_user: EntityIdSchema.optional(), id_pipeline: EntityIdSchema.optional(),
  id_pipeline_item: EntityIdSchema.optional(), expected_close_date: z.iso.date().nullable().optional(),
  parameters: custom, custom_fields: custom
};
export const LeadUpdateSchema = nonempty(z.strictObject({ ...dealUpdate, name: z.string().trim().min(1).optional(), interest: text }));
export const OpportunityUpdateSchema = nonempty(z.strictObject({ ...dealUpdate, description: text }));
