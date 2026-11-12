import { Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import {
  REPORT_ORDER_SELECT,
  computeOrderGrossSaleForReport,
  getCompletedOrderFilter,
  getZonedDateParts,
  resolveSafeTimeZone,
  zonedDateTimeToUtcDate,
  formatMonthLabel,
  formatBillingDate,
  getDaysInMonth,
  isSunday,
  addMonths,
} from "../lib/orderSaleAmount";
import {
  BulkUpsertPartyMonthlySalesTargetSchema,
  UpsertPartyMonthlySalesTargetSchema,
} from "../libs/schemas/partyMonthlySalesTarget.schema";
import { AuthenticatedRequest } from "../middleware/auth.middleware";

type PartyMetrics = {
  avgMonthlyVehicles: number;
  vehiclesSoldTillDate: number;
  dailySales: number[];
  dailyOrderIds: string[][];
  monthTotals: { current: number; prev1: number; prev2: number };
  targetAmount: number | null;
  targetVehicles: number | null;
};

function emptyMetrics(daysInMonth: number): PartyMetrics {
  return {
    avgMonthlyVehicles: 0,
    vehiclesSoldTillDate: 0,
    dailySales: Array.from({ length: daysInMonth }, () => 0),
    dailyOrderIds: Array.from({ length: daysInMonth }, () => [] as string[]),
    monthTotals: { current: 0, prev1: 0, prev2: 0 },
    targetAmount: null,
    targetVehicles: null,
  };
}

function balanceFromTarget(target: number | null, achieved: number): number | null {
  if (target == null) return null;
  return target - achieved;
}

function sumNullable(a: number | null, b: number | null): number | null {
  if (a == null && b == null) return null;
  return (a ?? 0) + (b ?? 0);
}

function sumMetrics(a: PartyMetrics, b: PartyMetrics): PartyMetrics {
  return {
    avgMonthlyVehicles: a.avgMonthlyVehicles + b.avgMonthlyVehicles,
    vehiclesSoldTillDate: a.vehiclesSoldTillDate + b.vehiclesSoldTillDate,
    dailySales: a.dailySales.map((v, i) => v + (b.dailySales[i] ?? 0)),
    dailyOrderIds: a.dailyOrderIds.map((ids, i) => [...ids, ...(b.dailyOrderIds[i] ?? [])]),
    monthTotals: {
      current: a.monthTotals.current + b.monthTotals.current,
      prev1: a.monthTotals.prev1 + b.monthTotals.prev1,
      prev2: a.monthTotals.prev2 + b.monthTotals.prev2,
    },
    targetAmount: sumNullable(a.targetAmount, b.targetAmount),
    targetVehicles: sumNullable(a.targetVehicles, b.targetVehicles),
  };
}

function withBalances<T extends {
  targetAmount: number | null;
  targetVehicles: number | null;
  monthTotals: { current: number };
  vehiclesSoldTillDate: number;
}>(row: T) {
  return {
    ...row,
    balanceAmountTarget: balanceFromTarget(row.targetAmount, row.monthTotals.current),
    balanceVehicleTarget: balanceFromTarget(row.targetVehicles, row.vehiclesSoldTillDate),
  };
}

function metricsToRow(metrics: PartyMetrics, lastBillingDate: string | null) {
  return withBalances({
    lastBillingDate,
    avgMonthlyVehicles: metrics.avgMonthlyVehicles,
    vehiclesSoldTillDate: metrics.vehiclesSoldTillDate,
    dailySales: metrics.dailySales,
    monthTotals: metrics.monthTotals,
    targetAmount: metrics.targetAmount,
    targetVehicles: metrics.targetVehicles,
  });
}

function metricsToPartyRow(metrics: PartyMetrics, lastBillingDate: string | null) {
  return {
    ...metricsToRow(metrics, lastBillingDate),
    dailyOrderIds: metrics.dailyOrderIds,
  };
}

function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export const getPartyWiseSalesReport = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const timeZone = resolveSafeTimeZone(
      typeof req.query.timeZone === "string" ? req.query.timeZone : undefined
    );
    const now = new Date();
    const nowParts = getZonedDateParts(now, timeZone);

    const year = req.query.year
      ? parseInt(req.query.year as string, 10)
      : nowParts.year;
    const month = req.query.month
      ? parseInt(req.query.month as string, 10)
      : nowParts.month;

    if (!year || month < 1 || month > 12) {
      return res.status(400).json({ message: "Invalid year or month" });
    }

    const daysInMonth = getDaysInMonth(year, month);
    const isCurrentMonth = year === nowParts.year && month === nowParts.month;
    const todayDay = isCurrentMonth ? nowParts.day : daysInMonth;

    const prev1 = addMonths(year, month, -1);
    const prev2 = addMonths(year, month, -2);

    const monthEnd = zonedDateTimeToUtcDate(timeZone, year, month - 1, daysInMonth, 23, 59, 59, 999);
    const tillDateEnd = zonedDateTimeToUtcDate(timeZone, year, month - 1, todayDay, 23, 59, 59, 999);
    const prev2Start = zonedDateTimeToUtcDate(timeZone, prev2.year, prev2.month - 1, 1, 0, 0, 0, 0);

    const queryStart = prev2Start;
    const queryEnd = isCurrentMonth ? tillDateEnd : monthEnd;

    const user = req.user as { id?: string; userType?: string } | undefined;
    const isRegisteredScope = req.query.scope === "registered";
    const tagWhere: Prisma.PartyReportTagWhereInput =
      user?.userType === "SALES_OFFICER" && user.id
        ? { salesOfficerId: user.id }
        : {};

    const allTags = await prisma.partyReportTag.findMany({
      where: tagWhere,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        CustomerDetails: {
          select: {
            dbUserId: true,
            dbName: true,
          },
          orderBy: { dbName: "asc" },
        },
      },
    });
    // Filtered in memory: on MongoDB, Prisma `NOT`/`false` filters skip tag documents
    // that predate the isRegisteredParty field.
    const tags = allTags.filter(
      (tag) => (tag.isRegisteredParty === true) === isRegisteredScope
    );

    const taggedParties = tags.flatMap((tag) =>
      tag.CustomerDetails.map((cd) => ({
        customerId: cd.dbUserId,
        partyName: cd.dbName,
        tagId: tag.id,
        tagName: tag.name,
        headerColor: tag.headerColor,
        sortOrder: tag.sortOrder,
      }))
    );

    if (taggedParties.length === 0) {
      return res.json({
        monthLabel: formatMonthLabel(year, month),
        year,
        month,
        daysInMonth,
        todayDay,
        isCurrentMonth,
        sundays: Array.from({ length: daysInMonth }, (_, i) =>
          isSunday(year, month, i + 1)
        ),
        monthLabels: {
          current: formatMonthLabel(year, month),
          prev1: formatMonthLabel(prev1.year, prev1.month),
          prev2: formatMonthLabel(prev2.year, prev2.month),
        },
        vehicleSoldTillLabel: formatMonthLabel(year, month),
        tags: [],
        grandTotal: metricsToRow(emptyMetrics(daysInMonth), null),
        compare: {
          prev1Percent: null,
          prev2Percent: null,
          vehicleSoldPercent: null,
        },
      });
    }

    const customerIds = taggedParties.map((p) => p.customerId);
    const completedOrderFilter = await getCompletedOrderFilter();

    const [orders, lastBillingGroups, targets] = await Promise.all([
      prisma.order.findMany({
        where: {
          ...completedOrderFilter,
          customerId: { in: customerIds },
          orderDate: { gte: queryStart, lte: queryEnd },
        },
        select: { id: true, ...REPORT_ORDER_SELECT },
      }),
      prisma.order.groupBy({
        by: ["customerId"],
        where: {
          ...completedOrderFilter,
          customerId: { in: customerIds },
        },
        _max: { orderDate: true },
      }),
      prisma.partyMonthlySalesTarget.findMany({
        where: {
          year,
          month,
          customerId: { in: customerIds },
        },
        select: {
          customerId: true,
          targetAmount: true,
          targetVehicles: true,
        },
      }),
    ]);

    const lastBillingByCustomer = new Map<string, string | null>();
    for (const g of lastBillingGroups) {
      lastBillingByCustomer.set(
        g.customerId,
        g._max.orderDate ? formatBillingDate(g._max.orderDate, timeZone) : null
      );
    }

    const targetsByCustomer = new Map(
      targets.map((t) => [
        t.customerId,
        {
          targetAmount: t.targetAmount,
          targetVehicles: t.targetVehicles,
        },
      ])
    );

    const metricsByCustomer = new Map<string, PartyMetrics>();
    const vehicleCountPrev1 = new Map<string, number>();
    const vehicleCountPrev2 = new Map<string, number>();

    for (const id of customerIds) {
      const metrics = emptyMetrics(daysInMonth);
      const target = targetsByCustomer.get(id);
      metrics.targetAmount = target?.targetAmount ?? null;
      metrics.targetVehicles = target?.targetVehicles ?? null;
      metricsByCustomer.set(id, metrics);
      vehicleCountPrev1.set(id, 0);
      vehicleCountPrev2.set(id, 0);
    }

    for (const order of orders) {
      const parts = getZonedDateParts(order.orderDate, timeZone);
      const saleAmount = computeOrderGrossSaleForReport(order);
      const customerId = order.customerId;
      const metrics = metricsByCustomer.get(customerId);
      if (!metrics) continue;

      if (parts.year === prev2.year && parts.month === prev2.month) {
        vehicleCountPrev2.set(customerId, (vehicleCountPrev2.get(customerId) ?? 0) + 1);
        metrics.monthTotals.prev2 += saleAmount;
      } else if (parts.year === prev1.year && parts.month === prev1.month) {
        vehicleCountPrev1.set(customerId, (vehicleCountPrev1.get(customerId) ?? 0) + 1);
        metrics.monthTotals.prev1 += saleAmount;
      } else if (parts.year === year && parts.month === month) {
        const dayIndex = parts.day - 1;
        if (dayIndex >= 0 && dayIndex < daysInMonth) {
          metrics.dailySales[dayIndex] += saleAmount;
          metrics.monthTotals.current += saleAmount;
          metrics.dailyOrderIds[dayIndex].push(order.id);
        }
        if (!isCurrentMonth || parts.day <= todayDay) {
          metrics.vehiclesSoldTillDate += 1;
        }
      }
    }

    for (const id of customerIds) {
      const metrics = metricsByCustomer.get(id)!;
      const c1 = vehicleCountPrev1.get(id) ?? 0;
      const c2 = vehicleCountPrev2.get(id) ?? 0;
      metrics.avgMonthlyVehicles = Math.round((c1 + c2) / 2);
    }

    const tagMap = new Map<
      string,
      {
        id: string;
        name: string;
        headerColor: string;
        sortOrder: number;
        parties: Array<{
          customerId: string;
          partyName: string;
          lastBillingDate: string | null;
          avgMonthlyVehicles: number;
          vehiclesSoldTillDate: number;
          dailySales: number[];
          dailyOrderIds: string[][];
          monthTotals: { current: number; prev1: number; prev2: number };
          targetAmount: number | null;
          targetVehicles: number | null;
          balanceAmountTarget: number | null;
          balanceVehicleTarget: number | null;
        }>;
        subtotalMetrics: PartyMetrics;
      }
    >();

    for (const tag of tags) {
      tagMap.set(tag.id, {
        id: tag.id,
        name: tag.name,
        headerColor: tag.headerColor,
        sortOrder: tag.sortOrder,
        parties: [],
        subtotalMetrics: emptyMetrics(daysInMonth),
      });
    }

    for (const party of taggedParties) {
      const metrics = metricsByCustomer.get(party.customerId) ?? emptyMetrics(daysInMonth);
      const tagEntry = tagMap.get(party.tagId)!;
      tagEntry.parties.push({
        customerId: party.customerId,
        partyName: party.partyName,
        ...metricsToPartyRow(
          metrics,
          lastBillingByCustomer.get(party.customerId) ?? null
        ),
      });
      tagEntry.subtotalMetrics = sumMetrics(tagEntry.subtotalMetrics, metrics);
    }

    const reportTags = Array.from(tagMap.values())
      .filter((t) => t.parties.length > 0)
      .map((t) => ({
        id: t.id,
        name: t.name,
        headerColor: t.headerColor,
        sortOrder: t.sortOrder,
        parties: t.parties,
        subtotal: metricsToRow(t.subtotalMetrics, null),
      }));

    let grandTotalMetrics = emptyMetrics(daysInMonth);
    for (const tag of reportTags) {
      const tagMetrics = tagMap.get(tag.id)!.subtotalMetrics;
      grandTotalMetrics = sumMetrics(grandTotalMetrics, tagMetrics);
    }

    const grandTotal = metricsToRow(grandTotalMetrics, null);

    res.json({
      monthLabel: formatMonthLabel(year, month),
      year,
      month,
      daysInMonth,
      todayDay,
      isCurrentMonth,
      sundays: Array.from({ length: daysInMonth }, (_, i) => isSunday(year, month, i + 1)),
      monthLabels: {
        current: formatMonthLabel(year, month),
        prev1: formatMonthLabel(prev1.year, prev1.month),
        prev2: formatMonthLabel(prev2.year, prev2.month),
      },
      vehicleSoldTillLabel: formatMonthLabel(year, month),
      tags: reportTags,
      grandTotal,
      compare: {
        prev1Percent: percentChange(grandTotal.monthTotals.current, grandTotal.monthTotals.prev1),
        prev2Percent: percentChange(grandTotal.monthTotals.prev1, grandTotal.monthTotals.prev2),
        vehicleSoldPercent: percentChange(
          grandTotal.vehiclesSoldTillDate,
          grandTotal.avgMonthlyVehicles
        ),
      },
    });
  } catch (error) {
    console.error("Party-wise sales report error:", error);
    res.status(500).json({ message: "Failed to load party-wise sales report" });
  }
};

export const upsertPartyMonthlySalesTarget = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const parsed = UpsertPartyMonthlySalesTargetSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.flatten() });
    }

    const { customerId, year, month, targetAmount, targetVehicles } = parsed.data;

    const customer = await prisma.user.findFirst({
      where: { id: customerId, userType: "CUSTOMER" },
      select: { id: true },
    });
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    const existing = await prisma.partyMonthlySalesTarget.findUnique({
      where: {
        customerId_year_month: { customerId, year, month },
      },
      select: {
        targetAmount: true,
        targetVehicles: true,
      },
    });

    const nextTargetAmount =
      targetAmount !== undefined ? targetAmount : (existing?.targetAmount ?? null);
    const nextTargetVehicles =
      targetVehicles !== undefined ? targetVehicles : (existing?.targetVehicles ?? null);

    const record = await prisma.partyMonthlySalesTarget.upsert({
      where: {
        customerId_year_month: { customerId, year, month },
      },
      create: {
        customerId,
        year,
        month,
        targetAmount: nextTargetAmount,
        targetVehicles: nextTargetVehicles,
      },
      update: {
        ...(targetAmount !== undefined ? { targetAmount } : {}),
        ...(targetVehicles !== undefined ? { targetVehicles } : {}),
      },
      select: {
        customerId: true,
        year: true,
        month: true,
        targetAmount: true,
        targetVehicles: true,
      },
    });

    res.json(record);
  } catch (error) {
    console.error("Upsert party monthly sales target error:", error);
    res.status(500).json({ message: "Failed to save party monthly sales target" });
  }
};

export const upsertPartyMonthlySalesTargetsBulk = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const parsed = BulkUpsertPartyMonthlySalesTargetSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.flatten() });
    }

    const { year, month, targets } = parsed.data;
    const customerIds = [...new Set(targets.map((t) => t.customerId))];

    const customers = await prisma.user.findMany({
      where: { id: { in: customerIds }, userType: "CUSTOMER" },
      select: { id: true },
    });
    const foundIds = new Set(customers.map((c) => c.id));
    const missing = customerIds.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      return res.status(404).json({
        message: "One or more customers not found",
        customerIds: missing,
      });
    }

    const existingRows = await prisma.partyMonthlySalesTarget.findMany({
      where: {
        year,
        month,
        customerId: { in: customerIds },
      },
      select: {
        customerId: true,
        targetAmount: true,
        targetVehicles: true,
      },
    });
    const existingByCustomer = new Map(
      existingRows.map((row) => [row.customerId, row])
    );

    const saved = [];
    for (const target of targets) {
      const { customerId, targetAmount, targetVehicles } = target;
      const existing = existingByCustomer.get(customerId);

      const nextTargetAmount =
        targetAmount !== undefined ? targetAmount : (existing?.targetAmount ?? null);
      const nextTargetVehicles =
        targetVehicles !== undefined
          ? targetVehicles
          : (existing?.targetVehicles ?? null);

      const record = await prisma.partyMonthlySalesTarget.upsert({
        where: {
          customerId_year_month: { customerId, year, month },
        },
        create: {
          customerId,
          year,
          month,
          targetAmount: nextTargetAmount,
          targetVehicles: nextTargetVehicles,
        },
        update: {
          ...(targetAmount !== undefined ? { targetAmount } : {}),
          ...(targetVehicles !== undefined ? { targetVehicles } : {}),
        },
        select: {
          customerId: true,
          year: true,
          month: true,
          targetAmount: true,
          targetVehicles: true,
        },
      });
      saved.push(record);
    }

    res.json({ saved });
  } catch (error) {
    console.error("Bulk upsert party monthly sales targets error:", error);
    res
      .status(500)
      .json({ message: "Failed to save party monthly sales targets" });
  }
};
