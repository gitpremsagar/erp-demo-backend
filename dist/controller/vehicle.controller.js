"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteVehicle = exports.updateVehicle = exports.getVehicleById = exports.updateFuelConsumptionEntry = exports.getFuelConsumptionOrders = exports.getFuelConsumptionReport = exports.getVehicles = exports.createVehicle = void 0;
const prisma_1 = require("../lib/prisma");
const fuelConsumptionReport_schema_1 = require("../libs/schemas/fuelConsumptionReport.schema");
const fuelConsumptionEntry_schema_1 = require("../libs/schemas/fuelConsumptionEntry.schema");
const fuelConsumptionOrders_schema_1 = require("../libs/schemas/fuelConsumptionOrders.schema");
const orderTwoSideDistance_1 = require("../lib/orderTwoSideDistance");
function roundLiters(value) {
    return Math.round(value * 100) / 100;
}
function roundMileage(value) {
    return Math.round(value * 100) / 100;
}
function actualMileageFromDistance(distanceKm, fuelLiters) {
    if (fuelLiters == null || fuelLiters <= 0)
        return null;
    if (distanceKm <= 0)
        return 0;
    return roundMileage(distanceKm / fuelLiters);
}
function sumActualMonthlyFuel(first, second) {
    if (first == null && second == null)
        return null;
    return roundLiters((first ?? 0) + (second ?? 0));
}
const fuelConsumptionRecordSelect = {
    actualFuelFirstHalf: true,
    actualFuelSecondHalf: true,
    meterReadingDay1: true,
    meterReadingDay16: true,
    meterReadingLastDay: true,
};
function roundDistanceKm(value) {
    return Math.round(value * 100) / 100;
}
function travelFromMeters(start, end) {
    if (start == null || end == null)
        return null;
    if (end < start)
        return null;
    return roundDistanceKm(end - start);
}
function buildMeterTravel(record) {
    const day1 = record?.meterReadingDay1 ?? null;
    const day16 = record?.meterReadingDay16 ?? null;
    const lastDay = record?.meterReadingLastDay ?? null;
    return {
        actualTravelFirstHalf: travelFromMeters(day1, day16),
        actualTravelSecondHalf: travelFromMeters(day16, lastDay),
        actualTravelMonth: travelFromMeters(day1, lastDay),
    };
}
function validateMeterReadings(day1, day16, lastDay) {
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
function buildFuelConsumptionRow(vehicleId, vehicleNumber, mileage, agg, record) {
    const actualFuelFirstHalf = record?.actualFuelFirstHalf ?? null;
    const actualFuelSecondHalf = record?.actualFuelSecondHalf ?? null;
    const meterReadingDay1 = record?.meterReadingDay1 ?? null;
    const meterReadingDay16 = record?.meterReadingDay16 ?? null;
    const meterReadingLastDay = record?.meterReadingLastDay ?? null;
    const actualMonthlyFuel = sumActualMonthlyFuel(actualFuelFirstHalf, actualFuelSecondHalf);
    const { actualTravelFirstHalf, actualTravelSecondHalf, actualTravelMonth, } = buildMeterTravel(record);
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
        actualMileageMonth: actualTravelMonth != null
            ? actualMileageFromDistance(actualTravelMonth, actualMonthlyFuel)
            : null,
        actualMileageFirstHalf: actualTravelFirstHalf != null
            ? actualMileageFromDistance(actualTravelFirstHalf, actualFuelFirstHalf)
            : null,
        actualMileageSecondHalf: actualTravelSecondHalf != null
            ? actualMileageFromDistance(actualTravelSecondHalf, actualFuelSecondHalf)
            : null,
    };
}
function fuelFromDistance(distanceKm, mileage) {
    if (mileage == null || mileage <= 0)
        return null;
    if (distanceKm <= 0)
        return 0;
    return roundLiters(distanceKm / mileage);
}
function getIstDayOfMonth(orderDate) {
    const dayStr = orderDate.toLocaleDateString("en-CA", {
        timeZone: "Asia/Kolkata",
        day: "numeric",
    });
    return parseInt(dayStr, 10);
}
function monthRangeIst(year, month) {
    const lastDay = new Date(year, month, 0).getDate();
    const mm = String(month).padStart(2, "0");
    return {
        start: new Date(`${year}-${mm}-01T00:00:00.000+05:30`),
        end: new Date(`${year}-${mm}-${String(lastDay).padStart(2, "0")}T23:59:59.999+05:30`),
    };
}
function orderMatchesFuelPeriod(orderDate, period) {
    if (period === "month")
        return true;
    const day = getIstDayOfMonth(orderDate);
    if (period === "firstHalf")
        return day <= 15;
    return day > 15;
}
// Vehicle Controllers
const createVehicle = async (req, res) => {
    try {
        const { vehicleName, vehicleNumber, vehicleTypeId, capacity, mileage } = req.body;
        const vehicleType = await prisma_1.prisma.vehicleType.findUnique({
            where: { id: vehicleTypeId },
        });
        if (!vehicleType) {
            return res.status(400).json({ message: "Invalid vehicle type" });
        }
        const existingVehicle = await prisma_1.prisma.vehicle.findUnique({
            where: { vehicleNumber },
        });
        if (existingVehicle) {
            return res.status(409).json({ message: "Vehicle number already exists" });
        }
        const vehicle = await prisma_1.prisma.vehicle.create({
            data: { vehicleName, vehicleNumber, vehicleTypeId, capacity, mileage },
            include: { VehicleType: true },
        });
        res.status(201).json({ vehicle });
    }
    catch (error) {
        console.error("Error creating vehicle:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.createVehicle = createVehicle;
const getVehicles = async (req, res) => {
    try {
        let vehicles;
        try {
            vehicles = await prisma_1.prisma.vehicle.findMany({
                orderBy: { vehicleName: "asc" },
                include: { VehicleType: true },
            });
        }
        catch (includeError) {
            console.warn("Vehicles fetch with VehicleType failed, trying plain fetch:", includeError);
            try {
                const plain = await prisma_1.prisma.vehicle.findMany({
                    orderBy: { vehicleName: "asc" },
                });
                const typeIds = [...new Set(plain.map((v) => v.vehicleTypeId).filter(Boolean))];
                const types = typeIds.length
                    ? await prisma_1.prisma.vehicleType.findMany({ where: { id: { in: typeIds } } })
                    : [];
                const typeMap = new Map(types.map((t) => [t.id, t]));
                vehicles = plain.map((v) => ({
                    ...v,
                    VehicleType: v.vehicleTypeId ? typeMap.get(v.vehicleTypeId) ?? null : null,
                }));
            }
            catch (fallbackError) {
                console.error("Vehicles fetch failed entirely, returning empty list:", fallbackError);
                vehicles = [];
            }
        }
        res.json({ vehicles });
    }
    catch (error) {
        console.error("Error fetching vehicles:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.getVehicles = getVehicles;
const getFuelConsumptionReport = async (req, res) => {
    try {
        const parsed = fuelConsumptionReport_schema_1.FuelConsumptionReportQuerySchema.safeParse(req.query);
        if (!parsed.success) {
            return res.status(400).json({ message: parsed.error.flatten() });
        }
        const { year, month } = parsed.data;
        const { start, end } = monthRangeIst(year, month);
        const vehicles = await prisma_1.prisma.vehicle.findMany({
            orderBy: { vehicleNumber: "asc" },
            select: { id: true, vehicleNumber: true, mileage: true },
        });
        const distanceByVehicle = new Map();
        const orders = await prisma_1.prisma.order.findMany({
            where: {
                vehicleId: { not: null },
                orderDate: { gte: start, lte: end },
            },
            select: {
                vehicleId: true,
                orderDate: true,
                ...orderTwoSideDistance_1.orderTwoSideDistanceSelect,
            },
        });
        for (const order of orders) {
            if (!order.vehicleId)
                continue;
            const distance = (0, orderTwoSideDistance_1.resolveOrderTwoSideDistance)(order);
            let agg = distanceByVehicle.get(order.vehicleId);
            if (!agg) {
                agg = { total: 0, firstHalf: 0, secondHalf: 0 };
                distanceByVehicle.set(order.vehicleId, agg);
            }
            agg.total += distance;
            const day = getIstDayOfMonth(order.orderDate);
            if (day <= 15) {
                agg.firstHalf += distance;
            }
            else {
                agg.secondHalf += distance;
            }
        }
        const records = await prisma_1.prisma.fuelConsumptionRecord.findMany({
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
            return buildFuelConsumptionRow(v.id, v.vehicleNumber, v.mileage, agg, recordByVehicle.get(v.id) ?? null);
        });
        res.json({ year, month, rows });
    }
    catch (error) {
        console.error("Error fetching fuel consumption report:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.getFuelConsumptionReport = getFuelConsumptionReport;
const getFuelConsumptionOrders = async (req, res) => {
    try {
        const parsed = fuelConsumptionOrders_schema_1.FuelConsumptionOrdersQuerySchema.safeParse(req.query);
        if (!parsed.success) {
            return res.status(400).json({ message: parsed.error.flatten() });
        }
        const { year, month, vehicleId, period } = parsed.data;
        const { start, end } = monthRangeIst(year, month);
        const vehicle = await prisma_1.prisma.vehicle.findUnique({
            where: { id: vehicleId },
            select: { id: true },
        });
        if (!vehicle) {
            return res.status(404).json({ message: "Vehicle not found" });
        }
        const orders = await prisma_1.prisma.order.findMany({
            where: {
                vehicleId,
                orderDate: { gte: start, lte: end },
            },
            orderBy: { orderDate: "asc" },
            select: {
                id: true,
                customeOrderId: true,
                orderDate: true,
                ...orderTwoSideDistance_1.orderTwoSideDistanceSelect,
            },
        });
        const filtered = orders.filter((o) => orderMatchesFuelPeriod(o.orderDate, period));
        const lines = filtered.map((o) => ({
            orderId: o.id,
            orderCustomId: o.customeOrderId,
            orderDbName: o.Customer?.CustomerDetail?.[0]?.dbName ?? null,
            orderDate: o.orderDate.toISOString(),
            twoSideDistance: (0, orderTwoSideDistance_1.resolveOrderTwoSideDistance)(o),
        }));
        const totalDistanceKm = lines.reduce((sum, line) => sum + line.twoSideDistance, 0);
        res.json({ orders: lines, totalDistanceKm });
    }
    catch (error) {
        console.error("Error fetching fuel consumption orders:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.getFuelConsumptionOrders = getFuelConsumptionOrders;
async function getDistanceAggForVehicle(vehicleId, year, month) {
    const { start, end } = monthRangeIst(year, month);
    const orders = await prisma_1.prisma.order.findMany({
        where: {
            vehicleId,
            orderDate: { gte: start, lte: end },
        },
        select: {
            orderDate: true,
            ...orderTwoSideDistance_1.orderTwoSideDistanceSelect,
        },
    });
    const agg = { total: 0, firstHalf: 0, secondHalf: 0 };
    for (const order of orders) {
        const distance = (0, orderTwoSideDistance_1.resolveOrderTwoSideDistance)(order);
        agg.total += distance;
        const day = getIstDayOfMonth(order.orderDate);
        if (day <= 15) {
            agg.firstHalf += distance;
        }
        else {
            agg.secondHalf += distance;
        }
    }
    return agg;
}
const updateFuelConsumptionEntry = async (req, res) => {
    try {
        const parsed = fuelConsumptionEntry_schema_1.UpdateFuelConsumptionEntrySchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ message: parsed.error.flatten() });
        }
        const { year, month, vehicleId, field, value } = parsed.data;
        if (!fuelConsumptionEntry_schema_1.FUEL_CONSUMPTION_EDITABLE_FIELDS.includes(field)) {
            return res.status(400).json({ message: "Invalid field" });
        }
        const isMeterField = field === "meterReadingDay1" ||
            field === "meterReadingDay16" ||
            field === "meterReadingLastDay";
        let dataValue;
        if (value === undefined || value === null) {
            dataValue = null;
        }
        else if (typeof value !== "number" || value < 0) {
            return res.status(400).json({ message: "Value must be a non-negative number" });
        }
        else {
            dataValue = isMeterField ? Math.round(value) : roundLiters(value);
        }
        const vehicle = await prisma_1.prisma.vehicle.findUnique({
            where: { id: vehicleId },
            select: { id: true, vehicleNumber: true, mileage: true },
        });
        if (!vehicle) {
            return res.status(404).json({ message: "Vehicle not found" });
        }
        const existing = await prisma_1.prisma.fuelConsumptionRecord.findUnique({
            where: {
                vehicleId_year_month: { vehicleId, year, month },
            },
            select: fuelConsumptionRecordSelect,
        });
        const merged = {
            actualFuelFirstHalf: field === "actualFuelFirstHalf"
                ? dataValue
                : (existing?.actualFuelFirstHalf ?? null),
            actualFuelSecondHalf: field === "actualFuelSecondHalf"
                ? dataValue
                : (existing?.actualFuelSecondHalf ?? null),
            meterReadingDay1: field === "meterReadingDay1"
                ? dataValue
                : (existing?.meterReadingDay1 ?? null),
            meterReadingDay16: field === "meterReadingDay16"
                ? dataValue
                : (existing?.meterReadingDay16 ?? null),
            meterReadingLastDay: field === "meterReadingLastDay"
                ? dataValue
                : (existing?.meterReadingLastDay ?? null),
        };
        const meterError = validateMeterReadings(merged.meterReadingDay1, merged.meterReadingDay16, merged.meterReadingLastDay);
        if (meterError) {
            return res.status(400).json({ message: meterError });
        }
        const record = await prisma_1.prisma.fuelConsumptionRecord.upsert({
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
        const row = buildFuelConsumptionRow(vehicle.id, vehicle.vehicleNumber, vehicle.mileage, agg, record);
        res.json(row);
    }
    catch (error) {
        console.error("Error updating fuel consumption entry:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.updateFuelConsumptionEntry = updateFuelConsumptionEntry;
const getVehicleById = async (req, res) => {
    try {
        const { id } = req.params;
        const vehicle = await prisma_1.prisma.vehicle.findUnique({
            where: { id },
            include: { VehicleType: true },
        });
        if (!vehicle) {
            return res.status(404).json({ message: "Vehicle not found" });
        }
        res.json({ vehicle });
    }
    catch (error) {
        console.error("Error fetching vehicle:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.getVehicleById = getVehicleById;
const updateVehicle = async (req, res) => {
    try {
        const { id } = req.params;
        const { vehicleName, vehicleNumber, vehicleTypeId, capacity, mileage } = req.body;
        const existingVehicle = await prisma_1.prisma.vehicle.findUnique({
            where: { id },
        });
        if (!existingVehicle) {
            return res.status(404).json({ message: "Vehicle not found" });
        }
        if (vehicleTypeId) {
            const vehicleType = await prisma_1.prisma.vehicleType.findUnique({
                where: { id: vehicleTypeId },
            });
            if (!vehicleType) {
                return res.status(400).json({ message: "Invalid vehicle type" });
            }
        }
        if (vehicleNumber && vehicleNumber !== existingVehicle.vehicleNumber) {
            const duplicateVehicle = await prisma_1.prisma.vehicle.findUnique({
                where: { vehicleNumber },
            });
            if (duplicateVehicle) {
                return res.status(409).json({ message: "Vehicle number already exists" });
            }
        }
        const vehicle = await prisma_1.prisma.vehicle.update({
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
    }
    catch (error) {
        console.error("Error updating vehicle:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.updateVehicle = updateVehicle;
const deleteVehicle = async (req, res) => {
    try {
        const { id } = req.params;
        const existingVehicle = await prisma_1.prisma.vehicle.findUnique({
            where: { id },
        });
        if (!existingVehicle) {
            return res.status(404).json({ message: "Vehicle not found" });
        }
        await prisma_1.prisma.vehicle.delete({
            where: { id },
        });
        res.json({ message: "Vehicle deleted successfully" });
    }
    catch (error) {
        console.error("Error deleting vehicle:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.deleteVehicle = deleteVehicle;
//# sourceMappingURL=vehicle.controller.js.map