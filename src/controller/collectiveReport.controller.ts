import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { computeMonthWisePurchaseReportRows } from "../lib/monthWisePurchaseReportAmount";
import {
  buildFyMonthBuckets,
  computeMonthWiseSalesReportRows,
  getMarchPriorFyBucket,
  RETURN_CREDIT_ORDER_SELECT,
} from "../lib/monthWiseSalesReportAmount";
import {
  computeOrderGrossSaleForReport,
  findReportOrders,
  getCompletedOrderFilter,
  resolveSafeTimeZone,
} from "../lib/orderSaleAmount";
import { fyFromDate, getFinancialYearEnd } from "../lib/financialYearWindow";
import {
  HISTORICAL_PURCHASE_BY_FY,
  HISTORICAL_SALES_BY_FY,
  historicalMonthValues,
  historicalPriorMarch,
} from "../data/historicalMonthWiseReports";
import {
  getHardcodedCollectiveReport,
  type HardcodedCollectiveSnapshot,
} from "../data/collectiveReportHardcoded";

const AMOUNT_FIELDS = [
  "shipmentTarget",
  "cdReceivedAmount",
  "rssReceivedAmount",
  "monSchemeReceivedAmount",
  "monSchemeReleasedAmount",
] as const;

const DATE_FIELDS = ["cdReceivedDate", "rssReceivedDate", "monSchemeReleaseDate"] as const;

const REMARK_FIELDS = ["shipmentRemark", "primaryRemark"] as const;

type AmountField = (typeof AMOUNT_FIELDS)[number];
type DateField = (typeof DATE_FIELDS)[number];
type RemarkField = (typeof REMARK_FIELDS)[number];

type EntryUpdate = Partial<
  Record<AmountField, number | null> & Record<DateField, Date | null> & Record<RemarkField, string | null>
>;

function isValidFinancialYear(fy: unknown): fy is string {
  if (typeof fy !== "string") return false;
  const match = /^(\d{4})-(\d{2})$/.exec(fy);
  if (!match) return false;
  return (Number(match[1]) + 1) % 100 === Number(match[2]);
}

function percent(numerator: number, denominator: number | null): number | null {
  if (denominator === null || denominator <= 0) return null;
  return (numerator / denominator) * 100;
}

function sumNullable(values: Array<number | null>): number | null {
  if (values.every((v) => v === null)) return null;
  return values.reduce<number>((sum, v) => sum + (v ?? 0), 0);
}

function toQuarters<T>(months: T[], combine: (group: T[]) => T): T[] {
  return [0, 1, 2, 3].map((q) => combine(months.slice(q * 3, q * 3 + 3)));
}

type TotalCell = { target: number | null; dms: number | null; tally: number };

function combineTotals(cells: TotalCell[]): TotalCell {
  return {
    target: sumNullable(cells.map((c) => c.target)),
    dms: sumNullable(cells.map((c) => c.dms)),
    tally: cells.reduce((s, c) => s + c.tally, 0),
  };
}

type ShipmentCell = {
  target: number | null;
  achieved: number;
  achievePercent: number | null;
  cdReceivedDate: Date | null;
  cdReceivedAmount: number | null;
  rssReceivedDate: Date | null;
  rssReceivedAmount: number | null;
  remark: string | null;
};

function combineShipment(cells: ShipmentCell[]): ShipmentCell {
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

type PrimaryCell = {
  target: number | null;
  dms: number | null;
  achievePercent: number | null;
  tally: number;
  monSchemeReleaseDate: Date | null;
  monSchemeReceivedAmount: number | null;
  monSchemeReleasedAmount: number | null;
  remark: string | null;
};

function combinePrimary(cells: PrimaryCell[]): PrimaryCell {
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

type PartyCell = {
  target: number | null;
  dms: number | null;
  achievePercent: number | null;
  tally: number;
  remark: string | null;
  monSchemeReleasedAmount?: number | null;
};

function combinePartyCells(cells: PartyCell[]): PartyCell {
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

function partyTotals(members: Array<{ months: PartyCell[] }>) {
  const months = Array.from({ length: 12 }, (_, i) => ({
    target: sumNullable(members.map((p) => p.months[i].target)),
    dms: sumNullable(members.map((p) => p.months[i].dms)),
    tally: members.reduce((sum, p) => sum + p.months[i].tally, 0),
  }));
  return { months, quarters: toQuarters(months, combineTotals) };
}

function splitAmountOrText(value: number | string | null): { amount: number | null; text: string | null } {
  if (typeof value === "number") return { amount: value, text: null };
  return { amount: null, text: value };
}

function joinRemarks(...parts: Array<string | null>): string | null {
  const present = parts.filter((p): p is string => !!p);
  return present.length > 0 ? present.join(" | ") : null;
}

const normalizeName = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");

async function buildHardcodedCollectiveReport(
  financialYear: string,
  snapshot: HardcodedCollectiveSnapshot,
  timeZone: string
) {
  const buckets = buildFyMonthBuckets(financialYear, timeZone);

  const [customers, customerDetails, groups] = await Promise.all([
    prisma.user.findMany({ where: { userType: "CUSTOMER" }, select: { id: true, name: true } }),
    prisma.customerDetail.findMany({ select: { dbUserId: true, dbName: true } }),
    prisma.collectiveReportGroup.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { members: { select: { customerId: true } } },
    }),
  ]);
  const customerIdByName = new Map<string, string>();
  for (const c of customers) customerIdByName.set(normalizeName(c.name), c.id);
  for (const cd of customerDetails) {
    if (cd.dbName) customerIdByName.set(normalizeName(cd.dbName), cd.dbUserId);
  }
  const nameByCustomer = new Map<string, string>(customers.map((c) => [c.id, c.name]));
  for (const cd of customerDetails) if (cd.dbName) nameByCustomer.set(cd.dbUserId, cd.dbName);
  const groupIdByCustomer = new Map<string, string>();
  for (const group of groups) {
    for (const member of group.members) groupIdByCustomer.set(member.customerId, group.id);
  }

  const shipmentMonths: ShipmentCell[] = snapshot.shipment.months.map(([target, achieve, remark]) => ({
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
    const incentiveLabel =
      amount !== null ? `Incentive: ${amount.toLocaleString("en-IN")}` : text ? `Incentive: ${text}` : null;
    return { ...cell, remark: joinRemarks(remark, incentiveLabel) };
  });

  const primaryMonths: PrimaryCell[] = snapshot.primary.months.map(([target, dms, tally, scheme]) => {
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
    const months: PartyCell[] = party.months.map(([target, dms, tally, scheme]) => {
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
  order: { select: RETURN_CREDIT_ORDER_SELECT },
} as const;

const creditNoteInclude = {
  CreditNoteItem: { select: { productId: true, quantity: true } },
  order: { select: RETURN_CREDIT_ORDER_SELECT },
} as const;

export const getCollectiveReport = async (req: Request, res: Response) => {
  try {
    const timeZone = resolveSafeTimeZone(
      typeof req.query.timeZone === "string" ? req.query.timeZone : undefined
    );
    const financialYear = isValidFinancialYear(req.query.financialYear)
      ? req.query.financialYear
      : fyFromDate(new Date(), timeZone);

    const snapshot = getHardcodedCollectiveReport(financialYear);
    if (snapshot) {
      return res.json(await buildHardcodedCollectiveReport(financialYear, snapshot, timeZone));
    }

    const buckets = buildFyMonthBuckets(financialYear, timeZone);
    const queryStart = getMarchPriorFyBucket(financialYear, timeZone).start;
    const fyStart = buckets[0].start;
    const queryEnd = getFinancialYearEnd(financialYear, timeZone);
    const completedOrderFilter = await getCompletedOrderFilter();

    const [entries, partyEntries, invoices, orders, salesReturns, creditNotes, groups] = await Promise.all([
      prisma.collectiveReportEntry.findMany({ where: { financialYear } }),
      prisma.collectivePartyEntry.findMany({ where: { financialYear } }),
      prisma.purchaseInvoice.findMany({
        where: { invoiceDate: { gte: queryStart, lt: queryEnd } },
        select: { invoiceAmount: true, invoiceDate: true },
      }),
      findReportOrders({
        ...completedOrderFilter,
        orderDate: { gte: queryStart, lt: queryEnd },
      }),
      prisma.salesReturn.findMany({
        where: { returnDate: { gte: queryStart, lt: queryEnd } },
        include: salesReturnInclude,
      }),
      prisma.creditNote.findMany({
        where: { noteDate: { gte: queryStart, lt: queryEnd } },
        include: creditNoteInclude,
      }),
      prisma.collectiveReportGroup.findMany({
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: { members: { select: { customerId: true } } },
      }),
    ]);

    const groupIdByCustomer = new Map<string, string>();
    for (const group of groups) {
      for (const member of group.members) groupIdByCustomer.set(member.customerId, group.id);
    }

    const entryByMonth = new Map(entries.map((e) => [e.monthIndex, e]));
    const entryFor = (monthIndex: number) => entryByMonth.get(monthIndex) ?? null;

    const partySales = new Map<string, number[]>();
    for (const order of orders) {
      const orderDate = new Date(order.orderDate);
      if (orderDate < fyStart) continue;
      const monthIndex = buckets.findIndex((b) => orderDate >= b.start && orderDate < b.end);
      if (monthIndex < 0) continue;
      const months = partySales.get(order.customerId) ?? Array<number>(12).fill(0);
      months[monthIndex] += computeOrderGrossSaleForReport(order);
      partySales.set(order.customerId, months);
    }

    const partyEntryByKey = new Map(
      partyEntries.map((e) => [`${e.customerId}:${e.monthIndex}`, e])
    );

    const customers = await prisma.user.findMany({
      where: { userType: "CUSTOMER" },
      select: { id: true, name: true },
    });
    const customerIds = new Set([
      ...customers.map((c) => c.id),
      ...partySales.keys(),
      ...partyEntries.map((e) => e.customerId),
    ]);
    const customerDetails = await prisma.customerDetail.findMany({
      where: { dbUserId: { in: [...customerIds] } },
      select: { dbUserId: true, dbName: true },
    });
    const nameByCustomer = new Map<string, string>(customers.map((c) => [c.id, c.name]));
    for (const cd of customerDetails) nameByCustomer.set(cd.dbUserId, cd.dbName);

    const parties = [...customerIds]
      .map((customerId) => {
        const sales = partySales.get(customerId) ?? Array<number>(12).fill(0);
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

    const purchaseRows = computeMonthWisePurchaseReportRows(
      financialYear,
      invoices,
      shipmentTargets,
      timeZone,
      {
        months: historicalMonthValues(HISTORICAL_PURCHASE_BY_FY, financialYear, "achieved"),
        priorMarch: historicalPriorMarch(HISTORICAL_PURCHASE_BY_FY, financialYear, "achieved"),
      }
    );

    const salesRows = computeMonthWiseSalesReportRows(
      financialYear,
      orders,
      salesReturns,
      creditNotes,
      primaryTargets,
      timeZone,
      {
        months: historicalMonthValues(HISTORICAL_SALES_BY_FY, financialYear, "tally"),
        priorMarch: historicalPriorMarch(HISTORICAL_SALES_BY_FY, financialYear, "tally"),
      }
    );

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
  } catch (error) {
    console.error("Collective report error:", error);
    res.status(500).json({ message: "Failed to load collective report" });
  }
};

type ParsedValue<T> = { ok: true; value: T } | { ok: false };

function parseAmountValue(value: unknown): ParsedValue<number | null> {
  if (value === null || value === "") return { ok: true, value: null };
  if (typeof value === "number" && Number.isFinite(value)) return { ok: true, value };
  return { ok: false };
}

function parseRemarkValue(value: unknown): ParsedValue<string | null> {
  if (value === null) return { ok: true, value: null };
  if (typeof value === "string") return { ok: true, value: value.trim() === "" ? null : value.trim() };
  return { ok: false };
}

function parseMonthIndex(value: unknown): number | null {
  const monthIndex = Number(value);
  return Number.isInteger(monthIndex) && monthIndex >= 0 && monthIndex <= 11 ? monthIndex : null;
}

function parseEntry(raw: Record<string, unknown>): { monthIndex: number; data: EntryUpdate } | string {
  const monthIndex = parseMonthIndex(raw.monthIndex);
  if (monthIndex === null) return "monthIndex must be an integer from 0 to 11";

  const data: EntryUpdate = {};
  for (const field of AMOUNT_FIELDS) {
    if (!(field in raw)) continue;
    const parsed = parseAmountValue(raw[field]);
    if (!parsed.ok) return `${field} must be a number or null`;
    data[field] = parsed.value;
  }
  for (const field of DATE_FIELDS) {
    if (!(field in raw)) continue;
    const value = raw[field];
    if (value === null || value === "") {
      data[field] = null;
    } else {
      const date = typeof value === "string" ? new Date(value) : null;
      if (!date || Number.isNaN(date.getTime())) return `${field} must be a valid date or null`;
      data[field] = date;
    }
  }
  for (const field of REMARK_FIELDS) {
    if (!(field in raw)) continue;
    const parsed = parseRemarkValue(raw[field]);
    if (!parsed.ok) return `${field} must be a string or null`;
    data[field] = parsed.value;
  }
  return { monthIndex, data };
}

type PartyEntryUpdate = { target?: number | null; dms?: number | null; remark?: string | null };

function parsePartyEntry(
  raw: Record<string, unknown>
): { customerId: string; monthIndex: number; data: PartyEntryUpdate } | string {
  const customerId = raw.customerId;
  if (typeof customerId !== "string" || !/^[a-f\d]{24}$/i.test(customerId)) {
    return "customerId must be a valid id";
  }
  const monthIndex = parseMonthIndex(raw.monthIndex);
  if (monthIndex === null) return "monthIndex must be an integer from 0 to 11";

  const data: PartyEntryUpdate = {};
  for (const field of ["target", "dms"] as const) {
    if (!(field in raw)) continue;
    const parsed = parseAmountValue(raw[field]);
    if (!parsed.ok) return `${field} must be a number or null`;
    data[field] = parsed.value;
  }
  if ("remark" in raw) {
    const parsed = parseRemarkValue(raw.remark);
    if (!parsed.ok) return "remark must be a string or null";
    data.remark = parsed.value;
  }
  return { customerId, monthIndex, data };
}

function parseList<T>(
  list: unknown,
  parse: (raw: Record<string, unknown>) => T | string
): T[] | string {
  if (list === undefined) return [];
  if (!Array.isArray(list)) return "entries must be an array";
  const parsed: T[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== "object") return "Each entry must be an object";
    const result = parse(raw as Record<string, unknown>);
    if (typeof result === "string") return result;
    parsed.push(result);
  }
  return parsed;
}

export const bulkUpsertCollectiveReport = async (req: Request, res: Response) => {
  try {
    const { financialYear, entries, partyEntries } = req.body as {
      financialYear?: unknown;
      entries?: unknown;
      partyEntries?: unknown;
    };

    if (!isValidFinancialYear(financialYear)) {
      return res.status(400).json({ message: "Valid financialYear is required" });
    }
    if (getHardcodedCollectiveReport(financialYear)) {
      return res.status(400).json({
        message: `FY ${financialYear} is a read-only historical snapshot`,
      });
    }

    const parsedEntries = parseList(entries, parseEntry);
    if (typeof parsedEntries === "string") return res.status(400).json({ message: parsedEntries });
    const parsedPartyEntries = parseList(partyEntries, parsePartyEntry);
    if (typeof parsedPartyEntries === "string") {
      return res.status(400).json({ message: parsedPartyEntries });
    }
    if (parsedEntries.length === 0 && parsedPartyEntries.length === 0) {
      return res.status(400).json({ message: "Nothing to save" });
    }

    const partyCustomerIds = [...new Set(parsedPartyEntries.map((e) => e.customerId))];
    if (partyCustomerIds.length > 0) {
      const found = await prisma.user.count({
        where: { id: { in: partyCustomerIds }, userType: "CUSTOMER" },
      });
      if (found !== partyCustomerIds.length) {
        return res.status(404).json({ message: "One or more customers not found" });
      }
    }

    await prisma.$transaction([
      ...parsedEntries.map(({ monthIndex, data }) =>
        prisma.collectiveReportEntry.upsert({
          where: { financialYear_monthIndex: { financialYear, monthIndex } },
          update: data,
          create: { financialYear, monthIndex, ...data },
        })
      ),
      ...parsedPartyEntries.map(({ customerId, monthIndex, data }) =>
        prisma.collectivePartyEntry.upsert({
          where: {
            financialYear_monthIndex_customerId: { financialYear, monthIndex, customerId },
          },
          update: data,
          create: { financialYear, monthIndex, customerId, ...data },
        })
      ),
    ]);

    res.json({ saved: parsedEntries.length + parsedPartyEntries.length });
  } catch (error) {
    console.error("Bulk upsert collective report error:", error);
    res.status(500).json({ message: "Failed to save collective report entries" });
  }
};
