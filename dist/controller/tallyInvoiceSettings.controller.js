"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateTallyInvoiceSettings = exports.getTallyInvoiceSettings = void 0;
const prisma_1 = require("../lib/prisma");
const tallyInvoiceId_1 = require("../lib/tallyInvoiceId");
function parseSequenceFromId(tallyInvoiceId, financialYear) {
    const prefix = `${tallyInvoiceId_1.TALLY_INVOICE_PREFIX}/${financialYear}/`;
    if (!tallyInvoiceId.toUpperCase().startsWith(prefix.toUpperCase()))
        return null;
    const n = Number(tallyInvoiceId.slice(prefix.length));
    return Number.isInteger(n) && n >= 1 ? n : null;
}
const getTallyInvoiceSettings = async (_req, res) => {
    try {
        const financialYear = (0, tallyInvoiceId_1.getShortFinancialYear)(new Date(), tallyInvoiceId_1.TALLY_INVOICE_TIME_ZONE);
        let counter = await prisma_1.prisma.tallyInvoiceCounter.findUnique({
            where: { financialYear },
        });
        if (!counter) {
            counter = await prisma_1.prisma.tallyInvoiceCounter.create({
                data: { financialYear, nextNumber: 1 },
            });
        }
        res.json({
            financialYear,
            nextNumber: counter.nextNumber,
            nextInvoiceIdPreview: (0, tallyInvoiceId_1.formatTallyInvoiceId)(financialYear, counter.nextNumber),
            timeZone: tallyInvoiceId_1.TALLY_INVOICE_TIME_ZONE,
        });
    }
    catch (error) {
        console.error("Error getting tally invoice settings:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.getTallyInvoiceSettings = getTallyInvoiceSettings;
const updateTallyInvoiceSettings = async (req, res) => {
    try {
        const { financialYear: bodyFy, nextNumber } = req.body;
        const financialYear = typeof bodyFy === "string" && /^\d{2}-\d{2}$/.test(bodyFy)
            ? bodyFy
            : (0, tallyInvoiceId_1.getShortFinancialYear)(new Date(), tallyInvoiceId_1.TALLY_INVOICE_TIME_ZONE);
        if (typeof bodyFy === "string" && bodyFy !== financialYear && !/^\d{2}-\d{2}$/.test(bodyFy)) {
            return res.status(400).json({ message: "Invalid financialYear format. Expected YY-YY." });
        }
        if (nextNumber === undefined ||
            nextNumber === null ||
            !Number.isInteger(nextNumber) ||
            nextNumber < 1) {
            return res.status(400).json({ message: "nextNumber must be an integer >= 1" });
        }
        const fyPrefix = `${tallyInvoiceId_1.TALLY_INVOICE_PREFIX}/${financialYear}/`;
        const existingIds = await prisma_1.prisma.order.findMany({
            where: {
                tallyInvoiceId: { startsWith: fyPrefix },
            },
            select: { tallyInvoiceId: true },
        });
        let maxUsed = 0;
        for (const row of existingIds) {
            if (!row.tallyInvoiceId)
                continue;
            const n = parseSequenceFromId(row.tallyInvoiceId, financialYear);
            if (n !== null && n > maxUsed)
                maxUsed = n;
        }
        if (nextNumber <= maxUsed) {
            return res.status(400).json({
                message: `Cannot set next number to ${nextNumber}: highest used ID for ${financialYear} is ${(0, tallyInvoiceId_1.formatTallyInvoiceId)(financialYear, maxUsed)}. Use at least ${maxUsed + 1}.`,
            });
        }
        const counter = await prisma_1.prisma.tallyInvoiceCounter.upsert({
            where: { financialYear },
            create: { financialYear, nextNumber },
            update: { nextNumber },
        });
        res.json({
            financialYear: counter.financialYear,
            nextNumber: counter.nextNumber,
            nextInvoiceIdPreview: (0, tallyInvoiceId_1.formatTallyInvoiceId)(counter.financialYear, counter.nextNumber),
            timeZone: tallyInvoiceId_1.TALLY_INVOICE_TIME_ZONE,
        });
    }
    catch (error) {
        console.error("Error updating tally invoice settings:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.updateTallyInvoiceSettings = updateTallyInvoiceSettings;
//# sourceMappingURL=tallyInvoiceSettings.controller.js.map