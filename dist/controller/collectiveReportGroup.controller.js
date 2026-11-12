"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setCollectiveReportGroupMembers = exports.deleteCollectiveReportGroup = exports.updateCollectiveReportGroup = exports.createCollectiveReportGroup = exports.listCollectiveReportGroups = void 0;
const prisma_1 = require("../lib/prisma");
const OBJECT_ID = /^[a-f\d]{24}$/i;
function parseName(value) {
    if (typeof value !== "string")
        return null;
    const name = value.trim();
    return name.length > 0 && name.length <= 100 ? name : null;
}
function parseSortOrder(value) {
    const sortOrder = Number(value);
    return Number.isInteger(sortOrder) ? sortOrder : null;
}
async function isNameTaken(name, exceptId) {
    const existing = await prisma_1.prisma.collectiveReportGroup.findFirst({
        where: {
            name: { equals: name, mode: "insensitive" },
            ...(exceptId ? { id: { not: exceptId } } : {}),
        },
        select: { id: true },
    });
    return existing !== null;
}
const listCollectiveReportGroups = async (_req, res) => {
    try {
        const groups = await prisma_1.prisma.collectiveReportGroup.findMany({
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
            include: { members: { select: { customerId: true } } },
        });
        res.json({
            groups: groups.map((g) => ({
                id: g.id,
                name: g.name,
                sortOrder: g.sortOrder,
                customerIds: g.members.map((m) => m.customerId),
            })),
        });
    }
    catch (error) {
        console.error("List collective report groups error:", error);
        res.status(500).json({ message: "Failed to load groups" });
    }
};
exports.listCollectiveReportGroups = listCollectiveReportGroups;
const createCollectiveReportGroup = async (req, res) => {
    try {
        const name = parseName(req.body?.name);
        if (!name)
            return res.status(400).json({ message: "Group name is required" });
        const sortOrder = req.body?.sortOrder === undefined ? 0 : parseSortOrder(req.body.sortOrder);
        if (sortOrder === null)
            return res.status(400).json({ message: "sortOrder must be an integer" });
        if (await isNameTaken(name)) {
            return res.status(409).json({ message: "A group with this name already exists" });
        }
        const group = await prisma_1.prisma.collectiveReportGroup.create({ data: { name, sortOrder } });
        res.status(201).json({ group: { id: group.id, name: group.name, sortOrder: group.sortOrder, customerIds: [] } });
    }
    catch (error) {
        console.error("Create collective report group error:", error);
        res.status(500).json({ message: "Failed to create group" });
    }
};
exports.createCollectiveReportGroup = createCollectiveReportGroup;
const updateCollectiveReportGroup = async (req, res) => {
    try {
        const { id } = req.params;
        if (!OBJECT_ID.test(id))
            return res.status(400).json({ message: "Invalid group id" });
        const data = {};
        if (req.body?.name !== undefined) {
            const name = parseName(req.body.name);
            if (!name)
                return res.status(400).json({ message: "Group name is required" });
            data.name = name;
        }
        if (req.body?.sortOrder !== undefined) {
            const sortOrder = parseSortOrder(req.body.sortOrder);
            if (sortOrder === null)
                return res.status(400).json({ message: "sortOrder must be an integer" });
            data.sortOrder = sortOrder;
        }
        const existing = await prisma_1.prisma.collectiveReportGroup.findUnique({ where: { id } });
        if (!existing)
            return res.status(404).json({ message: "Group not found" });
        if (data.name && (await isNameTaken(data.name, id))) {
            return res.status(409).json({ message: "A group with this name already exists" });
        }
        const group = await prisma_1.prisma.collectiveReportGroup.update({ where: { id }, data });
        res.json({ group: { id: group.id, name: group.name, sortOrder: group.sortOrder } });
    }
    catch (error) {
        console.error("Update collective report group error:", error);
        res.status(500).json({ message: "Failed to update group" });
    }
};
exports.updateCollectiveReportGroup = updateCollectiveReportGroup;
const deleteCollectiveReportGroup = async (req, res) => {
    try {
        const { id } = req.params;
        if (!OBJECT_ID.test(id))
            return res.status(400).json({ message: "Invalid group id" });
        const existing = await prisma_1.prisma.collectiveReportGroup.findUnique({ where: { id } });
        if (!existing)
            return res.status(404).json({ message: "Group not found" });
        await prisma_1.prisma.$transaction([
            prisma_1.prisma.collectiveReportGroupMember.deleteMany({ where: { groupId: id } }),
            prisma_1.prisma.collectiveReportGroup.delete({ where: { id } }),
        ]);
        res.json({ message: "Group deleted" });
    }
    catch (error) {
        console.error("Delete collective report group error:", error);
        res.status(500).json({ message: "Failed to delete group" });
    }
};
exports.deleteCollectiveReportGroup = deleteCollectiveReportGroup;
const setCollectiveReportGroupMembers = async (req, res) => {
    try {
        const { id } = req.params;
        if (!OBJECT_ID.test(id))
            return res.status(400).json({ message: "Invalid group id" });
        const raw = req.body?.customerIds;
        if (!Array.isArray(raw) || raw.some((c) => typeof c !== "string" || !OBJECT_ID.test(c))) {
            return res.status(400).json({ message: "customerIds must be an array of valid ids" });
        }
        const customerIds = [...new Set(raw)];
        const group = await prisma_1.prisma.collectiveReportGroup.findUnique({ where: { id } });
        if (!group)
            return res.status(404).json({ message: "Group not found" });
        if (customerIds.length > 0) {
            const found = await prisma_1.prisma.user.count({
                where: { id: { in: customerIds }, userType: "CUSTOMER" },
            });
            if (found !== customerIds.length) {
                return res.status(404).json({ message: "One or more customers not found" });
            }
        }
        await prisma_1.prisma.$transaction([
            prisma_1.prisma.collectiveReportGroupMember.deleteMany({
                where: { OR: [{ groupId: id }, { customerId: { in: customerIds } }] },
            }),
            ...(customerIds.length > 0
                ? [
                    prisma_1.prisma.collectiveReportGroupMember.createMany({
                        data: customerIds.map((customerId) => ({ groupId: id, customerId })),
                    }),
                ]
                : []),
        ]);
        res.json({ groupId: id, customerIds });
    }
    catch (error) {
        console.error("Set collective report group members error:", error);
        res.status(500).json({ message: "Failed to assign customers" });
    }
};
exports.setCollectiveReportGroupMembers = setCollectiveReportGroupMembers;
//# sourceMappingURL=collectiveReportGroup.controller.js.map