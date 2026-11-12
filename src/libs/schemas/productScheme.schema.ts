import { z } from "zod";
import { normalizeSchemeEnd, normalizeSchemeStart } from "../../lib/schemeDates";

const slabRangeSchema = z.object({
  minCb: z.number().int().min(0, "minCb must be >= 0"),
  maxCb: z.number().int().min(0, "maxCb must be >= 0"),
  percent: z.number().min(0, "percent cannot be negative").max(100, "percent cannot exceed 100"),
}).refine((data) => data.maxCb >= data.minCb, {
  message: "maxCb must be greater than or equal to minCb",
  path: ["maxCb"],
});

type SlabTriple = { minCb: unknown; maxCb: unknown; percent: unknown };

/** All keys missing — caller did not send this slab (partial PATCH). */
function slabTripleOmit(t: SlabTriple): boolean {
  return t.minCb === undefined && t.maxCb === undefined && t.percent === undefined;
}

/** Explicitly cleared or not sent as numbers (null counts as “unused slab” for slabs 2–4). */
function slabTripleEmpty(t: SlabTriple): boolean {
  if (slabTripleOmit(t)) return false;
  const vals = [t.minCb, t.maxCb, t.percent];
  return vals.every((v) => v === null || v === undefined);
}

function slabTripleComplete(t: SlabTriple): boolean {
  const vals = [t.minCb, t.maxCb, t.percent];
  return vals.every((v) => typeof v === "number" && Number.isFinite(v));
}

function slabTriplePartial(t: SlabTriple): boolean {
  if (slabTripleOmit(t) || slabTripleEmpty(t) || slabTripleComplete(t)) return false;
  return true;
}

function slabTripleMentioned(t: SlabTriple): boolean {
  return !slabTripleOmit(t);
}

const optionalSlabIntCreate = z.union([z.number().int().min(0), z.null()]).optional();
const optionalSlabPctCreate = z.union([z.number().min(0).max(100), z.null()]).optional();

export const CreateProductSchemeSchema = z.object({
  // Legacy fallback: if present, it can be used when slabs are missing.
  schemePercentage: z.number().min(0).max(100).optional(),

  slab1MinCb: z.number().int().min(0),
  slab1MaxCb: z.number().int().min(0),
  slab1Percent: z.number().min(0).max(100),

  slab2MinCb: optionalSlabIntCreate,
  slab2MaxCb: optionalSlabIntCreate,
  slab2Percent: optionalSlabPctCreate,

  slab3MinCb: optionalSlabIntCreate,
  slab3MaxCb: optionalSlabIntCreate,
  slab3Percent: optionalSlabPctCreate,

  slab4MinCb: optionalSlabIntCreate,
  slab4MaxCb: optionalSlabIntCreate,
  slab4Percent: optionalSlabPctCreate,

  startDate: z
    .string()
    .or(z.date())
    .transform((val) => normalizeSchemeStart(val)),
  endDate: z
    .string()
    .or(z.date())
    .transform((val) => normalizeSchemeEnd(val)),
  isActive: z.boolean().optional().default(false),
  productId: z
    .string()
    .min(24, "Invalid product ID")
    .max(24, "Invalid product ID"),
}).refine((data) => data.endDate > data.startDate, {
  message: "End date must be after start date",
  path: ["endDate"],
}).refine((data) => {
  const triples: SlabTriple[] = [
    { minCb: data.slab1MinCb, maxCb: data.slab1MaxCb, percent: data.slab1Percent },
    { minCb: data.slab2MinCb, maxCb: data.slab2MaxCb, percent: data.slab2Percent },
    { minCb: data.slab3MinCb, maxCb: data.slab3MaxCb, percent: data.slab3Percent },
    { minCb: data.slab4MinCb, maxCb: data.slab4MaxCb, percent: data.slab4Percent },
  ];

  for (const t of triples) {
    if (slabTriplePartial(t)) return false;
  }

  // Slabs 2–4: no “complete” slab after an unused one (null / omitted).
  let seenUnused = false;
  for (let i = 1; i < 4; i++) {
    const t = triples[i];
    if (slabTripleOmit(t) || slabTripleEmpty(t)) {
      seenUnused = true;
    } else if (slabTripleComplete(t)) {
      if (seenUnused) return false;
    }
  }

  const active = triples
    .filter((t) => slabTripleComplete(t))
    .map((t) => ({
      minCb: t.minCb as number,
      maxCb: t.maxCb as number,
      percent: t.percent as number,
    }));

  for (const slab of active) {
    if (!slabRangeSchema.safeParse(slab).success) return false;
  }

  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i];
      const b = active[j];
      const overlap = a.minCb <= b.maxCb && b.minCb <= a.maxCb;
      if (overlap) return false;
    }
  }

  return true;
}, {
  message: "Invalid slabs: ranges must not overlap; optional slabs must be unused from the end only",
  path: [],
});

const optionalSlabIntUpdate = z.union([z.number().int().min(0), z.null()]).optional();
const optionalSlabPctUpdate = z.union([z.number().min(0).max(100), z.null()]).optional();

export const UpdateProductSchemeSchema = z.object({
  // Legacy fallback: if present, can be used when slabs are missing.
  schemePercentage: z.number().min(0).max(100).optional(),

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

  startDate: z
    .string()
    .or(z.date())
    .transform((val) => normalizeSchemeStart(val))
    .optional(),
  endDate: z
    .string()
    .or(z.date())
    .transform((val) => normalizeSchemeEnd(val))
    .optional(),
  isActive: z.boolean().optional(),
  productId: z
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
  const triples: SlabTriple[] = [
    { minCb: data.slab1MinCb, maxCb: data.slab1MaxCb, percent: data.slab1Percent },
    { minCb: data.slab2MinCb, maxCb: data.slab2MaxCb, percent: data.slab2Percent },
    { minCb: data.slab3MinCb, maxCb: data.slab3MaxCb, percent: data.slab3Percent },
    { minCb: data.slab4MinCb, maxCb: data.slab4MaxCb, percent: data.slab4Percent },
  ];

  const anyMentioned = triples.some(slabTripleMentioned);
  if (!anyMentioned) return true;

  for (const t of triples) {
    if (slabTriplePartial(t)) return false;
  }

  const anyHigherMentioned = triples.slice(1).some(slabTripleMentioned);
  if (anyHigherMentioned && !slabTripleComplete(triples[0])) return false;

  // If slab 1 is mentioned, it must be complete (not cleared).
  if (slabTripleMentioned(triples[0]) && !slabTripleComplete(triples[0])) return false;
  if (slabTripleComplete(triples[0])) {
    if (!slabRangeSchema.safeParse({
      minCb: triples[0].minCb as number,
      maxCb: triples[0].maxCb as number,
      percent: triples[0].percent as number,
    }).success) return false;
  }

  // If a higher slab is mentioned, lower slabs 2–3 must also be mentioned (no gaps in the payload).
  if (slabTripleMentioned(triples[3]) && !slabTripleMentioned(triples[2])) return false;
  if (slabTripleMentioned(triples[2]) && !slabTripleMentioned(triples[1])) return false;

  // No complete slab after an empty optional slab (2–4).
  let seenUnused = false;
  for (let i = 1; i < 4; i++) {
    const t = triples[i];
    if (!slabTripleMentioned(t)) continue;
    if (slabTripleEmpty(t)) {
      seenUnused = true;
    } else if (slabTripleComplete(t)) {
      if (seenUnused) return false;
      if (!slabRangeSchema.safeParse({
        minCb: t.minCb as number,
        maxCb: t.maxCb as number,
        percent: t.percent as number,
      }).success) return false;
    }
  }

  const active = triples
    .filter((t) => slabTripleComplete(t))
    .map((t) => ({
      minCb: t.minCb as number,
      maxCb: t.maxCb as number,
      percent: t.percent as number,
    }));

  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i];
      const b = active[j];
      const overlap = a.minCb <= b.maxCb && b.minCb <= a.maxCb;
      if (overlap) return false;
    }
  }

  return true;
}, {
  message: "Invalid slab configuration (ranges must not overlap; each slab must be complete or fully cleared)",
  path: [],
});

export const ProductSchemeQuerySchema = z.object({
  page: z.string().optional().transform(val => val ? parseInt(val) : 1),
  limit: z.string().optional().transform(val => val ? parseInt(val) : 10),
  productId: z.string().optional(),
  isActive: z.string().optional().transform(val => val === "true" ? true : val === "false" ? false : undefined),
});
