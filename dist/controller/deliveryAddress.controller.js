"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setDefaultDeliveryAddress = exports.deleteDeliveryAddress = exports.updateDeliveryAddress = exports.getDeliveryAddressById = exports.getDeliveryAddresses = exports.createDeliveryAddress = void 0;
const prisma_1 = require("../lib/prisma");
function parseOptionalTwoSideDistance(value) {
    if (value === undefined || value === null || value === "")
        return { ok: true };
    const n = parseInt(String(value), 10);
    if (Number.isNaN(n))
        return { ok: false, message: "Invalid twoSideDistance" };
    return { ok: true, value: n };
}
// Create a new delivery address
const createDeliveryAddress = async (req, res) => {
    try {
        const { userId, address, default: isDefault, pincode, state, twoSideDistance, area, vehicleType, } = req.body;
        // Check if user exists
        if (!userId || typeof userId !== "string") {
            return res.status(400).json({ message: "User ID is required" });
        }
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: userId },
        });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        if (!address || typeof address !== "string" || !address.trim()) {
            return res.status(400).json({ message: "Address is required" });
        }
        const parsedDistance = parseOptionalTwoSideDistance(twoSideDistance);
        if (!parsedDistance.ok) {
            return res.status(400).json({ message: parsedDistance.message });
        }
        // If this is set as default, unset other default addresses for this user
        if (isDefault) {
            await prisma_1.prisma.deliveryAddress.updateMany({
                where: { userId },
                data: { default: false },
            });
        }
        const deliveryAddress = await prisma_1.prisma.deliveryAddress.create({
            data: {
                userId,
                address: address.trim(),
                default: isDefault || false,
                ...(pincode !== undefined && pincode !== null && String(pincode).trim() !== ""
                    ? { pincode: String(pincode).trim() }
                    : {}),
                ...(state !== undefined && state !== null && String(state).trim() !== ""
                    ? { state: String(state).trim() }
                    : {}),
                ...(area !== undefined && area !== null && String(area).trim() !== ""
                    ? { area: String(area).trim() }
                    : {}),
                ...(vehicleType !== undefined && vehicleType !== null && String(vehicleType).trim() !== ""
                    ? { vehicleType: String(vehicleType).trim() }
                    : {}),
                ...(parsedDistance.value !== undefined ? { twoSideDistance: parsedDistance.value } : {}),
            },
            include: {
                User: true,
            },
        });
        res.status(201).json({ deliveryAddress });
    }
    catch (error) {
        console.error("Error creating delivery address:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.createDeliveryAddress = createDeliveryAddress;
// Get all delivery addresses for a user
const getDeliveryAddresses = async (req, res) => {
    try {
        const { userId } = req.query;
        if (!userId) {
            return res.status(400).json({ message: "User ID is required" });
        }
        // Check if user exists
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: userId },
        });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        const deliveryAddresses = await prisma_1.prisma.deliveryAddress.findMany({
            where: { userId: userId },
            include: {
                User: true,
            },
            orderBy: [
                { default: "desc" },
                { createdAt: "desc" },
            ],
        });
        res.json({ deliveryAddresses });
    }
    catch (error) {
        console.error("Error fetching delivery addresses:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.getDeliveryAddresses = getDeliveryAddresses;
// Get a single delivery address by ID
const getDeliveryAddressById = async (req, res) => {
    try {
        const { id } = req.params;
        const deliveryAddress = await prisma_1.prisma.deliveryAddress.findUnique({
            where: { id },
            include: {
                User: true,
            },
        });
        if (!deliveryAddress) {
            return res.status(404).json({ message: "Delivery address not found" });
        }
        res.json({ deliveryAddress });
    }
    catch (error) {
        console.error("Error fetching delivery address:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.getDeliveryAddressById = getDeliveryAddressById;
// Update a delivery address
const updateDeliveryAddress = async (req, res) => {
    try {
        const { id } = req.params;
        const { address, default: isDefault, pincode, state, twoSideDistance, area, vehicleType } = req.body;
        // Check if delivery address exists
        const existingDeliveryAddress = await prisma_1.prisma.deliveryAddress.findUnique({
            where: { id },
            include: {
                User: true,
            },
        });
        if (!existingDeliveryAddress) {
            return res.status(404).json({ message: "Delivery address not found" });
        }
        const parsedDistance = parseOptionalTwoSideDistance(twoSideDistance);
        if (!parsedDistance.ok) {
            return res.status(400).json({ message: parsedDistance.message });
        }
        // If this is being set as default, unset other default addresses for this user
        if (isDefault) {
            await prisma_1.prisma.deliveryAddress.updateMany({
                where: {
                    userId: existingDeliveryAddress.userId,
                    id: { not: id },
                },
                data: { default: false },
            });
        }
        const data = {};
        if (address !== undefined) {
            if (typeof address !== "string" || !address.trim()) {
                return res.status(400).json({ message: "Address cannot be empty" });
            }
            data.address = address.trim();
        }
        if (isDefault !== undefined)
            data.default = isDefault;
        if (pincode !== undefined) {
            data.pincode = pincode === null || pincode === "" ? "000000" : String(pincode).trim();
        }
        if (state !== undefined) {
            data.state = state === null || state === "" ? "NOT_SET" : String(state).trim();
        }
        if (area !== undefined) {
            data.area = area === null || area === "" ? "NOT_SET" : String(area).trim();
        }
        if (vehicleType !== undefined) {
            data.vehicleType = vehicleType === null || vehicleType === "" ? "NOT_SET" : String(vehicleType).trim();
        }
        if (parsedDistance.value !== undefined)
            data.twoSideDistance = parsedDistance.value;
        if (Object.keys(data).length === 0) {
            return res.status(400).json({ message: "No fields to update" });
        }
        const updatedDeliveryAddress = await prisma_1.prisma.deliveryAddress.update({
            where: { id },
            data,
            include: {
                User: true,
            },
        });
        res.json({ deliveryAddress: updatedDeliveryAddress });
    }
    catch (error) {
        console.error("Error updating delivery address:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.updateDeliveryAddress = updateDeliveryAddress;
// Delete a delivery address
const deleteDeliveryAddress = async (req, res) => {
    try {
        const { id } = req.params;
        // Check if delivery address exists
        const existingDeliveryAddress = await prisma_1.prisma.deliveryAddress.findUnique({
            where: { id },
            include: {
                Order: true,
            },
        });
        if (!existingDeliveryAddress) {
            return res.status(404).json({ message: "Delivery address not found" });
        }
        // Check if delivery address is being used by any orders
        if (existingDeliveryAddress.Order.length > 0) {
            return res.status(400).json({
                message: "Cannot delete delivery address that is being used by orders"
            });
        }
        await prisma_1.prisma.deliveryAddress.delete({
            where: { id },
        });
        res.json({ message: "Delivery address deleted successfully" });
    }
    catch (error) {
        console.error("Error deleting delivery address:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.deleteDeliveryAddress = deleteDeliveryAddress;
// Set a delivery address as default
const setDefaultDeliveryAddress = async (req, res) => {
    try {
        const { id } = req.params;
        // Check if delivery address exists
        const existingDeliveryAddress = await prisma_1.prisma.deliveryAddress.findUnique({
            where: { id },
        });
        if (!existingDeliveryAddress) {
            return res.status(404).json({ message: "Delivery address not found" });
        }
        // Unset other default addresses for this user
        await prisma_1.prisma.deliveryAddress.updateMany({
            where: {
                userId: existingDeliveryAddress.userId,
                id: { not: id },
            },
            data: { default: false },
        });
        // Set this address as default
        const updatedDeliveryAddress = await prisma_1.prisma.deliveryAddress.update({
            where: { id },
            data: { default: true },
            include: {
                User: true,
            },
        });
        res.json({ deliveryAddress: updatedDeliveryAddress });
    }
    catch (error) {
        console.error("Error setting default delivery address:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.setDefaultDeliveryAddress = setDefaultDeliveryAddress;
//# sourceMappingURL=deliveryAddress.controller.js.map