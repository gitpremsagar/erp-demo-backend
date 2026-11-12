import { Request, Response } from "express";
import { Department, UserType, WarehouseEmployeeCategory } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AuthenticatedRequest } from "../middleware/auth.middleware";

// Employee types array
const EMPLOYEE_TYPES: UserType[] = [
  UserType.EMPLOYEE,
  UserType.ACCOUNTANT,
  UserType.DRIVER,
  UserType.WAREHOUSE_MANAGER,
  UserType.ORDER_MANAGER,
  UserType.PURCHASING_MANAGER,
  UserType.GUARD,
  UserType.MIS,
];

// Helper function to check if userType is an employee type
const isEmployeeType = (userType: UserType): boolean => {
  return EMPLOYEE_TYPES.includes(userType);
};

// Create a new employee (user with employee-related privilege)
export const createEmployee = async (req: Request, res: Response) => {
  try {
    const {
      name,
      email,
      phone,
      password,
      userType,
      department,
      warehouseCategory,
    } = req.body;

    const currentUser = (req as AuthenticatedRequest).user as { userType?: string } | undefined;
    const employeeUserType = (userType as UserType) || UserType.EMPLOYEE;

    // Only SUPER_ADMIN can create an employee with userType ADMIN
    if (employeeUserType === UserType.ADMIN) {
      if (currentUser?.userType !== "SUPER_ADMIN") {
        return res.status(403).json({
          message: "Only Super Admin can create an Admin user.",
        });
      }
    } else if (!isEmployeeType(employeeUserType)) {
      return res.status(400).json({
        message: "Invalid userType. Must be an employee-related type.",
      });
    }

    // Check if user with same email or phone already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          ...(phone ? [{ phone }] : []),
        ],
      },
    });

    if (existingUser) {
      return res.status(409).json({ 
        message: "User with same email or phone already exists" 
      });
    }

    // Hash the password
    const bcrypt = require("bcrypt");
    const hashedPassword = await bcrypt.hash(
      password || "defaultPassword123",
      +process.env.BCRYPT_SALT_ROUNDS! || 10
    );

    const departmentValue: Department | undefined =
      department === "ADMINISTRATION" || department === "WAREHOUSE"
        ? (department as Department)
        : undefined;

    const warehouseCategoryValue: WarehouseEmployeeCategory | null =
      departmentValue === Department.WAREHOUSE && warehouseCategory
        ? (warehouseCategory as WarehouseEmployeeCategory)
        : null;

    const employee = await prisma.user.create({
      data: {
        name,
        email,
        phone,
        password: hashedPassword,
        userType: employeeUserType,
        ...(departmentValue !== undefined ? { department: departmentValue } : {}),
        warehouseCategory: warehouseCategoryValue,
      },
    });

    res.status(201).json({ employee });
  } catch (error) {
    console.error("Error creating employee:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get all employees with pagination and search
// SUPER_ADMIN sees all employee types including ADMIN; other admins see only non-ADMIN employee types
export const getEmployees = async (req: Request, res: Response) => {
  console.log(req.query);
  try {
    const currentUser = (req as AuthenticatedRequest).user as { userType?: string } | undefined;
    const isSuperAdmin = currentUser?.userType === "SUPER_ADMIN";
    const allowedTypes: UserType[] = isSuperAdmin
      ? [...EMPLOYEE_TYPES, UserType.ADMIN]
      : EMPLOYEE_TYPES;

    const {
      page = 1,
      limit = 1000,
      search,
      userType,
      department,
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    // Validate userType if provided
    if (userType && !allowedTypes.includes(userType as UserType)) {
      return res.status(400).json({
        message: "Invalid userType. Must be an employee-related type.",
      });
    }

    // Build where clause
    const where: any = {
      userType: userType
        ? { in: [userType as UserType] }
        : { in: allowedTypes },
    };
    
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
        { phone: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    if (department === "WAREHOUSE" || department === "ADMINISTRATION") {
      where.department = department as Department;
    }

    const [employees, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: {
          createdAt: "desc",
        },
      }),
      prisma.user.count({ where }),
    ]);

    const totalPages = Math.ceil(total / Number(limit));

    res.json({
      employees,
      pagination: {
        currentPage: Number(page),
        totalPages,
        totalItems: total,
        itemsPerPage: Number(limit),
      },
    });
  } catch (error) {
    console.error("Error fetching employees:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get employee statistics
export const getEmployeeStats = async (req: Request, res: Response) => {
  try {
    const [totalEmployees, employeesWithStockRecords] = await Promise.all([
      prisma.user.count({
        where: { userType: { in: EMPLOYEE_TYPES } },
      }),
      prisma.user.count({
        where: {
          userType: { in: EMPLOYEE_TYPES },
          StockRecord: {
            some: {},
          },
        },
      }),
    ]);

    res.json({
      totalEmployees,
      employeesWithStockRecords,
      employeesWithoutStockRecords: totalEmployees - employeesWithStockRecords,
    });
  } catch (error) {
    console.error("Error fetching employee statistics:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get a single employee by ID
export const getEmployeeById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const employee = await prisma.user.findUnique({
      where: { id },
      include: {
        StockRecord: {
          include: {
            Product: true,
            StockBatch: true,
            Order: true,
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    // Allow all employee types (EMPLOYEE_TYPES + ADMIN)
    const viewableTypes: UserType[] = [...EMPLOYEE_TYPES, UserType.ADMIN];
    if (!viewableTypes.includes(employee.userType)) {
      return res.status(400).json({ message: "User is not an employee" });
    }

    res.json({ employee });
  } catch (error) {
    console.error("Error fetching employee:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Update an employee
export const updateEmployee = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body = req.body as {
      name?: string;
      email?: string;
      phone?: string;
      password?: string;
      userType?: UserType;
      department?: Department;
      warehouseCategory?: WarehouseEmployeeCategory | null;
    };
    const currentUser = (req as AuthenticatedRequest).user as { userType?: string } | undefined;

    const existingEmployee = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingEmployee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    // Allow update for all employee types (EMPLOYEE_TYPES + ADMIN)
    const updatableTypes: UserType[] = [...EMPLOYEE_TYPES, UserType.ADMIN];
    if (!updatableTypes.includes(existingEmployee.userType)) {
      return res.status(400).json({ message: "User is not an employee" });
    }

    // Only SUPER_ADMIN can set userType to ADMIN
    if (body.userType === UserType.ADMIN && currentUser?.userType !== "SUPER_ADMIN") {
      return res.status(403).json({ message: "Only Super Admin can assign Admin role." });
    }

    // Check for conflicts with other users if updating unique fields
    if (body.email || body.phone) {
      const conflictUser = await prisma.user.findFirst({
        where: {
          AND: [
            { id: { not: id } },
            {
              OR: [
                ...(body.email ? [{ email: body.email }] : []),
                ...(body.phone ? [{ phone: body.phone }] : []),
              ],
            },
          ],
        },
      });

      if (conflictUser) {
        return res.status(409).json({
          message: "User with same email or phone already exists",
        });
      }
    }

    // Build update data: only allowed fields, hash password if provided
    const updateData: {
      name?: string;
      email?: string;
      phone?: string;
      password?: string;
      userType?: UserType;
      department?: Department;
      warehouseCategory?: WarehouseEmployeeCategory | null;
    } = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.email !== undefined) updateData.email = body.email;
    if (body.phone !== undefined) updateData.phone = body.phone;
    if (body.userType !== undefined) updateData.userType = body.userType;
    if (body.department !== undefined) updateData.department = body.department;
    if (body.warehouseCategory !== undefined) {
      updateData.warehouseCategory = body.warehouseCategory;
    }
    if (body.department === Department.ADMINISTRATION) {
      updateData.warehouseCategory = null;
    }

    if (body.password && body.password.trim() !== "") {
      const bcrypt = require("bcrypt");
      updateData.password = await bcrypt.hash(
        body.password,
        +process.env.BCRYPT_SALT_ROUNDS! || 10
      );
    }

    const updatedEmployee = await prisma.user.update({
      where: { id },
      data: updateData,
    });

    res.json({ employee: updatedEmployee });
  } catch (error) {
    console.error("Error updating employee:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Delete an employee
export const deleteEmployee = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if employee exists and is actually an employee
    const employee = await prisma.user.findUnique({
      where: { id },
      include: {
        StockRecord: true,
      },
    });

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    // Allow delete for any employee type (EMPLOYEE_TYPES + ADMIN)
    const deletableEmployeeTypes: UserType[] = [...EMPLOYEE_TYPES, UserType.ADMIN];
    if (!deletableEmployeeTypes.includes(employee.userType)) {
      return res.status(400).json({ message: "User is not an employee" });
    }

    // Check if employee has stock records
    if (employee.StockRecord.length > 0) {
      return res.status(400).json({ 
        message: "Cannot delete employee with existing stock records." 
      });
    }

    await prisma.user.delete({
      where: { id },
    });

    res.json({ message: "Employee deleted successfully" });
  } catch (error) {
    console.error("Error deleting employee:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
