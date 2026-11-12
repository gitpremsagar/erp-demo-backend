import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { FuelConsumptionReportQuerySchema } from "../libs/schemas/fuelConsumptionReport.schema";
import {
  FUEL_CONSUMPTION_EDITABLE_FIELDS,
  UpdateFuelConsumptionEntrySchema,
  type FuelConsumptionEditableField,
} from "../libs/schemas/fuelConsumptionEntry.schema";
import {
  FuelConsumptionOrdersQuerySchema,
  type FuelConsumptionDistancePeriod,
} from "../libs/schemas/fuelConsumptionOrders.schema";
import {
  orderTwoSideDistanceSelect,
  resolveOrderTwoSideDistance,
} from "../lib/orderTwoSideDistance";

function roundLiters(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundMileage(value: number): number {
  return Math.round(value * 100) / 100;
}

function actualMileageFromDistance(
  distanceKm: number,
  fuelLiters: number | null
): number | null {
  if (fuelLiters == null || fuelLiters <= 0) return null;
  if (distanceKm <= 0) return 0;
  return roundMileage(distanceKm / fuelLiters);
}

function sumActualMonthlyFuel(
  first: number | null,
  second: number | null
): number | null {
  if (first == null && second == null) return null;
  return roundLiters((first ?? 0) + (second ?? 0));
}

type DistanceAgg = {
  total: number;
  firstHalf: number;
  secondHalf: number;
};

type FuelConsumptionRecordData = {
  actualFuelFirstHalf: number | null;
  actualFuelSecondHalf: number | null;
  meterReadingDay1: number | null;
  meterReadingDay16: number | null;
  meterReadingLastDay: number | null;
};

const fuelConsumptionRecordSelect = {
  actualFuelFirstHalf: true,
  actualFuelSecondHalf: true,
  meterReadingDay1: true,
  meterReadingDay16: true,
  meterReadingLastDay: true,
} as const;

function roundDistanceKm(value: number): number {
  return Math.round(value * 100) / 100;
}

function travelFromMeters(
  start: number | null | undefined,
  end: number | null | undefined
): number | null {
  if (start == null || end == null) return null;
  if (end < start) return null;
  return roundDistanceKm(end - start);
}

function buildMeterTravel(record: FuelConsumptionRecordData | null) {
  const day1 = record?.meterReadingDay1 ?? null;
  const day16 = record?.meterReadingDay16 ?? null;
  const lastDay = record?.meterReadingLastDay ?? null;

  return {
    actualTravelFirstHalf: travelFromMeters(day1, day16),
    actualTravelSecondHalf: travelFromMeters(day16, lastDay),
    actualTravelMonth: travelFromMeters(day1, lastDay),
  };
}

function validateMeterReadings(
  day1: number | null,
  day16: number | null,
  lastDay: number | null
): string | null {
  if (day1 != null && day16 != null && day16 < day1) {
    return "Meter reading on 16th must be greater than or equal to reading on 1st";
  }
  if (day16 != null && lastDay != null && lastDay < day16) {
    return "Meter reading on last day must be greater than or equal to reading on 16th";
  }
  if (day1 != null && lastDay != null && lastDay < day1) {
    return "Meter reading on last day must be greater than or equal to reading on 1st";
  }
  return null;
}

function buildFuelConsumptionRow(
  vehicleId: string,
  vehicleNumber: string,
  mileage: number | null,
  agg: DistanceAgg,
  record: FuelConsumptionRecordData | null
) {
  const actualFuelFirstHalf = record?.actualFuelFirstHalf ?? null;
  const actualFuelSecondHalf = record?.actualFuelSecondHalf ?? null;
  const meterReadingDay1 = record?.meterReadingDay1 ?? null;
  const meterReadingDay16 = record?.meterReadingDay16 ?? null;
  const meterReadingLastDay = record?.meterReadingLastDay ?? null;
  const actualMonthlyFuel = sumActualMonthlyFuel(
    actualFuelFirstHalf,
    actualFuelSecondHalf
  );
  const {
    actualTravelFirstHalf,
    actualTravelSecondHalf,
    actualTravelMonth,
  } = buildMeterTravel(record);

  return {
    vehicleId,
    vehicleNumber,
    mileage,
    meterReadingDay1,
    meterReadingDay16,
    meterReadingLastDay,
    estimatedTravelMonth: roundDistanceKm(agg.total),
    estimatedTravelFirstHalf: roundDistanceKm(agg.firstHalf),
    estimatedTravelSecondHalf: roundDistanceKm(agg.secondHalf),
    actualTravelMonth,
    actualTravelFirstHalf,
    actualTravelSecondHalf,
    totalFuelLiters: fuelFromDistance(agg.total, mileage),
    firstHalfFuelLiters: fuelFromDistance(agg.firstHalf, mileage),
    secondHalfFuelLiters: fuelFromDistance(agg.secondHalf, mileage),
    actualFuelFirstHalf,
    actualFuelSecondHalf,
    actualMonthlyFuel,
    actualMileageMonth:
      actualTravelMonth != null
        ? actualMileageFromDistance(actualTravelMonth, actualMonthlyFuel)
        : null,
    actualMileageFirstHalf:
      actualTravelFirstHalf != null
        ? actualMileageFromDistance(actualTravelFirstHalf, actualFuelFirstHalf)
        : null,
    actualMileageSecondHalf:
      actualTravelSecondHalf != null
        ? actualMileageFromDistance(actualTravelSecondHalf, actualFuelSecondHalf)
        : null,
  };
}

function fuelFromDistance(distanceKm: number, mileage: number | null): number | null {
  if (mileage == null || mileage <= 0) return null;
  if (distanceKm <= 0) return 0;
  return roundLiters(distanceKm / mileage);
}

function getIstDayOfMonth(orderDate: Date): number {
  const dayStr = orderDate.toLocaleDateString("en-CA", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
  });
  return parseInt(dayStr, 10);
}

function monthRangeIst(year: number, month: number): { start: Date; end: Date } {
  const lastDay = new Date(year, month, 0).getDate();
  const mm = String(month).padStart(2, "0");
  return {
    start: new Date(`${year}-${mm}-01T00:00:00.000+05:30`),
    end: new Date(`${year}-${mm}-${String(lastDay).padStart(2, "0")}T23:59:59.999+05:30`),
  };
}

function orderMatchesFuelPeriod(
  orderDate: Date,
  period: FuelConsumptionDistancePeriod
): boolean {
  if (period === "month") return true;
  const day = getIstDayOfMonth(orderDate);
  if (period === "firstHalf") return day <= 15;
  return day > 15;
}

// Vehicle Controllers
export const createVehicle = async (req: Request, res: Response) => {
  try {
    const { vehicleName, vehicleNumber, vehicleTypeId, capacity, mileage } = req.body;

    const vehicleType = await prisma.vehicleType.findUnique({
      where: { id: vehicleTypeId },
    });
    if (!vehicleType) {
      return res.status(400).json({ message: "Invalid vehicle type" });
    }

    const existingVehicle = await prisma.vehicle.findUnique({
      where: { vehicleNumber },
    });

    if (existingVehicle) {
      return res.status(409).json({ message: "Vehicle number already exists" });
    }

    const vehicle = await prisma.vehicle.create({
      data: { vehicleName, vehicleNumber, vehicleTypeId, capacity, mileage },
      include: { VehicleType: true },
    });

    res.status(201).json({ vehicle });
  } catch (error) {
    console.error("Error creating vehicle:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getVehicles = async (req: Request, res: Response) => {
  try {
    let vehicles: Array<{
      id: string;
      vehicleName: string;
      vehicleNumber: string;
      vehicleTypeId: string;
      capacity: number;
      mileage: number | null;
      createdAt: Date;
      updatedAt: Date;
      VehicleType: { id: string; name: string } | null;
    }>;
    try {
      vehicles = await prisma.vehicle.findMany({
        orderBy: { vehicleName: "asc" },
        include: { VehicleType: true },
      });
    } catch (includeError) {
      console.warn("Vehicles fetch with VehicleType failed, trying plain fetch:", includeError);
      try {
        const plain = await prisma.vehicle.findMany({
          orderBy: { vehicleName: "asc" },
        });
        const typeIds = [...new Set(plain.map((v) => v.vehicleTypeId).filter(Boolean))];
        const types = typeIds.length
          ? await prisma.vehicleType.findMany({ where: { id: { in: typeIds } } })
          : [];
        const typeMap = new Map(types.map((t) => [t.id, t]));
        vehicles = plain.map((v) => ({
          ...v,
          VehicleType: v.vehicleTypeId ? typeMap.get(v.vehicleTypeId) ?? null : null,
        }));
      } catch (fallbackError) {
        console.error("Vehicles fetch failed entirely, returning empty list:", fallbackError);
        vehicles = [];
      }
    }

    res.json({ vehicles });
  } catch (error) {
    console.error("Error fetching vehicles:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getFuelConsumptionReport = async (req: Request, res: Response) => {
  try {
    const parsed = FuelConsumptionReportQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.flatten() });
    }
    const { year, month } = parsed.data;
    const { start, end } = monthRangeIst(year, month);

    const vehicles = await prisma.vehicle.findMany({
      orderBy: { vehicleNumber: "asc" },
      select: { id: true, vehicleNumber: true, mileage: true },
    });

    const distanceByVehicle = new Map<string, DistanceAgg>();

    const orders = await prisma.order.findMany({
      where: {
        vehicleId: { not: null },
        orderDate: { gte: start, lte: end },
      },
      select: {
        vehicleId: true,
        orderDate: true,
        ...orderTwoSideDistanceSelect,
      },
    });

    for (const order of orders) {
      if (!order.vehicleId) continue;
      const distance = resolveOrderTwoSideDistance(order);
      let agg = distanceByVehicle.get(order.vehicleId);
      if (!agg) {
        agg = { total: 0, firstHalf: 0, secondHalf: 0 };
        distanceByVehicle.set(order.vehicleId, agg);
      }
      agg.total += distance;
      const day = getIstDayOfMonth(order.orderDate);
      if (day <= 15) {
        agg.firstHalf += distance;
      } else {
        agg.secondHalf += distance;
      }
    }

    const records = await prisma.fuelConsumptionRecord.findMany({
      where: { year, month },
      select: {
        vehicleId: true,
        ...fuelConsumptionRecordSelect,
      },
    });
    const recordByVehicle = new Map(records.map((r) => [r.vehicleId, r]));

    const rows = vehicles.map((v) => {
      const agg = distanceByVehicle.get(v.id) ?? {
        total: 0,
        firstHalf: 0,
        secondHalf: 0,
      };
      return buildFuelConsumptionRow(
        v.id,
        v.vehicleNumber,
        v.mileage,
        agg,
        recordByVehicle.get(v.id) ?? null
      );
    });

    res.json({ year, month, rows });
  } catch (error) {
    console.error("Error fetching fuel consumption report:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getFuelConsumptionOrders = async (req: Request, res: Response) => {
  try {
    const parsed = FuelConsumptionOrdersQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.flatten() });
    }

    const { year, month, vehicleId, period } = parsed.data;
    const { start, end } = monthRangeIst(year, month);

    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { id: true },
    });
    if (!vehicle) {
      return res.status(404).json({ message: "Vehicle not found" });
    }

    const orders = await prisma.order.findMany({
      where: {
        vehicleId,
        orderDate: { gte: start, lte: end },
      },
      orderBy: { orderDate: "asc" },
      select: {
        id: true,
        customeOrderId: true,
        orderDate: true,
        ...orderTwoSideDistanceSelect,
      },
    });

    const filtered = orders.filter((o) => orderMatchesFuelPeriod(o.orderDate, period));

    const lines = filtered.map((o) => ({
      orderId: o.id,
      orderCustomId: o.customeOrderId,
      orderDbName: o.Customer?.CustomerDetail?.[0]?.dbName ?? null,
      orderDate: o.orderDate.toISOString(),
      twoSideDistance: resolveOrderTwoSideDistance(o),
    }));

    const totalDistanceKm = lines.reduce((sum, line) => sum + line.twoSideDistance, 0);

    res.json({ orders: lines, totalDistanceKm });
  } catch (error) {
    console.error("Error fetching fuel consumption orders:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

async function getDistanceAggForVehicle(
  vehicleId: string,
  year: number,
  month: number
): Promise<DistanceAgg> {
  const { start, end } = monthRangeIst(year, month);
  const orders = await prisma.order.findMany({
    where: {
      vehicleId,
      orderDate: { gte: start, lte: end },
    },
    select: {
      orderDate: true,
      ...orderTwoSideDistanceSelect,
    },
  });

  const agg: DistanceAgg = { total: 0, firstHalf: 0, secondHalf: 0 };
  for (const order of orders) {
    const distance = resolveOrderTwoSideDistance(order);
    agg.total += distance;
    const day = getIstDayOfMonth(order.orderDate);
    if (day <= 15) {
      agg.firstHalf += distance;
    } else {
      agg.secondHalf += distance;
    }
  }
  return agg;
}

export const updateFuelConsumptionEntry = async (req: Request, res: Response) => {
  try {
    const parsed = UpdateFuelConsumptionEntrySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.flatten() });
    }

    const { year, month, vehicleId, field, value } = parsed.data;

    if (!FUEL_CONSUMPTION_EDITABLE_FIELDS.includes(field as FuelConsumptionEditableField)) {
      return res.status(400).json({ message: "Invalid field" });
    }

    const isMeterField =
      field === "meterReadingDay1" ||
      field === "meterReadingDay16" ||
      field === "meterReadingLastDay";

    let dataValue: number | null;
    if (value === undefined || value === null) {
      dataValue = null;
    } else if (typeof value !== "number" || value < 0) {
      return res.status(400).json({ message: "Value must be a non-negative number" });
    } else {
      dataValue = isMeterField ? Math.round(value) : roundLiters(value);
    }

    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { id: true, vehicleNumber: true, mileage: true },
    });
    if (!vehicle) {
      return res.status(404).json({ message: "Vehicle not found" });
    }

    const existing = await prisma.fuelConsumptionRecord.findUnique({
      where: {
        vehicleId_year_month: { vehicleId, year, month },
      },
      select: fuelConsumptionRecordSelect,
    });

    const merged: FuelConsumptionRecordData = {
      actualFuelFirstHalf:
        field === "actualFuelFirstHalf"
          ? dataValue
          : (existing?.actualFuelFirstHalf ?? null),
      actualFuelSecondHalf:
        field === "actualFuelSecondHalf"
          ? dataValue
          : (existing?.actualFuelSecondHalf ?? null),
      meterReadingDay1:
        field === "meterReadingDay1"
          ? dataValue
          : (existing?.meterReadingDay1 ?? null),
      meterReadingDay16:
        field === "meterReadingDay16"
          ? dataValue
          : (existing?.meterReadingDay16 ?? null),
      meterReadingLastDay:
        field === "meterReadingLastDay"
          ? dataValue
          : (existing?.meterReadingLastDay ?? null),
    };

    const meterError = validateMeterReadings(
      merged.meterReadingDay1,
      merged.meterReadingDay16,
      merged.meterReadingLastDay
    );
    if (meterError) {
      return res.status(400).json({ message: meterError });
    }

    const record = await prisma.fuelConsumptionRecord.upsert({
      where: {
        vehicleId_year_month: { vehicleId, year, month },
      },
      create: {
        vehicleId,
        year,
        month,
        ...merged,
      },
      update: {
        [field]: dataValue,
      },
      select: fuelConsumptionRecordSelect,
    });

    const agg = await getDistanceAggForVehicle(vehicleId, year, month);
    const row = buildFuelConsumptionRow(
      vehicle.id,
      vehicle.vehicleNumber,
      vehicle.mileage,
      agg,
      record
    );

    res.json(row);
  } catch (error) {
    console.error("Error updating fuel consumption entry:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getVehicleById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
      include: { VehicleType: true },
    });

    if (!vehicle) {
      return res.status(404).json({ message: "Vehicle not found" });
    }

    res.json({ vehicle });
  } catch (error) {
    console.error("Error fetching vehicle:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const updateVehicle = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { vehicleName, vehicleNumber, vehicleTypeId, capacity, mileage } = req.body;

    const existingVehicle = await prisma.vehicle.findUnique({
      where: { id },
    });

    if (!existingVehicle) {
      return res.status(404).json({ message: "Vehicle not found" });
    }

    if (vehicleTypeId) {
      const vehicleType = await prisma.vehicleType.findUnique({
        where: { id: vehicleTypeId },
      });
      if (!vehicleType) {
        return res.status(400).json({ message: "Invalid vehicle type" });
      }
    }

    if (vehicleNumber && vehicleNumber !== existingVehicle.vehicleNumber) {
      const duplicateVehicle = await prisma.vehicle.findUnique({
        where: { vehicleNumber },
      });

      if (duplicateVehicle) {
        return res.status(409).json({ message: "Vehicle number already exists" });
      }
    }

    const vehicle = await prisma.vehicle.update({
      where: { id },
      data: {
        ...(vehicleName !== undefined ? { vehicleName } : {}),
        ...(vehicleNumber !== undefined ? { vehicleNumber } : {}),
        ...(vehicleTypeId !== undefined ? { vehicleTypeId } : {}),
        ...(capacity !== undefined ? { capacity } : {}),
        ...(mileage !== undefined ? { mileage } : {}),
      },
      include: { VehicleType: true },
    });

    res.json({ vehicle });
  } catch (error) {
    console.error("Error updating vehicle:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteVehicle = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existingVehicle = await prisma.vehicle.findUnique({
      where: { id },
    });

    if (!existingVehicle) {
      return res.status(404).json({ message: "Vehicle not found" });
    }

    await prisma.vehicle.delete({
      where: { id },
    });

    res.json({ message: "Vehicle deleted successfully" });
  } catch (error) {
    console.error("Error deleting vehicle:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
