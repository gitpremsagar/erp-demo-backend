"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssignPartiesToTagSchema = exports.PartyReportTagQuerySchema = exports.UpdatePartyReportTagSchema = exports.CreatePartyReportTagSchema = void 0;
const zod_1 = require("zod");
const objectIdOrNull = zod_1.z
    .union([zod_1.z.string().min(1), zod_1.z.null()])
    .optional();
exports.CreatePartyReportTagSchema = zod_1.z.object({
    name: zod_1.z
        .string()
        .min(1, "Tag name is required")
        .max(100, "Tag name must be at most 100 characters long")
        .trim(),
    sortOrder: zod_1.z.number().int().min(0).optional(),
    headerColor: zod_1.z
        .string()
        .regex(/^#[0-9A-Fa-f]{6}$/, "Header color must be a valid hex color")
        .optional(),
    isRegisteredParty: zod_1.z.boolean().optional(),
    salesOfficerId: objectIdOrNull,
});
exports.UpdatePartyReportTagSchema = exports.CreatePartyReportTagSchema.partial();
exports.PartyReportTagQuerySchema = zod_1.z.object({
    page: zod_1.z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
    limit: zod_1.z.string().optional().transform((val) => (val ? parseInt(val, 10) : 100)),
    search: zod_1.z.string().optional(),
});
exports.AssignPartiesToTagSchema = zod_1.z.object({
    customerIds: zod_1.z.array(zod_1.z.string().min(1)),
});
//# sourceMappingURL=partyReportTagForm.schema.js.map