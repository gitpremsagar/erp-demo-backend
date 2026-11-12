import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

const salesOfficerSelect = {
  id: true,
  name: true,
  email: true,
} as const;

const tagInclude = {
  _count: { select: { CustomerDetails: true } },
  SalesOfficer: { select: salesOfficerSelect },
} as const;

async function resolveSalesOfficerId(
  salesOfficerId: string | null | undefined
): Promise<{ ok: true; value: string | null | undefined } | { ok: false; message: string }> {
  if (salesOfficerId === undefined) {
    return { ok: true, value: undefined };
  }
  if (salesOfficerId === null || salesOfficerId === "") {
    return { ok: true, value: null };
  }

  const officer = await prisma.user.findFirst({
    where: { id: salesOfficerId, userType: "SALES_OFFICER" },
    select: { id: true },
  });

  if (!officer) {
    return { ok: false, message: "Sales officer not found" };
  }

  return { ok: true, value: officer.id };
}

export const createPartyReportTag = async (req: Request, res: Response) => {
  try {
    const {
      name,
      sortOrder = 0,
      headerColor = "#22c55e",
      isRegisteredParty = false,
      salesOfficerId,
    } = req.body;

    const existingTag = await prisma.partyReportTag.findFirst({
      where: { name },
    });

    if (existingTag) {
      return res.status(409).json({ message: "Party report tag with this name already exists" });
    }

    const officerResult = await resolveSalesOfficerId(salesOfficerId);
    if (!officerResult.ok) {
      return res.status(400).json({ message: officerResult.message });
    }

    const partyReportTag = await prisma.partyReportTag.create({
      data: {
        name,
        sortOrder,
        headerColor,
        isRegisteredParty,
        ...(officerResult.value !== undefined
          ? { salesOfficerId: officerResult.value }
          : {}),
      },
      include: tagInclude,
    });

    res.status(201).json({ partyReportTag });
  } catch (error) {
    console.error("Error creating party report tag:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getPartyReportTags = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 100, search } = req.query as {
      page?: number;
      limit?: number;
      search?: string;
    };

    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 100;
    const skip = (pageNum - 1) * limitNum;

    const where: { name?: { contains: string; mode: "insensitive" } } = {};
    if (search) {
      where.name = { contains: search, mode: "insensitive" };
    }

    const [partyReportTags, total] = await Promise.all([
      prisma.partyReportTag.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: tagInclude,
      }),
      prisma.partyReportTag.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limitNum);

    res.json({
      partyReportTags,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching party report tags:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getPartyReportTagById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const partyReportTag = await prisma.partyReportTag.findUnique({
      where: { id },
      include: tagInclude,
    });

    if (!partyReportTag) {
      return res.status(404).json({ message: "Party report tag not found" });
    }

    res.json({ partyReportTag });
  } catch (error) {
    console.error("Error fetching party report tag:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const updatePartyReportTag = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, sortOrder, headerColor, isRegisteredParty, salesOfficerId } = req.body;

    const existingTag = await prisma.partyReportTag.findUnique({
      where: { id },
    });

    if (!existingTag) {
      return res.status(404).json({ message: "Party report tag not found" });
    }

    if (name && name !== existingTag.name) {
      const duplicateTag = await prisma.partyReportTag.findFirst({
        where: { name },
      });

      if (duplicateTag) {
        return res.status(409).json({ message: "Party report tag with this name already exists" });
      }
    }

    const officerResult = await resolveSalesOfficerId(salesOfficerId);
    if (!officerResult.ok) {
      return res.status(400).json({ message: officerResult.message });
    }

    const partyReportTag = await prisma.partyReportTag.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(sortOrder !== undefined ? { sortOrder } : {}),
        ...(headerColor !== undefined ? { headerColor } : {}),
        ...(isRegisteredParty !== undefined ? { isRegisteredParty } : {}),
        ...(officerResult.value !== undefined
          ? { salesOfficerId: officerResult.value }
          : {}),
      },
      include: tagInclude,
    });

    res.json({ partyReportTag });
  } catch (error) {
    console.error("Error updating party report tag:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const deletePartyReportTag = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existingTag = await prisma.partyReportTag.findUnique({
      where: { id },
      include: { _count: { select: { CustomerDetails: true } } },
    });

    if (!existingTag) {
      return res.status(404).json({ message: "Party report tag not found" });
    }

    if (existingTag._count.CustomerDetails > 0) {
      return res.status(400).json({
        message: "Cannot delete tag as it is assigned to existing distributors",
      });
    }

    await prisma.partyReportTag.delete({
      where: { id },
    });

    res.json({ message: "Party report tag deleted successfully" });
  } catch (error) {
    console.error("Error deleting party report tag:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getTagDistributors = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const partyReportTag = await prisma.partyReportTag.findUnique({
      where: { id },
      include: {
        CustomerDetails: {
          select: {
            id: true,
            dbUserId: true,
            dbName: true,
            area: true,
            state: true,
          },
          orderBy: { dbName: "asc" },
        },
      },
    });

    if (!partyReportTag) {
      return res.status(404).json({ message: "Party report tag not found" });
    }

    res.json({
      tag: {
        id: partyReportTag.id,
        name: partyReportTag.name,
      },
      distributors: partyReportTag.CustomerDetails.map((cd) => ({
        customerDetailId: cd.id,
        customerId: cd.dbUserId,
        dbName: cd.dbName,
        area: cd.area,
        state: cd.state,
      })),
    });
  } catch (error) {
    console.error("Error fetching tag distributors:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const assignPartiesToTag = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { customerIds } = req.body as { customerIds: string[] };

    const tag = await prisma.partyReportTag.findUnique({ where: { id } });
    if (!tag) {
      return res.status(404).json({ message: "Party report tag not found" });
    }

    const uniqueCustomerIds = [...new Set(customerIds)];

    if (uniqueCustomerIds.length > 0) {
      const customers = await prisma.user.findMany({
        where: { id: { in: uniqueCustomerIds }, userType: "CUSTOMER" },
        select: { id: true, CustomerDetail: { select: { id: true }, take: 1 } },
      });

      if (customers.length !== uniqueCustomerIds.length) {
        return res.status(400).json({ message: "One or more distributors not found" });
      }

      const missingDetail = customers.some((c) => c.CustomerDetail.length === 0);
      if (missingDetail) {
        return res.status(400).json({ message: "One or more distributors have no customer detail" });
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.customerDetail.updateMany({
        where: { partyReportTagId: id, dbUserId: { notIn: uniqueCustomerIds } },
        data: { partyReportTagId: null },
      });

      if (uniqueCustomerIds.length > 0) {
        await tx.customerDetail.updateMany({
          where: { dbUserId: { in: uniqueCustomerIds } },
          data: { partyReportTagId: id },
        });
      }
    });

    const assignedCount = await prisma.customerDetail.count({
      where: { partyReportTagId: id },
    });

    res.json({
      message: "Parties assigned successfully",
      assignedCount,
    });
  } catch (error) {
    console.error("Error assigning parties to tag:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
