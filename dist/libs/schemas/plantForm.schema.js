"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdatePlantSchema = exports.CreatePlantSchema = void 0;
const zod_1 = require("zod");
// Plant Schema
exports.CreatePlantSchema = zod_1.z.object({
    name: zod_1.z
        .string()
        .min(1, "Plant name is required")
        .max(100, "Plant name must be at most 100 characters long")
        .trim(),
    location: zod_1.z
        .string()
        .max(200, "Location must be at most 200 characters long")
        .trim()
        .optional(),
});
exports.UpdatePlantSchema = exports.CreatePlantSchema.partial();
//# sourceMappingURL=plantForm.schema.js.map