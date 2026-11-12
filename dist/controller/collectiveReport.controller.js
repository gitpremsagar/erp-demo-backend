"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bulkUpsertCollectiveReport = exports.getCollectiveReport = void 0;
const prisma_1 = require("../lib/prisma");
const monthWisePurchaseReportAmount_1 = require("../lib/monthWisePurchaseReportAmount");
const monthWiseSalesReportAmount_1 = require("../lib/monthWiseSalesReportAmount");
const orderSaleAmount_1 = require("../lib/orderSaleAmount");
const financialYearWindow_1 = require("../lib/financialYearWindow");
const historicalMonthWiseReports_1 = require("../data/historicalMonthWiseReports");
const collectiveReportHardcoded_1 = require("../data/collectiveReportHardcoded");
const AMOUNT_FIELDS = [
    "shipmentTarget",
    "cdReceivedAmount",
    "rssReceivedAmount",
    "monSchemeReceivedAmount",
    "monSchemeReleasedAmount",
];
const DATE_FIELDS = ["cdReceivedDate", "rssReceivedDate", "monSchemeReleaseDate"];
const REMARK_FIELDS = ["shipmentRemark", "primaryRemark"];
function isValidFinancialYear(fy) {
    if (typeof fy !== "string")
        return false;
    const match = /^(\d{4})-(\d{2})$/.exec(fy);
    if (!match)
        return false;
    return (Number(match[1]) + 1) % 100 === Number(match[2]);
}
function percent(numerator, denominator) {
    if (denominator === null || denominator <= 0)
        return null;
    return (numerator / denominator) * 100;
}
function sumNullable(values) {
    if (values.every((v) => v === null))
        return null;
    return values.reduce((sum, v) => sum + (v ?? 0), 0);
}
function toQuarters(months, combine) {
    return [0, 1, 2, 3].map((q) => combine(months.slice(q * 3, q * 3 + 3)));
}
function combineTotals(cells) {
    return {
        target: sumNullable(cells.map((c) => c.target)),
        dms: sumNullable(cells.map((c) => c.dms)),
        tally: cells.reduce((s, c) => s + c.tally, 0),
    };
}
function combineShipment(cells) {
    const target = sumNullable(cells.map((m) => m.target));
    const achieved = cells.reduce((s, m) => s + m.achieved, 0);
    return {
        target,
        achieved,
        achievePercent: percent(achieved, target),
        cdReceivedDate: null,
        cdReceivedAmount: sumNullable(cells.map((m) => m.cdReceivedAmount)),
        rssReceivedDate: null,
        rssReceivedAmount: sumNullable(cells.map((m) => m.rssReceivedAmount)),
        remark: null,
    };
}
function combinePrimary(cells) {
    const target = sumNullable(cells.map((m) => m.target));
    const dms = sumNullable(cells.map((m) => m.dms));
    return {
        target,
        dms,
        achievePercent: percent(dms ?? 0, target),
        tally: cells.reduce((s, m) => s + m.tally, 0),
        monSchemeReleaseDate: null,
        monSchemeReceivedAmount: sumNullable(cells.map((m) => m.monSchemeReceivedAmount)),
        monSchemeReleasedAmount: sumNullable(cells.map((m) => m.monSchemeReleasedAmount)),
        remark: null,
    };
}
function combinePartyCells(cells) {
    const target = sumNullable(cells.map((m) => m.target));
    const dms = sumNullable(cells.map((m) => m.dms));
    return {
        target,
        dms,
        achievePercent: percent(dms ?? 0, target),
        tally: cells.reduce((s, m) => s + m.tally, 0),
        remark: null,
    };
}
function partyTotals(members) {
    const months = Array.from({ length: 12 }, (_, i) => ({
        target: sumNullable(members.map((p) => p.months[i].target)),
        dms: sumNullable(members.map((p) => p.months[i].dms)),
        tally: members.reduce((sum, p) => sum + p.months[i].tally, 0),
    }));
    return { months, quarters: toQuarters(months, combineTotals) };
}
function splitAmountOrText(value) {
    if (typeof value === "number")
        return { amount: value, text: null };
    return { amount: null, text: value };
}
function joinRemarks(...parts) {
    const present = parts.filter((p) => !!p);
    return present.length > 0 ? present.join(" | ") : null;
}
const normalizeName = (name) => name.toLowerCase().replace(/[^a-z0-9]/g, "");
async function buildHardcodedCollectiveReport(financialYear, snapshot, timeZone) {
    const buckets = (0, monthWiseSalesReportAmount_1.buildFyMonthBuckets)(financialYear, timeZone);
    const [customers, customerDetails, groups] = await Promise.all([
        prisma_1.prisma.user.findMany({ where: { userType: "CUSTOMER" }, select: { id: true, name: true } }),
        prisma_1.prisma.customerDetail.findMany({ select: { dbUserId: true, dbName: true } }),
        prisma_1.prisma.collectiveReportGroup.findMany({
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
            include: { members: { select: { customerId: true } } },
        }),
    ]);
    const customerIdByName = new Map();
    for (const c of customers)
        customerIdByName.set(normalizeName(c.name), c.id);
    for (const cd of customerDetails) {
        if (cd.dbName)
            customerIdByName.set(normalizeName(cd.dbName), cd.dbUserId);
    }
    const nameByCustomer = new Map(customers.map((c) => [c.id, c.name]));
    for (const cd of customerDetails)
        if (cd.dbName)
            nameByCustomer.set(cd.dbUserId, cd.dbName);
    const groupIdByCustomer = new Map();
    for (const group of groups) {
        for (const member of group.members)
            groupIdByCustomer.set(member.customerId, group.id);
    }
    const shipmentMonths = snapshot.shipment.months.map(([target, achieve, remark]) => ({
        target,
        achieved: achieve ?? 0,
        achievePercent: percent(achieve ?? 0, target),
        cdReceivedDate: null,
        cdReceivedAmount: null,
        rssReceivedDate: null,
        rssReceivedAmount: null,
        remark,
    }));
    const shipmentQuarters = toQuarters(shipmentMonths, combineShipment).map((cell, q) => {
        const [remark, incentive] = snapshot.shipment.quarters[q];
        const { amount, text } = splitAmountOrText(incentive);
        const incentiveLabel = amount !== null ? `Incentive: ${amount.toLocaleString("en-IN")}` : text ? `Incentive: ${text}` : null;
        return { ...cell, remark: joinRemarks(remark, incentiveLabel) };
    });
    const primaryMonths = snapshot.primary.months.map(([target, dms, tally, scheme]) => {
        const { amount, text } = splitAmountOrText(scheme);
        return {
            target,
            dms,
            achievePercent: percent(dms ?? 0, target),
            tally: tally ?? 0,
            monSchemeReleaseDate: null,
            monSchemeReceivedAmount: null,
            monSchemeReleasedAmount: amount,
            remark: text,
        };
    });
    const primaryQuarters = toQuarters(primaryMonths, combinePrimary);
    const parties = snapshot.parties.map((party, index) => {
        const months = party.months.map(([target, dms, tally, scheme]) => {
            const { amount, text } = splitAmountOrText(scheme);
            return {
                target,
                dms,
                achievePercent: percent(dms ?? 0, target),
                tally: tally ?? 0,
                remark: text,
                monSchemeReleasedAmount: amount,
            };
        });
        const quarters = toQuarters(months, combinePartyCells).map((cell, q) => {
            const [remark, scheme] = party.quarters[q];
            const { amount, text } = splitAmountOrText(scheme);
            return {
                ...cell,
                remark: joinRemarks(remark, text ? `Scheme: ${text}` : null),
                monSchemeReleasedAmount: amount,
            };
        });
        const customerId = customerIdByName.get(normalizeName(party.customerName ?? party.name));
        return {
            customerId: customerId ?? `hist-${financialYear}-p${index + 1}`,
            groupId: customerId ? groupIdByCustomer.get(customerId) ?? null : null,
            partyName: customerId ? nameByCustomer.get(customerId) ?? party.name : party.name,
            months,
            quarters,
            total: months.reduce((s, m) => s + m.tally, 0),
        };
    });
    parties.sort((a, b) => a.partyName.localeCompare(b.partyName));
    return {
        financialYear,
        editable: false,
        months: buckets.map((b) => ({ monthIndex: b.monthIndex, monthLabel: b.monthLabel })),
        shipment: { months: shipmentMonths, quarters: shipmentQuarters },
        primary: { months: primaryMonths, quarters: primaryQuarters },
        parties,
        grandTotal: partyTotals(parties),
        groups: groups.map((group) => ({
            id: group.id,
            name: group.name,
            sortOrder: group.sortOrder,
            total: partyTotals(parties.filter((p) => p.groupId === group.id)),
        })),
        ungroupedTotal: partyTotals(parties.filter((p) => p.groupId === null)),
        entries: buckets.map((_, i) => ({
            monthIndex: i,
            shipmentTarget: shipmentMonths[i].target,
            cdReceivedDate: null,
            cdReceivedAmount: null,
            rssReceivedDate: null,
            rssReceivedAmount: null,
            shipmentRemark: shipmentMonths[i].remark,
            monSchemeReleaseDate: null,
            monSchemeReceivedAmount: null,
            monSchemeReleasedAmount: primaryMonths[i].monSchemeReleasedAmount,
            primaryRemark: primaryMonths[i].remark,
        })),
    };
}
const salesReturnInclude = {
    SalesReturnItem: { select: { productId: true, quantity: true } },
    order: { select: monthWiseSalesReportAmount_1.RETURN_CREDIT_ORDER_SELECT },
};
const creditNoteInclude = {
    CreditNoteItem: { select: { productId: true, quantity: true } },
    order: { select: monthWiseSalesReportAmount_1.RETURN_CREDIT_ORDER_SELECT },
};
const getCollectiveReport = async (req, res) => {
    try {
        const timeZone = (0, orderSaleAmount_1.resolveSafeTimeZone)(typeof req.query.timeZone === "string" ? req.query.timeZone : undefined);
        const financialYear = isValidFinancialYear(req.query.financialYear)
            ? req.query.financialYear
            : (0, financialYearWindow_1.fyFromDate)(new Date(), timeZone);
        const snapshot = (0, collectiveReportHardcoded_1.getHardcodedCollectiveReport)(financialYear);
        if (snapshot) {
            return res.json(await buildHardcodedCollectiveReport(financialYear, snapshot, timeZone));
        }
        const buckets = (0, monthWiseSalesReportAmount_1.buildFyMonthBuckets)(financialYear, timeZone);
        const queryStart = (0, monthWiseSalesReportAmount_1.getMarchPriorFyBucket)(financialYear, timeZone).start;
        const fyStart = buckets[0].start;
        const queryEnd = (0, financialYearWindow_1.getFinancialYearEnd)(financialYear, timeZone);
        const completedOrderFilter = await (0, orderSaleAmount_1.getCompletedOrderFilter)();
        const [entries, partyEntries, invoices, orders, salesReturns, creditNotes, groups] = await Promise.all([
            prisma_1.prisma.collectiveReportEntry.findMany({ where: { financialYear } }),
            prisma_1.prisma.collectivePartyEntry.findMany({ where: { financialYear } }),
            prisma_1.prisma.purchaseInvoice.findMany({
                where: { invoiceDate: { gte: queryStart, lt: queryEnd } },
                select: { invoiceAmount: true, invoiceDate: true },
            }),
            (0, orderSaleAmount_1.findReportOrders)({
                ...completedOrderFilter,
                orderDate: { gte: queryStart, lt: queryEnd },
            }),
            prisma_1.prisma.salesReturn.findMany({
                where: { returnDate: { gte: queryStart, lt: queryEnd } },
                include: salesReturnInclude,
            }),
            prisma_1.prisma.creditNote.findMany({
                where: { noteDate: { gte: queryStart, lt: queryEnd } },
                include: creditNoteInclude,
            }),
            prisma_1.prisma.collectiveReportGroup.findMany({
                orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
                include: { members: { select: { customerId: true } } },
            }),
        ]);
        const groupIdByCustomer = new Map();
        for (const group of groups) {
            for (const member of group.members)
                groupIdByCustomer.set(member.customerId, group.id);
        }
        const entryByMonth = new Map(entries.map((e) => [e.monthIndex, e]));
        const entryFor = (monthIndex) => entryByMonth.get(monthIndex) ?? null;
        const partySales = new Map();
        for (const order of orders) {
            const orderDate = new Date(order.orderDate);
            if (orderDate < fyStart)
                continue;
            const monthIndex = buckets.findIndex((b) => orderDate >= b.start && orderDate < b.end);
            if (monthIndex < 0)
                continue;
            const months = partySales.get(order.customerId) ?? Array(12).fill(0);
            months[monthIndex] += (0, orderSaleAmount_1.computeOrderGrossSaleForReport)(order);
            partySales.set(order.customerId, months);
        }
        const partyEntryByKey = new Map(partyEntries.map((e) => [`${e.customerId}:${e.monthIndex}`, e]));
        const customers = await prisma_1.prisma.user.findMany({
            where: { userType: "CUSTOMER" },
            select: { id: true, name: true },
        });
        const customerIds = new Set([
            ...customers.map((c) => c.id),
            ...partySales.keys(),
            ...partyEntries.map((e) => e.customerId),
        ]);
        const customerDetails = await prisma_1.prisma.customerDetail.findMany({
            where: { dbUserId: { in: [...customerIds] } },
            select: { dbUserId: true, dbName: true },
        });
        const nameByCustomer = new Map(customers.map((c) => [c.id, c.name]));
        for (const cd of customerDetails)
            nameByCustomer.set(cd.dbUserId, cd.dbName);
        const parties = [...customerIds]
            .map((customerId) => {
            const sales = partySales.get(customerId) ?? Array(12).fill(0);
            const months = buckets.map((_, i) => {
                const entry = partyEntryByKey.get(`${customerId}:${i}`);
                const target = entry?.target ?? null;
                const dms = entry?.dms ?? null;
                return {
                    target,
                    dms,
                    achievePercent: percent(dms ?? 0, target),
                    tally: sales[i],
                    remark: entry?.remark ?? null,
                };
            });
            const quarters = toQuarters(months, combinePartyCells);
            return {
                customerId,
                groupId: groupIdByCustomer.get(customerId) ?? null,
                partyName: nameByCustomer.get(customerId) ?? "—",
                months,
                quarters,
                total: sales.reduce((s, v) => s + v, 0),
            };
        })
            .sort((a, b) => a.partyName.localeCompare(b.partyName));
        const shipmentTargets = buckets.map((_, i) => entryFor(i)?.shipmentTarget ?? null);
        const primaryTargets = buckets.map((_, i) => sumNullable(parties.map((p) => p.months[i].target)));
        const primaryDms = buckets.map((_, i) => sumNullable(parties.map((p) => p.months[i].dms)));
        const purchaseRows = (0, monthWisePurchaseReportAmount_1.computeMonthWisePurchaseReportRows)(financialYear, invoices, shipmentTargets, timeZone, {
            months: (0, historicalMonthWiseReports_1.historicalMonthValues)(historicalMonthWiseReports_1.HISTORICAL_PURCHASE_BY_FY, financialYear, "achieved"),
            priorMarch: (0, historicalMonthWiseReports_1.historicalPriorMarch)(historicalMonthWiseReports_1.HISTORICAL_PURCHASE_BY_FY, financialYear, "achieved"),
        });
        const salesRows = (0, monthWiseSalesReportAmount_1.computeMonthWiseSalesReportRows)(financialYear, orders, salesReturns, creditNotes, primaryTargets, timeZone, {
            months: (0, historicalMonthWiseReports_1.historicalMonthValues)(historicalMonthWiseReports_1.HISTORICAL_SALES_BY_FY, financialYear, "tally"),
            priorMarch: (0, historicalMonthWiseReports_1.historicalPriorMarch)(historicalMonthWiseReports_1.HISTORICAL_SALES_BY_FY, financialYear, "tally"),
        });
        const shipmentMonths = buckets.map((_, i) => {
            const entry = entryFor(i);
            const achieved = purchaseRows[i].achieved;
            return {
                target: shipmentTargets[i],
                achieved,
                achievePercent: percent(achieved, shipmentTargets[i]),
                cdReceivedDate: entry?.cdReceivedDate ?? null,
                cdReceivedAmount: entry?.cdReceivedAmount ?? null,
                rssReceivedDate: entry?.rssReceivedDate ?? null,
                rssReceivedAmount: entry?.rssReceivedAmount ?? null,
                remark: entry?.shipmentRemark ?? null,
            };
        });
        const primaryMonths = buckets.map((_, i) => {
            const entry = entryFor(i);
            const dms = primaryDms[i];
            return {
                target: primaryTargets[i],
                dms,
                achievePercent: percent(dms ?? 0, primaryTargets[i]),
                tally: salesRows[i].tallyAchieved,
                monSchemeReleaseDate: entry?.monSchemeReleaseDate ?? null,
                monSchemeReceivedAmount: entry?.monSchemeReceivedAmount ?? null,
                monSchemeReleasedAmount: entry?.monSchemeReleasedAmount ?? null,
                remark: entry?.primaryRemark ?? null,
            };
        });
        const grandTotalMonths = buckets.map((_, i) => {
            const tally = parties.reduce((sum, p) => sum + p.months[i].tally, 0);
            return {
                target: primaryMonths[i].target,
                dms: primaryMonths[i].dms,
                tally,
            };
        });
        const shipmentQuarters = toQuarters(shipmentMonths, combineShipment);
        const primaryQuarters = toQuarters(primaryMonths, combinePrimary);
        const grandTotalQuarters = toQuarters(grandTotalMonths, combineTotals);
        const groupSummaries = groups.map((group) => ({
            id: group.id,
            name: group.name,
            sortOrder: group.sortOrder,
            total: partyTotals(parties.filter((p) => p.groupId === group.id)),
        }));
        const ungroupedTotal = partyTotals(parties.filter((p) => p.groupId === null));
        res.json({
            financialYear,
            editable: true,
            months: buckets.map((b) => ({ monthIndex: b.monthIndex, monthLabel: b.monthLabel })),
            shipment: { months: shipmentMonths, quarters: shipmentQuarters },
            primary: { months: primaryMonths, quarters: primaryQuarters },
            parties,
            grandTotal: { months: grandTotalMonths, quarters: grandTotalQuarters },
            groups: groupSummaries,
            ungroupedTotal,
            entries: buckets.map((_, i) => {
                const entry = entryFor(i);
                return {
                    monthIndex: i,
                    shipmentTarget: entry?.shipmentTarget ?? null,
                    cdReceivedDate: entry?.cdReceivedDate ?? null,
                    cdReceivedAmount: entry?.cdReceivedAmount ?? null,
                    rssReceivedDate: entry?.rssReceivedDate ?? null,
                    rssReceivedAmount: entry?.rssReceivedAmount ?? null,
                    shipmentRemark: entry?.shipmentRemark ?? null,
                    monSchemeReleaseDate: entry?.monSchemeReleaseDate ?? null,
                    monSchemeReceivedAmount: entry?.monSchemeReceivedAmount ?? null,
                    monSchemeReleasedAmount: entry?.monSchemeReleasedAmount ?? null,
                    primaryRemark: entry?.primaryRemark ?? null,
                };
            }),
        });
    }
    catch (error) {
        console.error("Collective report error:", error);
        res.status(500).json({ message: "Failed to load collective report" });
    }
};
exports.getCollectiveReport = getCollectiveReport;
function parseAmountValue(value) {
    if (value === null || value === "")
        return { ok: true, value: null };
    if (typeof value === "number" && Number.isFinite(value))
        return { ok: true, value };
    return { ok: false };
}
function parseRemarkValue(value) {
    if (value === null)
        return { ok: true, value: null };
    if (typeof value === "string")
        return { ok: true, value: value.trim() === "" ? null : value.trim() };
    return { ok: false };
}
function parseMonthIndex(value) {
    const monthIndex = Number(value);
    return Number.isInteger(monthIndex) && monthIndex >= 0 && monthIndex <= 11 ? monthIndex : null;
}
function parseEntry(raw) {
    const monthIndex = parseMonthIndex(raw.monthIndex);
    if (monthIndex === null)
        return "monthIndex must be an integer from 0 to 11";
    const data = {};
    for (const field of AMOUNT_FIELDS) {
        if (!(field in raw))
            continue;
        const parsed = parseAmountValue(raw[field]);
        if (!parsed.ok)
            return `${field} must be a number or null`;
        data[field] = parsed.value;
    }
    for (const field of DATE_FIELDS) {
        if (!(field in raw))
            continue;
        const value = raw[field];
        if (value === null || value === "") {
            data[field] = null;
        }
        else {
            const date = typeof value === "string" ? new Date(value) : null;
            if (!date || Number.isNaN(date.getTime()))
                return `${field} must be a valid date or null`;
            data[field] = date;
        }
    }
    for (const field of REMARK_FIELDS) {
        if (!(field in raw))
            continue;
        const parsed = parseRemarkValue(raw[field]);
        if (!parsed.ok)
            return `${field} must be a string or null`;
        data[field] = parsed.value;
    }
    return { monthIndex, data };
}
function parsePartyEntry(raw) {
    const customerId = raw.customerId;
    if (typeof customerId !== "string" || !/^[a-f\d]{24}$/i.test(customerId)) {
        return "customerId must be a valid id";
    }
    const monthIndex = parseMonthIndex(raw.monthIndex);
    if (monthIndex === null)
        return "monthIndex must be an integer from 0 to 11";
    const data = {};
    for (const field of ["target", "dms"]) {
        if (!(field in raw))
            continue;
        const parsed = parseAmountValue(raw[field]);
        if (!parsed.ok)
            return `${field} must be a number or null`;
        data[field] = parsed.value;
    }
    if ("remark" in raw) {
        const parsed = parseRemarkValue(raw.remark);
        if (!parsed.ok)
            return "remark must be a string or null";
        data.remark = parsed.value;
    }
    return { customerId, monthIndex, data };
}
function parseList(list, parse) {
    if (list === undefined)
        return [];
    if (!Array.isArray(list))
        return "entries must be an array";
    const parsed = [];
    for (const raw of list) {
        if (!raw || typeof raw !== "object")
            return "Each entry must be an object";
        const result = parse(raw);
        if (typeof result === "string")
            return result;
        parsed.push(result);
    }
    return parsed;
}
const bulkUpsertCollectiveReport = async (req, res) => {
    try {
        const { financialYear, entries, partyEntries } = req.body;
        if (!isValidFinancialYear(financialYear)) {
            return res.status(400).json({ message: "Valid financialYear is required" });
        }
        if ((0, collectiveReportHardcoded_1.getHardcodedCollectiveReport)(financialYear)) {
            return res.status(400).json({
                message: `FY ${financialYear} is a read-only historical snapshot`,
            });
        }
        const parsedEntries = parseList(entries, parseEntry);
        if (typeof parsedEntries === "string")
            return res.status(400).json({ message: parsedEntries });
        const parsedPartyEntries = parseList(partyEntries, parsePartyEntry);
        if (typeof parsedPartyEntries === "string") {
            return res.status(400).json({ message: parsedPartyEntries });
        }
        if (parsedEntries.length === 0 && parsedPartyEntries.length === 0) {
            return res.status(400).json({ message: "Nothing to save" });
        }
        const partyCustomerIds = [...new Set(parsedPartyEntries.map((e) => e.customerId))];
        if (partyCustomerIds.length > 0) {
            const found = await prisma_1.prisma.user.count({
                where: { id: { in: partyCustomerIds }, userType: "CUSTOMER" },
            });
            if (found !== partyCustomerIds.length) {
                return res.status(404).json({ message: "One or more customers not found" });
            }
        }
        await prisma_1.prisma.$transaction([
            ...parsedEntries.map(({ monthIndex, data }) => prisma_1.prisma.collectiveReportEntry.upsert({
                where: { financialYear_monthIndex: { financialYear, monthIndex } },
                update: data,
                create: { financialYear, monthIndex, ...data },
            })),
            ...parsedPartyEntries.map(({ customerId, monthIndex, data }) => prisma_1.prisma.collectivePartyEntry.upsert({
                where: {
                    financialYear_monthIndex_customerId: { financialYear, monthIndex, customerId },
                },
                update: data,
                create: { financialYear, monthIndex, customerId, ...data },
            })),
        ]);
        res.json({ saved: parsedEntries.length + parsedPartyEntries.length });
    }
    catch (error) {
        console.error("Bulk upsert collective report error:", error);
        res.status(500).json({ message: "Failed to save collective report entries" });
    }
};
exports.bulkUpsertCollectiveReport = bulkUpsertCollectiveReport;
//# sourceMappingURL=collectiveReport.controller.js.map