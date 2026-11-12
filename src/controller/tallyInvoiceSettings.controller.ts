import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import {
  formatTallyInvoiceId,
  getShortFinancialYear,
  TALLY_INVOICE_PREFIX,
  TALLY_INVOICE_TIME_ZONE,
} from "../lib/tallyInvoiceId";

function parseSequenceFromId(tallyInvoiceId: string, financialYear: string): number | null {
  const prefix = `${TALLY_INVOICE_PREFIX}/${financialYear}/`;
  if (!tallyInvoiceId.toUpperCase().startsWith(prefix.toUpperCase())) return null;
  const n = Number(tallyInvoiceId.slice(prefix.length));
  return Number.isInteger(n) && n >= 1 ? n : null;
}

export const getTallyInvoiceSettings = async (_req: Request, res: Response) => {
  try {
    const financialYear = getShortFinancialYear(new Date(), TALLY_INVOICE_TIME_ZONE);
    let counter = await prisma.tallyInvoiceCounter.findUnique({
      where: { financialYear },
    });
    if (!counter) {
      counter = await prisma.tallyInvoiceCounter.create({
        data: { financialYear, nextNumber: 1 },
      });
    }

    res.json({
      financialYear,
      nextNumber: counter.nextNumber,
      nextInvoiceIdPreview: formatTallyInvoiceId(financialYear, counter.nextNumber),
      timeZone: TALLY_INVOICE_TIME_ZONE,
    });
  } catch (error) {
    console.error("Error getting tally invoice settings:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const updateTallyInvoiceSettings = async (req: Request, res: Response) => {
  try {
    const { financialYear: bodyFy, nextNumber } = req.body as {
      financialYear?: string;
      nextNumber?: number;
    };

    const financialYear =
      typeof bodyFy === "string" && /^\d{2}-\d{2}$/.test(bodyFy)
        ? bodyFy
        : getShortFinancialYear(new Date(), TALLY_INVOICE_TIME_ZONE);

    if (typeof bodyFy === "string" && bodyFy !== financialYear && !/^\d{2}-\d{2}$/.test(bodyFy)) {
      return res.status(400).json({ message: "Invalid financialYear format. Expected YY-YY." });
    }

    if (
      nextNumber === undefined ||
      nextNumber === null ||
      !Number.isInteger(nextNumber) ||
      nextNumber < 1
    ) {
      return res.status(400).json({ message: "nextNumber must be an integer >= 1" });
    }

    const fyPrefix = `${TALLY_INVOICE_PREFIX}/${financialYear}/`;
    const existingIds = await prisma.order.findMany({
      where: {
        tallyInvoiceId: { startsWith: fyPrefix },
      },
      select: { tallyInvoiceId: true },
    });

    let maxUsed = 0;
    for (const row of existingIds) {
      if (!row.tallyInvoiceId) continue;
      const n = parseSequenceFromId(row.tallyInvoiceId, financialYear);
      if (n !== null && n > maxUsed) maxUsed = n;
    }

    if (nextNumber <= maxUsed) {
      return res.status(400).json({
        message: `Cannot set next number to ${nextNumber}: highest used ID for ${financialYear} is ${formatTallyInvoiceId(financialYear, maxUsed)}. Use at least ${maxUsed + 1}.`,
      });
    }

    const counter = await prisma.tallyInvoiceCounter.upsert({
      where: { financialYear },
      create: { financialYear, nextNumber },
      update: { nextNumber },
    });

    res.json({
      financialYear: counter.financialYear,
      nextNumber: counter.nextNumber,
      nextInvoiceIdPreview: formatTallyInvoiceId(counter.financialYear, counter.nextNumber),
      timeZone: TALLY_INVOICE_TIME_ZONE,
    });
  } catch (error) {
    console.error("Error updating tally invoice settings:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
