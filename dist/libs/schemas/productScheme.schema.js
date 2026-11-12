"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductSchemeQuerySchema = exports.UpdateProductSchemeSchema = exports.CreateProductSchemeSchema = void 0;
const zod_1 = require("zod");
const schemeDates_1 = require("../../lib/schemeDates");
const slabRangeSchema = zod_1.z.object({
    minCb: zod_1.z.number().int().min(0, "minCb must be >= 0"),
    maxCb: zod_1.z.number().int().min(0, "maxCb must be >= 0"),
    percent: zod_1.z.number().min(0, "percent cannot be negative").max(100, "percent cannot exceed 100"),
}).refine((data) => data.maxCb >= data.minCb, {
    message: "maxCb must be greater than or equal to minCb",
    path: ["maxCb"],
});
/** All keys missing — caller did not send this slab (partial PATCH). */
function slabTripleOmit(t) {
    return t.minCb === undefined && t.maxCb === undefined && t.percent === undefined;
}
/** Explicitly cleared or not sent as numbers (null counts as “unused slab” for slabs 2–4). */
function slabTripleEmpty(t) {
    if (slabTripleOmit(t))
        return false;
    const vals = [t.minCb, t.maxCb, t.percent];
    return vals.every((v) => v === null || v === undefined);
}
function slabTripleComplete(t) {
    const vals = [t.minCb, t.maxCb, t.percent];
    return vals.every((v) => typeof v === "number" && Number.isFinite(v));
}
function slabTriplePartial(t) {
    if (slabTripleOmit(t) || slabTripleEmpty(t) || slabTripleComplete(t))
        return false;
    return true;
}
function slabTripleMentioned(t) {
    return !slabTripleOmit(t);
}
const optionalSlabIntCreate = zod_1.z.union([zod_1.z.number().int().min(0), zod_1.z.null()]).optional();
const optionalSlabPctCreate = zod_1.z.union([zod_1.z.number().min(0).max(100), zod_1.z.null()]).optional();
exports.CreateProductSchemeSchema = zod_1.z.object({
    // Legacy fallback: if present, it can be used when slabs are missing.
    schemePercentage: zod_1.z.number().min(0).max(100).optional(),
    slab1MinCb: zod_1.z.number().int().min(0),
    slab1MaxCb: zod_1.z.number().int().min(0),
    slab1Percent: zod_1.z.number().min(0).max(100),
    slab2MinCb: optionalSlabIntCreate,
    slab2MaxCb: optionalSlabIntCreate,
    slab2Percent: optionalSlabPctCreate,
    slab3MinCb: optionalSlabIntCreate,
    slab3MaxCb: optionalSlabIntCreate,
    slab3Percent: optionalSlabPctCreate,
    slab4MinCb: optionalSlabIntCreate,
    slab4MaxCb: optionalSlabIntCreate,
    slab4Percent: optionalSlabPctCreate,
    startDate: zod_1.z
        .string()
        .or(zod_1.z.date())
        .transform((val) => (0, schemeDates_1.normalizeSchemeStart)(val)),
    endDate: zod_1.z
        .string()
        .or(zod_1.z.date())
        .transform((val) => (0, schemeDates_1.normalizeSchemeEnd)(val)),
    isActive: zod_1.z.boolean().optional().default(false),
    productId: zod_1.z
        .string()
        .min(24, "Invalid product ID")
        .max(24, "Invalid product ID"),
}).refine((data) => data.endDate > data.startDate, {
    message: "End date must be after start date",
    path: ["endDate"],
}).refine((data) => {
    const triples = [
        { minCb: data.slab1MinCb, maxCb: data.slab1MaxCb, percent: data.slab1Percent },
        { minCb: data.slab2MinCb, maxCb: data.slab2MaxCb, percent: data.slab2Percent },
        { minCb: data.slab3MinCb, maxCb: data.slab3MaxCb, percent: data.slab3Percent },
        { minCb: data.slab4MinCb, maxCb: data.slab4MaxCb, percent: data.slab4Percent },
    ];
    for (const t of triples) {
        if (slabTriplePartial(t))
            return false;
    }
    // Slabs 2–4: no “complete” slab after an unused one (null / omitted).
    let seenUnused = false;
    for (let i = 1; i < 4; i++) {
        const t = triples[i];
        if (slabTripleOmit(t) || slabTripleEmpty(t)) {
            seenUnused = true;
        }
        else if (slabTripleComplete(t)) {
            if (seenUnused)
                return false;
        }
    }
    const active = triples
        .filter((t) => slabTripleComplete(t))
        .map((t) => ({
        minCb: t.minCb,
        maxCb: t.maxCb,
        percent: t.percent,
    }));
    for (const slab of active) {
        if (!slabRangeSchema.safeParse(slab).success)
            return false;
    }
    for (let i = 0; i < active.length; i++) {
        for (let j = i + 1; j < active.length; j++) {
            const a = active[i];
            const b = active[j];
            const overlap = a.minCb <= b.maxCb && b.minCb <= a.maxCb;
            if (overlap)
                return false;
        }
    }
    return true;
}, {
    message: "Invalid slabs: ranges must not overlap; optional slabs must be unused from the end only",
    path: [],
});
const optionalSlabIntUpdate = zod_1.z.union([zod_1.z.number().int().min(0), zod_1.z.null()]).optional();
const optionalSlabPctUpdate = zod_1.z.union([zod_1.z.number().min(0).max(100), zod_1.z.null()]).optional();
exports.UpdateProductSchemeSchema = zod_1.z.object({
    // Legacy fallback: if present, can be used when slabs are missing.
    schemePercentage: zod_1.z.number().min(0).max(100).optional(),
    slab1MinCb: optionalSlabIntUpdate,
    slab1MaxCb: optionalSlabIntUpdate,
    slab1Percent: optionalSlabPctUpdate,
    slab2MinCb: optionalSlabIntUpdate,
    slab2MaxCb: optionalSlabIntUpdate,
    slab2Percent: optionalSlabPctUpdate,
    slab3MinCb: optionalSlabIntUpdate,
    slab3MaxCb: optionalSlabIntUpdate,
    slab3Percent: optionalSlabPctUpdate,
    slab4MinCb: optionalSlabIntUpdate,
    slab4MaxCb: optionalSlabIntUpdate,
    slab4Percent: optionalSlabPctUpdate,
    startDate: zod_1.z
        .string()
        .or(zod_1.z.date())
        .transform((val) => (0, schemeDates_1.normalizeSchemeStart)(val))
        .optional(),
    endDate: zod_1.z
        .string()
        .or(zod_1.z.date())
        .transform((val) => (0, schemeDates_1.normalizeSchemeEnd)(val))
        .optional(),
    isActive: zod_1.z.boolean().optional(),
    productId: zod_1.z
        .string()
        .min(24, "Invalid product ID")
        .max(24, "Invalid product ID")
        .optional(),
}).refine((data) => {
    if (data.startDate && data.endDate) {
        return data.endDate > data.startDate;
    }
    return true;
}, {
    message: "End date must be after start date",
    path: ["endDate"],
}).refine((data) => {
    const triples = [
        { minCb: data.slab1MinCb, maxCb: data.slab1MaxCb, percent: data.slab1Percent },
        { minCb: data.slab2MinCb, maxCb: data.slab2MaxCb, percent: data.slab2Percent },
        { minCb: data.slab3MinCb, maxCb: data.slab3MaxCb, percent: data.slab3Percent },
        { minCb: data.slab4MinCb, maxCb: data.slab4MaxCb, percent: data.slab4Percent },
    ];
    const anyMentioned = triples.some(slabTripleMentioned);
    if (!anyMentioned)
        return true;
    for (const t of triples) {
        if (slabTriplePartial(t))
            return false;
    }
    const anyHigherMentioned = triples.slice(1).some(slabTripleMentioned);
    if (anyHigherMentioned && !slabTripleComplete(triples[0]))
        return false;
    // If slab 1 is mentioned, it must be complete (not cleared).
    if (slabTripleMentioned(triples[0]) && !slabTripleComplete(triples[0]))
        return false;
    if (slabTripleComplete(triples[0])) {
        if (!slabRangeSchema.safeParse({
            minCb: triples[0].minCb,
            maxCb: triples[0].maxCb,
            percent: triples[0].percent,
        }).success)
            return false;
    }
    // If a higher slab is mentioned, lower slabs 2–3 must also be mentioned (no gaps in the payload).
    if (slabTripleMentioned(triples[3]) && !slabTripleMentioned(triples[2]))
        return false;
    if (slabTripleMentioned(triples[2]) && !slabTripleMentioned(triples[1]))
        return false;
    // No complete slab after an empty optional slab (2–4).
    let seenUnused = false;
    for (let i = 1; i < 4; i++) {
        const t = triples[i];
        if (!slabTripleMentioned(t))
            continue;
        if (slabTripleEmpty(t)) {
            seenUnused = true;
        }
        else if (slabTripleComplete(t)) {
            if (seenUnused)
                return false;
            if (!slabRangeSchema.safeParse({
                minCb: t.minCb,
                maxCb: t.maxCb,
                percent: t.percent,
            }).success)
                return false;
        }
    }
    const active = triples
        .filter((t) => slabTripleComplete(t))
        .map((t) => ({
        minCb: t.minCb,
        maxCb: t.maxCb,
        percent: t.percent,
    }));
    for (let i = 0; i < active.length; i++) {
        for (let j = i + 1; j < active.length; j++) {
            const a = active[i];
            const b = active[j];
            const overlap = a.minCb <= b.maxCb && b.minCb <= a.maxCb;
            if (overlap)
                return false;
        }
    }
    return true;
}, {
    message: "Invalid slab configuration (ranges must not overlap; each slab must be complete or fully cleared)",
    path: [],
});
exports.ProductSchemeQuerySchema = zod_1.z.object({
    page: zod_1.z.string().optional().transform(val => val ? parseInt(val) : 1),
    limit: zod_1.z.string().optional().transform(val => val ? parseInt(val) : 10),
    productId: zod_1.z.string().optional(),
    isActive: zod_1.z.string().optional().transform(val => val === "true" ? true : val === "false" ? false : undefined),
});
//# sourceMappingURL=productScheme.schema.js.map