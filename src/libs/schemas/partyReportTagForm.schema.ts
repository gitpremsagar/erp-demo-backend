import { z } from "zod";

const objectIdOrNull = z
  .union([z.string().min(1), z.null()])
  .optional();

export const CreatePartyReportTagSchema = z.object({
  name: z
    .string()
    .min(1, "Tag name is required")
    .max(100, "Tag name must be at most 100 characters long")
    .trim(),
  sortOrder: z.number().int().min(0).optional(),
  headerColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Header color must be a valid hex color")
    .optional(),
  isRegisteredParty: z.boolean().optional(),
  salesOfficerId: objectIdOrNull,
});

export const UpdatePartyReportTagSchema = CreatePartyReportTagSchema.partial();

export const PartyReportTagQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 100)),
  search: z.string().optional(),
});

export const AssignPartiesToTagSchema = z.object({
  customerIds: z.array(z.string().min(1)),
});
