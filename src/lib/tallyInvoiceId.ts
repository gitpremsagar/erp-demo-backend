import type { Prisma } from "@prisma/client";

export const TALLY_INVOICE_TIME_ZONE = "Asia/Kolkata";
export const TALLY_INVOICE_PREFIX = "SGT";

/** Matches SGT/26-27/1 (case-insensitive on prefix). */
export const TALLY_INVOICE_ID_PATTERN = /^SGT\/(\d{2})-(\d{2})\/(\d+)$/i;

type TxClient = Prisma.TransactionClient;

type ZonedDateParts = {
  year: number;
  month: number;
  day: number;
};

function getZonedDateParts(date: Date, timeZone: string): ZonedDateParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? NaN);
  return { year: get("year"), month: get("month"), day: get("day") };
}

/** Short Indian FY label from a date, e.g. "26-27" (1 Apr → 31 Mar). */
export function getShortFinancialYear(
  date: Date,
  timeZone: string = TALLY_INVOICE_TIME_ZONE
): string {
  const parts = getZonedDateParts(date, timeZone);
  if (parts.month >= 4) {
    const start = parts.year % 100;
    const end = (parts.year + 1) % 100;
    return `${String(start).padStart(2, "0")}-${String(end).padStart(2, "0")}`;
  }
  const start = (parts.year - 1) % 100;
  const end = parts.year % 100;
  return `${String(start).padStart(2, "0")}-${String(end).padStart(2, "0")}`;
}

export function formatTallyInvoiceId(financialYear: string, n: number): string {
  return `${TALLY_INVOICE_PREFIX}/${financialYear}/${n}`;
}

export type ParsedTallyInvoiceId = {
  financialYear: string;
  number: number;
  normalized: string;
};

/**
 * Normalize and parse a manual Tally invoice ID.
 * Returns null if empty/whitespace; throws Error with message if invalid format.
 */
export function normalizeTallyInvoiceId(
  raw: string | null | undefined
): ParsedTallyInvoiceId | null {
  if (raw === undefined || raw === null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const match = TALLY_INVOICE_ID_PATTERN.exec(trimmed);
  if (!match) {
    throw new Error(
      "Invalid Tally invoice ID format. Expected SGT/YY-YY/N (e.g. SGT/26-27/1)."
    );
  }

  const startYy = Number(match[1]);
  const endYy = Number(match[2]);
  if ((startYy + 1) % 100 !== endYy) {
    throw new Error(
      "Invalid Tally invoice ID financial year. End year must be start year + 1."
    );
  }

  const number = Number(match[3]);
  if (!Number.isInteger(number) || number < 1) {
    throw new Error("Tally invoice ID sequence number must be a positive integer.");
  }

  const financialYear = `${match[1]}-${match[2]}`;
  return {
    financialYear,
    number,
    normalized: formatTallyInvoiceId(financialYear, number),
  };
}

export async function ensureCounterAtLeast(
  tx: TxClient,
  financialYear: string,
  usedNumber: number
): Promise<void> {
  const minNext = usedNumber + 1;
  const existing = await tx.tallyInvoiceCounter.findUnique({
    where: { financialYear },
  });
  if (!existing) {
    await tx.tallyInvoiceCounter.create({
      data: { financialYear, nextNumber: minNext },
    });
    return;
  }
  if (existing.nextNumber < minNext) {
    await tx.tallyInvoiceCounter.update({
      where: { financialYear },
      data: { nextNumber: minNext },
    });
  }
}

export async function assertTallyInvoiceIdAvailable(
  tx: TxClient,
  tallyInvoiceId: string,
  excludeOrderId?: string
): Promise<void> {
  const conflict = await tx.order.findFirst({
    where: {
      tallyInvoiceId,
      ...(excludeOrderId ? { NOT: { id: excludeOrderId } } : {}),
    },
    select: { id: true },
  });
  if (conflict) {
    throw new Error(`Tally invoice ID ${tallyInvoiceId} is already used by another order.`);
  }
}

/**
 * Resolve the ID to store: use manual value (and bump counter) or allocate next.
 */
export async function resolveTallyInvoiceId(
  tx: TxClient,
  orderDate: Date,
  manualRaw?: string | null,
  excludeOrderId?: string
): Promise<string> {
  const parsed = normalizeTallyInvoiceId(manualRaw ?? null);
  if (parsed) {
    await assertTallyInvoiceIdAvailable(tx, parsed.normalized, excludeOrderId);
    await ensureCounterAtLeast(tx, parsed.financialYear, parsed.number);
    return parsed.normalized;
  }
  return allocateTallyInvoiceId(tx, orderDate);
}

/** Allocate the next Tally invoice ID for the FY of `orderDate`. */
export async function allocateTallyInvoiceId(
  tx: TxClient,
  orderDate: Date
): Promise<string> {
  const financialYear = getShortFinancialYear(orderDate);
  const existing = await tx.tallyInvoiceCounter.findUnique({
    where: { financialYear },
  });

  let nextNumber: number;
  if (!existing) {
    await tx.tallyInvoiceCounter.create({
      data: { financialYear, nextNumber: 2 },
    });
    nextNumber = 1;
  } else {
    nextNumber = existing.nextNumber;
    await tx.tallyInvoiceCounter.update({
      where: { financialYear },
      data: { nextNumber: nextNumber + 1 },
    });
  }

  const id = formatTallyInvoiceId(financialYear, nextNumber);
  await assertTallyInvoiceIdAvailable(tx, id);
  return id;
}

/**
 * Apply a manual tallyInvoiceId update on an existing order (may clear with empty string → no-op for clear;
 * pass null/undefined to leave unchanged; empty string clears only if you want — plan says editable, so
 * empty means clear only when explicitly allowed).
 *
 * Returns the value to set on the order, or undefined if the field was not provided.
 */
export async function resolveManualTallyInvoiceIdUpdate(
  tx: TxClient,
  raw: string | null | undefined,
  excludeOrderId: string
): Promise<string | null | undefined> {
  if (raw === undefined) return undefined;
  if (raw === null || raw.trim() === "") {
    return null;
  }
  const parsed = normalizeTallyInvoiceId(raw);
  if (!parsed) return null;
  await assertTallyInvoiceIdAvailable(tx, parsed.normalized, excludeOrderId);
  await ensureCounterAtLeast(tx, parsed.financialYear, parsed.number);
  return parsed.normalized;
}
