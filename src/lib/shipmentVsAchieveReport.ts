import {
  buildFyMonthBuckets,
  computeMonthWiseSalesReportRows,
  computeReturnLineGrossAmount,
  getMarchPriorFyBucket,
  getPriorFinancialYear,
  RETURN_CREDIT_ORDER_SELECT,
} from "./monthWiseSalesReportAmount";
import {
  computeOrderGrossSaleForReport,
  getDaysInMonth,
  REPORT_ORDER_SELECT,
  resolveSafeTimeZone,
  type ReportOrderRow,
} from "./orderSaleAmount";
import { computePurchaseInvoiceBasicFromItems } from "./purchaseItemPriceSnapshot";
import {
  getHardcodedShipmentVsAchieve,
  isShipmentVsAchieveLiveFy,
  type ShipmentVsAchieveMonthRow,
  type ShipmentVsAchieveTotals,
} from "../data/shipmentVsAchieveHardcoded";

export type ShipmentVsAchieveManualRow = {
  monthIndex: number;
  targetBasic?: number | null;
  incentive?: number | null;
  dmsBasic?: number | null;
  carDms?: number | null;
  schemeReceived?: string | null;
  schemeReleased?: string | null;
  incentiveReceived?: string | null;
  incentiveReleased?: string | null;
};

export type ShipmentVsAchieveHighlight = {
  maxAchieveMonthIndex: number | null;
  maxSaleMonthIndex: number | null;
  maxDmsMonthIndex: number | null;
};

export type ShipmentVsAchieveReportResponse = {
  financialYear: string;
  mode: "hardcoded" | "live";
  editable: boolean;
  rows: ShipmentVsAchieveMonthRow[];
  totals: ShipmentVsAchieveTotals;
  highlight: ShipmentVsAchieveHighlight;
};

type PurchaseInvoiceForReport = {
  invoiceDate: Date | null;
  PurchaseInvoiceItem: Array<{
    quantity: number;
    mrp?: number | null;
    gstPercentage?: number | null;
    packetsPerCarton?: number | null;
    costPricePerCarton?: number | null;
    costPricePerPacket?: number | null;
  }>;
};

type ReturnCreditOrder = Parameters<typeof computeReturnLineGrossAmount>[0];

function pct(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return (numerator / denominator) * 100;
}

function mom(current: number, previous: number | null): number | null {
  if (previous === null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function sumNullable(values: Array<number | null | undefined>): number {
  return values.reduce<number>((s, v) => s + (v ?? 0), 0);
}

function maxIndex(values: Array<number | null | undefined>): number | null {
  let bestIdx: number | null = null;
  let bestVal = -Infinity;
  values.forEach((v, i) => {
    if (v === null || v === undefined) return;
    if (v > bestVal) {
      bestVal = v;
      bestIdx = i;
    }
  });
  return bestIdx;
}

function buildHighlight(rows: ShipmentVsAchieveMonthRow[]): ShipmentVsAchieveHighlight {
  return {
    maxAchieveMonthIndex: maxIndex(rows.map((r) => r.achieveBasic)),
    maxSaleMonthIndex: maxIndex(rows.map((r) => r.saleBasic)),
    maxDmsMonthIndex: maxIndex(rows.map((r) => r.dmsBasic)),
  };
}

function emptyManual(): Required<Omit<ShipmentVsAchieveManualRow, "monthIndex">> {
  return {
    targetBasic: null,
    incentive: null,
    dmsBasic: null,
    carDms: null,
    schemeReceived: null,
    schemeReleased: null,
    incentiveReceived: null,
    incentiveReleased: null,
  };
}

export function buildHardcodedShipmentVsAchieveReport(
  financialYear: string
): ShipmentVsAchieveReportResponse | null {
  const snap = getHardcodedShipmentVsAchieve(financialYear);
  if (!snap) return null;
  return {
    financialYear: snap.financialYear,
    mode: "hardcoded",
    editable: false,
    rows: snap.rows,
    totals: snap.totals,
    highlight: buildHighlight(snap.rows),
  };
}

function getPriorMarchAchieveAndSale(
  financialYear: string,
  livePriorMarchAchieve: number,
  livePriorMarchSale: number
): { achieve: number; sale: number } {
  const priorFy = getPriorFinancialYear(financialYear);
  const hardcoded = getHardcodedShipmentVsAchieve(priorFy);
  if (hardcoded) {
    const mar = hardcoded.rows[11];
    return {
      achieve: mar.achieveBasic ?? 0,
      sale: mar.saleBasic ?? 0,
    };
  }
  return { achieve: livePriorMarchAchieve, sale: livePriorMarchSale };
}

function getPriorFyTotalsForYoy(financialYear: string): {
  achieveBasic: number | null;
  saleBasic: number | null;
} {
  const priorFy = getPriorFinancialYear(financialYear);
  const hardcoded = getHardcodedShipmentVsAchieve(priorFy);
  if (hardcoded) {
    return {
      achieveBasic: hardcoded.totals.achieveBasic,
      saleBasic: hardcoded.totals.saleBasic,
    };
  }
  return { achieveBasic: null, saleBasic: null };
}

function computePriorMarchSale(
  orders: ReportOrderRow[],
  salesReturns: Array<{
    returnDate: Date;
    SalesReturnItem: Array<{ productId: string; quantity: number }>;
    order: ReturnCreditOrder;
  }>,
  creditNotes: Array<{
    noteDate: Date;
    CreditNoteItem: Array<{ productId: string; quantity: number }>;
    order: ReturnCreditOrder;
  }>,
  priorMarch: { start: Date; end: Date }
): number {
  let sales = 0;
  let deductions = 0;
  for (const order of orders) {
    const d = new Date(order.orderDate);
    if (d >= priorMarch.start && d < priorMarch.end) {
      sales += computeOrderGrossSaleForReport(order);
    }
  }
  for (const sr of salesReturns) {
    const d = new Date(sr.returnDate);
    if (d < priorMarch.start || d >= priorMarch.end) continue;
    for (const item of sr.SalesReturnItem) {
      deductions += computeReturnLineGrossAmount(sr.order, item.productId, item.quantity);
    }
  }
  for (const cn of creditNotes) {
    const d = new Date(cn.noteDate);
    if (d < priorMarch.start || d >= priorMarch.end) continue;
    for (const item of cn.CreditNoteItem) {
      deductions += computeReturnLineGrossAmount(cn.order, item.productId, item.quantity);
    }
  }
  return sales - deductions;
}

export function assembleLiveShipmentVsAchieveReport(args: {
  financialYear: string;
  timeZone?: string;
  invoices: PurchaseInvoiceForReport[];
  orders: ReportOrderRow[];
  salesReturns: Array<{
    returnDate: Date;
    SalesReturnItem: Array<{ productId: string; quantity: number }>;
    order: ReturnCreditOrder;
  }>;
  creditNotes: Array<{
    noteDate: Date;
    CreditNoteItem: Array<{ productId: string; quantity: number }>;
    order: ReturnCreditOrder;
  }>;
  manualRows: ShipmentVsAchieveManualRow[];
}): ShipmentVsAchieveReportResponse {
  const { financialYear } = args;
  const timeZone = resolveSafeTimeZone(args.timeZone);
  const buckets = buildFyMonthBuckets(financialYear, timeZone);
  const priorMarch = getMarchPriorFyBucket(financialYear, timeZone);

  const achieveByMonth = new Array<number>(12).fill(0);
  const carByMonth = new Array<number>(12).fill(0);
  let priorMarchAchieveLive = 0;

  for (const inv of args.invoices) {
    if (!inv.invoiceDate) continue;
    const d = new Date(inv.invoiceDate);
    const basic = computePurchaseInvoiceBasicFromItems(inv.PurchaseInvoiceItem);
    const car = inv.PurchaseInvoiceItem.reduce((s, item) => s + (item.quantity ?? 0), 0);

    const monthIdx = buckets.findIndex((b) => d >= b.start && d < b.end);
    if (monthIdx >= 0) {
      achieveByMonth[monthIdx] += basic;
      carByMonth[monthIdx] += car;
      continue;
    }
    if (d >= priorMarch.start && d < priorMarch.end) {
      priorMarchAchieveLive += basic;
    }
  }

  const saleRows = computeMonthWiseSalesReportRows(
    financialYear,
    args.orders,
    args.salesReturns,
    args.creditNotes,
    Array(12).fill(null),
    timeZone
  );
  const saleByMonth = saleRows.map((r) => r.tallyAchieved);
  const priorMarchSaleLive = computePriorMarchSale(
    args.orders,
    args.salesReturns,
    args.creditNotes,
    priorMarch
  );

  const priorFromHardOrLive = getPriorMarchAchieveAndSale(
    financialYear,
    priorMarchAchieveLive,
    priorMarchSaleLive
  );

  const manualByIndex = new Map(args.manualRows.map((r) => [r.monthIndex, r]));

  const rows: ShipmentVsAchieveMonthRow[] = buckets.map((bucket, monthIndex) => {
    const manual = { ...emptyManual(), ...(manualByIndex.get(monthIndex) ?? {}) };
    const q = Math.floor(monthIndex / 3);
    const qStart = q * 3;
    const isQStart = monthIndex === qStart;

    const achieveBasic = achieveByMonth[monthIndex];
    const car = carByMonth[monthIndex];
    const saleBasic = saleByMonth[monthIndex];
    const targetBasic = manual.targetBasic ?? null;

    const prevAchieve =
      monthIndex === 0 ? priorFromHardOrLive.achieve : achieveByMonth[monthIndex - 1];
    const prevSale = monthIndex === 0 ? priorFromHardOrLive.sale : saleByMonth[monthIndex - 1];

    return {
      monthIndex,
      monthLabel: bucket.monthLabel,
      quarter: isQStart ? `Q${q + 1} ${financialYear}` : null,
      targetBasic,
      achieveBasic,
      qWiseAchieveBasic: null,
      car,
      qWiseCar: null,
      achPercent: targetBasic !== null ? pct(achieveBasic, targetBasic) : null,
      quarterAchPercent: null,
      compareShipMom: mom(achieveBasic, prevAchieve),
      incentive: manual.incentive ?? null,
      saleBasic,
      dmsBasic: manual.dmsBasic ?? null,
      qWiseDmsBasic: null,
      carDms: manual.carDms ?? null,
      qWiseCarDms: null,
      avgSalePerDay: saleBasic / getDaysInMonth(bucket.calendarYear, bucket.calendarMonth),
      compareSaleMom: mom(saleBasic, prevSale),
      schemeReceived: manual.schemeReceived ?? null,
      schemeReleased: manual.schemeReleased ?? null,
      incentiveReceived: manual.incentiveReceived ?? null,
      incentiveReleased: manual.incentiveReleased ?? null,
    };
  });

  for (let q = 0; q < 4; q++) {
    const start = q * 3;
    const qTarget = sumNullable([
      rows[start].targetBasic,
      rows[start + 1].targetBasic,
      rows[start + 2].targetBasic,
    ]);
    const qAchieve = sumNullable([
      rows[start].achieveBasic,
      rows[start + 1].achieveBasic,
      rows[start + 2].achieveBasic,
    ]);
    rows[start].qWiseAchieveBasic = qAchieve;
    rows[start].qWiseCar = sumNullable([
      rows[start].car,
      rows[start + 1].car,
      rows[start + 2].car,
    ]);
    rows[start].qWiseDmsBasic = sumNullable([
      rows[start].dmsBasic,
      rows[start + 1].dmsBasic,
      rows[start + 2].dmsBasic,
    ]);
    rows[start].qWiseCarDms = sumNullable([
      rows[start].carDms,
      rows[start + 1].carDms,
      rows[start + 2].carDms,
    ]);
    rows[start].quarterAchPercent = pct(qAchieve, qTarget);
  }

  const totalTarget = sumNullable(rows.map((r) => r.targetBasic));
  const totalAchieve = sumNullable(rows.map((r) => r.achieveBasic));
  const totalSale = sumNullable(rows.map((r) => r.saleBasic));
  const totalDms = sumNullable(rows.map((r) => r.dmsBasic));
  const totalIncentive = sumNullable(rows.map((r) => r.incentive));
  const totalCar = sumNullable(rows.map((r) => r.car));

  const priorTotals = getPriorFyTotalsForYoy(financialYear);
  // For live years after the first, prior totals may need live computation — caller can pass
  // extended prior FY later; for 2026-27 prior is hardcoded 2025-26.
  let compareShipMom =
    priorTotals.achieveBasic !== null && priorTotals.achieveBasic !== 0
      ? pct(totalAchieve - priorTotals.achieveBasic, priorTotals.achieveBasic)
      : null;
  let compareSaleMom =
    priorTotals.saleBasic !== null && priorTotals.saleBasic !== 0
      ? pct(totalSale - priorTotals.saleBasic, priorTotals.saleBasic)
      : null;

  // If prior FY was also live (no hardcoded), YoY left null unless we computed prior totals externally.
  if (priorTotals.achieveBasic === null && isShipmentVsAchieveLiveFy(getPriorFinancialYear(financialYear))) {
    compareShipMom = null;
    compareSaleMom = null;
  }

  const totals: ShipmentVsAchieveTotals = {
    targetBasic: totalTarget,
    achieveBasic: totalAchieve,
    achPercent: pct(totalAchieve, totalTarget),
    compareShipMom,
    saleBasic: totalSale,
    dmsBasic: totalDms,
    avgSalePerDay: totalSale / 12,
    compareSaleMom,
    incentive: totalIncentive,
    car: totalCar,
  };

  return {
    financialYear,
    mode: "live",
    editable: isShipmentVsAchieveLiveFy(financialYear),
    rows,
    totals,
    highlight: buildHighlight(rows),
  };
}

export { REPORT_ORDER_SELECT, RETURN_CREDIT_ORDER_SELECT, isShipmentVsAchieveLiveFy };
