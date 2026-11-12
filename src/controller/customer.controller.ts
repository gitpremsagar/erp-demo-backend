import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { prisma } from "../lib/prisma";

// Create a new customer (user with CUSTOMER privilege)
export const createCustomer = async (req: Request, res: Response) => {
  try {
    const {
      // User fields
      name,
      email,
      phone,
      password,
      // CustomerDetail fields
      dbName,
      dbCategory,
      area,
      state,
      address,
      pincode,
      vehicleType,
      panNumber,
      gstinNumber,
      ownerAadharNumber,
      salesOfficerName,
      salesOfficerContact,
      contact2,
      creditLimit,
      paymentTerms,
      isCashDiscountAllowed,
      cashDiscountPercentage,
      isSundayDispatchAllowed,
      isMondayDispatchAllowed,
      isTuesdayDispatchAllowed,
      isWednesdayDispatchAllowed,
      isThursdayDispatchAllowed,
      isFridayDispatchAllowed,
      isSaturdayDispatchAllowed,
      twoSideDistance,
      partyReportTagId,
    } = req.body;

    // Check if user with same email already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        email,
      },
    });

    if (existingUser) {
      return res.status(409).json({
        message: "User with same email already exists"
      });
    }

    // Check if customer detail with same email already exists
    const existingCustomerDetail = await prisma.customerDetail.findFirst({
      where: {
        email,
      },
    });

    if (existingCustomerDetail) {
      return res.status(409).json({
        message: "Customer with same email already exists"
      });
    }

    if (partyReportTagId) {
      const tag = await prisma.partyReportTag.findUnique({ where: { id: partyReportTagId } });
      if (!tag) {
        return res.status(400).json({ message: "Party report tag not found" });
      }
    }

    const normalizedPanNumber =
      panNumber && String(panNumber).trim() !== ""
        ? String(panNumber).trim()
        : null;
    const normalizedGstinNumber =
      gstinNumber && String(gstinNumber).trim() !== ""
        ? String(gstinNumber).trim()
        : null;
    const normalizedOwnerAadharNumber =
      ownerAadharNumber != null && ownerAadharNumber !== 0
        ? ownerAadharNumber
        : null;

    // Hash the password
    const hashedPassword = await bcrypt.hash(
      password || "defaultPassword",
      +process.env.BCRYPT_SALT_ROUNDS! || 10
    );

    // Create user and customer detail in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          name,
          email,
          phone,
          password: hashedPassword,
          userType: "CUSTOMER",
        },
      });

      // Create customer detail
      const customerDetail = await tx.customerDetail.create({
        data: {
          dbUserId: user.id,
          dbName,
          dbCategory,
          email,
          area,
          state,
          address,
          pincode,
          vehicleType,
          panNumber: normalizedPanNumber,
          gstinNumber: normalizedGstinNumber,
          ownerAadharNumber: normalizedOwnerAadharNumber,
          salesOfficerName,
          salesOfficerContact,
          contact2,
          creditLimit: creditLimit || 0,
          paymentTerms,
          isCashDiscountAllowed: isCashDiscountAllowed ?? false,
          cashDiscountPercentage,
          isSundayDispatchAllowed: isSundayDispatchAllowed ?? false,
          isMondayDispatchAllowed: isMondayDispatchAllowed ?? false,
          isTuesdayDispatchAllowed: isTuesdayDispatchAllowed ?? false,
          isWednesdayDispatchAllowed: isWednesdayDispatchAllowed ?? false,
          isThursdayDispatchAllowed: isThursdayDispatchAllowed ?? false,
          isFridayDispatchAllowed: isFridayDispatchAllowed ?? false,
          isSaturdayDispatchAllowed: isSaturdayDispatchAllowed ?? false,
          twoSideDistance: twoSideDistance || 0,
          partyReportTagId: partyReportTagId || null,
        },
      });

      return { user, customerDetail };
    });

    res.status(201).json({
      customer: result.user,
      customerDetail: result.customerDetail
    });
  } catch (error) {
    console.error("Error creating customer:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get all customers with pagination and search
export const getCustomers = async (req: Request, res: Response) => {
  console.log(req.query);
  try {
    const {
      page = 1,
      limit = 1000,
      search,
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    // Build where clause
    const where: any = {
      userType: "CUSTOMER",
    };

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
        { phone: { contains: search as string, mode: 'insensitive' } },
        {
          CustomerDetail: {
            some: {
              OR: [
                { dbName: { contains: search as string, mode: 'insensitive' } },
                { area: { contains: search as string, mode: 'insensitive' } },
                { state: { contains: search as string, mode: 'insensitive' } },
              ]
            }
          }
        },
      ];
    }

    const [customers, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: Number(limit),
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          userType: true,
          createdAt: true,
          updatedAt: true,
          CustomerDetail: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      }),
      prisma.user.count({ where }),
    ]);

    const totalPages = Math.ceil(total / Number(limit));

    res.json({
      customers,
      pagination: {
        currentPage: Number(page),
        totalPages,
        totalItems: total,
        itemsPerPage: Number(limit),
      },
    });
  } catch (error) {
    console.error("Error fetching customers:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get distributors assigned to a sales officer
export const getAssignedDistributors = async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 1000,
      search,
    } = req.query;
    const { salesOfficerId } = req.params;

    const skip = (Number(page) - 1) * Number(limit);

    // Build where clause for distributors assigned to this sales officer
    const where: any = {
      userType: "CUSTOMER",
      DistributorAssignment: {
        some: {
          salesOfficerId: salesOfficerId,
        },
      },
    };

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
        { phone: { contains: search as string, mode: 'insensitive' } },
        {
          CustomerDetail: {
            some: {
              OR: [
                { dbName: { contains: search as string, mode: 'insensitive' } },
                { area: { contains: search as string, mode: 'insensitive' } },
                { state: { contains: search as string, mode: 'insensitive' } },
              ]
            }
          }
        },
      ];
    }

    const [customers, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: Number(limit),
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          userType: true,
          createdAt: true,
          updatedAt: true,
          CustomerDetail: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      }),
      prisma.user.count({ where }),
    ]);

    const totalPages = Math.ceil(total / Number(limit));

    res.json({
      customers,
      pagination: {
        currentPage: Number(page),
        totalPages,
        totalItems: total,
        itemsPerPage: Number(limit),
      },
    });
  } catch (error) {
    console.error("Error fetching assigned distributors:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get all distributors with forecast (customers who have forecasts)
export const getDistributorsWithForecast = async (req: Request, res: Response) => {
  console.log(req.query);
  try {
    const {
      page = 1,
      limit = 1000,
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    // Build where clause - only customers who have forecasts
    const where: any = {
      userType: "CUSTOMER",
    };

    const [distributors, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: Number(limit),
        select: {
          id: true,
          name: true,
          email: true,
          CustomerDetail: {
            select: {
              id: true,
              dbName: true,
            },
          },
          Forecast: {
            select: {
              id: true,
              forecastDate: true,
            },
            take: 6,
            orderBy: {
              forecastDate: "desc",
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      }),
      prisma.user.count({ where }),
    ]);

    const totalPages = Math.ceil(total / Number(limit));

    res.json({
      distributors,
      pagination: {
        currentPage: Number(page),
        totalPages,
        totalItems: total,
        itemsPerPage: Number(limit),
      },
    });
  } catch (error) {
    console.error("Error fetching distributors with forecast:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get assigned distributors with forecasts for a sales officer
export const getAssignedDistributorsWithForecast = async (req: Request, res: Response) => {
  console.log(req.query);
  try {
    const {
      page = 1,
      limit = 1000,
    } = req.query;
    const { salesOfficerId } = req.params;

    const skip = (Number(page) - 1) * Number(limit);

    // Build where clause - only customers assigned to this sales officer
    const where: any = {
      userType: "CUSTOMER",
      DistributorAssignment: {
        some: {
          salesOfficerId: salesOfficerId,
        },
      },
    };

    const [distributors, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: Number(limit),
        select: {
          id: true,
          name: true,
          email: true,
          CustomerDetail: {
            select: {
              id: true,
              dbName: true,
            },
          },
          Forecast: {
            select: {
              id: true,
              forecastDate: true,
            },
            take: 6,
            orderBy: {
              forecastDate: "desc",
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      }),
      prisma.user.count({ where }),
    ]);

    const totalPages = Math.ceil(total / Number(limit));

    res.json({
      distributors,
      pagination: {
        currentPage: Number(page),
        totalPages,
        totalItems: total,
        itemsPerPage: Number(limit),
      },
    });
  } catch (error) {
    console.error("Error fetching assigned distributors with forecast:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get customer statistics
export const getCustomerStats = async (req: Request, res: Response) => {
  try {
    const [totalCustomers, customersWithOrders] = await Promise.all([
      prisma.user.count({
        where: { userType: "CUSTOMER" },
      }),
      prisma.user.count({
        where: {
          userType: "CUSTOMER",
          Order: {
            some: {},
          },
        },
      }),
    ]);

    res.json({
      totalCustomers,
      customersWithOrders,
      customersWithoutOrders: totalCustomers - customersWithOrders,
    });
  } catch (error) {
    console.error("Error fetching customer statistics:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get a single customer by ID
export const getCustomerById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const customer = await prisma.user.findUnique({
      where: { id },
      include: {
        CustomerDetail: true,
      },
    });

    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    // Check if user is actually a customer
    if (customer.userType !== "CUSTOMER") {
      return res.status(400).json({ message: "User is not a customer" });
    }

    res.json({ customer });
  } catch (error) {
    console.error("Error fetching customer:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Update a customer
export const updateCustomer = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check if customer exists and is actually a customer
    const existingCustomer = await prisma.user.findUnique({
      where: { id },
      include: {
        CustomerDetail: true,
      },
    });

    if (!existingCustomer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    if (existingCustomer.userType !== "CUSTOMER") {
      return res.status(400).json({ message: "User is not a customer" });
    }

    if (!existingCustomer.CustomerDetail || existingCustomer.CustomerDetail.length === 0) {
      return res.status(400).json({ message: "Customer detail not found" });
    }

    // Separate User fields from CustomerDetail fields
    const userFields = ['name', 'phone', 'password'];
    const customerDetailFields = [
      'dbName', 'dbCategory', 'area', 'state', 'address', 'pincode',
      'vehicleType', 'panNumber', 'gstinNumber', 'ownerAadharNumber',
      'salesOfficerName', 'salesOfficerContact', 'contact2', 'creditLimit', 'paymentTerms',
      'isCashDiscountAllowed', 'cashDiscountPercentage',
      'isSundayDispatchAllowed', 'isMondayDispatchAllowed', 'isTuesdayDispatchAllowed',
      'isWednesdayDispatchAllowed', 'isThursdayDispatchAllowed', 'isFridayDispatchAllowed',
      'isSaturdayDispatchAllowed', 'twoSideDistance', 'partyReportTagId'
    ];

    const userUpdateData: any = {};
    const customerDetailUpdateData: any = {};

    // Separate the update data
    Object.keys(updateData).forEach(key => {
      if (userFields.includes(key)) {
        userUpdateData[key] = updateData[key];
      } else if (customerDetailFields.includes(key)) {
        customerDetailUpdateData[key] = updateData[key];
      }
    });

    if (customerDetailUpdateData.partyReportTagId !== undefined) {
      const tagId = customerDetailUpdateData.partyReportTagId;
      if (tagId) {
        const tag = await prisma.partyReportTag.findUnique({ where: { id: tagId } });
        if (!tag) {
          return res.status(400).json({ message: "Party report tag not found" });
        }
      } else {
        customerDetailUpdateData.partyReportTagId = null;
      }
    }

    // Hash password if it's being updated
    if (userUpdateData.password) {
      userUpdateData.password = await bcrypt.hash(
        userUpdateData.password,
        +process.env.BCRYPT_SALT_ROUNDS! || 10
      );
    }

    // Check for conflicts with other customer details if updating unique fields
    // if (customerDetailUpdateData.panNumber || customerDetailUpdateData.gstinNumber || customerDetailUpdateData.ownerAadharNumber) {
    //   const conflictCustomerDetail = await prisma.customerDetail.findFirst({
    //     where: {
    //       AND: [
    //         { id: { not: existingCustomer.CustomerDetail[0].id } },
    //         {
    //           OR: [
    //             ...(customerDetailUpdateData.panNumber ? [{ panNumber: customerDetailUpdateData.panNumber }] : []),
    //             ...(customerDetailUpdateData.gstinNumber ? [{ gstinNumber: customerDetailUpdateData.gstinNumber }] : []),
    //             ...(customerDetailUpdateData.ownerAadharNumber ? [{ ownerAadharNumber: customerDetailUpdateData.ownerAadharNumber }] : []),
    //           ],
    //         },
    //       ],
    //     },
    //   });

    //   if (conflictCustomerDetail) {
    //     return res.status(409).json({
    //       message: "Customer with same PAN, GSTIN, or Aadhar number already exists"
    //     });
    //   }
    // }

    // Check if user with same email already exists (use request body email; userUpdateData has no email since it's not in userFields)
    const emailToCheck = updateData.email;
    if (emailToCheck) {
      const existingUser = await prisma.user.findFirst({
        where: { email: emailToCheck },
      });
      if (existingUser && existingUser.id !== id) {
        return res.status(409).json({ message: "User with same email already exists" });
      }

      const existingCustomerDetail = await prisma.customerDetail.findFirst({
        where: { email: emailToCheck },
      });
      if (existingCustomerDetail && existingCustomerDetail.dbUserId !== id) {
        return res.status(409).json({ message: "Customer with same email already exists" });
      }
    }

    // Update in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update user if there are user fields to update
      let updatedUser = existingCustomer;
      if (Object.keys(userUpdateData).length > 0) {
        updatedUser = await tx.user.update({
          where: { id },
          data: userUpdateData,
          include: {
            CustomerDetail: true,
          },
        });
      }

      // Update customer detail if there are customer detail fields to update
      let updatedCustomerDetail = existingCustomer.CustomerDetail[0];
      if (Object.keys(customerDetailUpdateData).length > 0) {
        updatedCustomerDetail = await tx.customerDetail.update({
          where: { id: existingCustomer.CustomerDetail[0].id },
          data: customerDetailUpdateData,
        });
      }

      return { user: updatedUser, customerDetail: updatedCustomerDetail };
    });

    res.json({
      customer: result.user,
      customerDetail: result.customerDetail
    });
  } catch (error) {
    console.error("Error updating customer:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Update own customer profile (for logged-in customers/distributors)
export const updateOwnCustomer = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user as any;

    if (!user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (user.userType !== "CUSTOMER") {
      return res.status(403).json({ message: "Customer access required" });
    }

    const id = user.id as string;
    const updateData = req.body;

    // Check if customer exists and is actually a customer
    const existingCustomer = await prisma.user.findUnique({
      where: { id },
      include: {
        CustomerDetail: true,
      },
    });

    if (!existingCustomer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    if (existingCustomer.userType !== "CUSTOMER") {
      return res.status(400).json({ message: "User is not a customer" });
    }

    if (!existingCustomer.CustomerDetail || existingCustomer.CustomerDetail.length === 0) {
      return res.status(400).json({ message: "Customer detail not found" });
    }

    // Separate User fields from CustomerDetail fields
    const userFields = ['name', 'phone', 'password'];
    const customerDetailFields = [
      'dbName', 'dbCategory', 'area', 'state', 'address', 'pincode',
      'vehicleType', 'panNumber', 'gstinNumber', 'ownerAadharNumber',
      'salesOfficerName', 'salesOfficerContact', 'contact2', 'creditLimit', 'paymentTerms',
      'isCashDiscountAllowed', 'cashDiscountPercentage',
      'isSundayDispatchAllowed', 'isMondayDispatchAllowed', 'isTuesdayDispatchAllowed',
      'isWednesdayDispatchAllowed', 'isThursdayDispatchAllowed', 'isFridayDispatchAllowed',
      'isSaturdayDispatchAllowed', 'twoSideDistance'
    ];

    const userUpdateData: any = {};
    const customerDetailUpdateData: any = {};

    // Separate the update data
    Object.keys(updateData).forEach(key => {
      if (userFields.includes(key)) {
        userUpdateData[key] = updateData[key];
      } else if (customerDetailFields.includes(key)) {
        customerDetailUpdateData[key] = updateData[key];
      }
    });

    // Hash password if it's being updated — require current password
    if (userUpdateData.password) {
      const oldPassword = updateData.oldPassword as string | undefined;
      if (!oldPassword) {
        return res.status(400).json({
          message: "Current password is required to set a new password",
        });
      }
      const isValid = await bcrypt.compare(oldPassword, existingCustomer.password);
      if (!isValid) {
        return res.status(401).json({ message: "Current password is incorrect" });
      }
      userUpdateData.password = await bcrypt.hash(
        userUpdateData.password,
        +process.env.BCRYPT_SALT_ROUNDS! || 10
      );
    }

    // Check for email conflicts if email is being updated
    const emailToCheck = updateData.email;
    if (emailToCheck) {
      const existingUser = await prisma.user.findFirst({
        where: { email: emailToCheck },
      });
      if (existingUser && existingUser.id !== id) {
        return res.status(409).json({ message: "User with same email already exists" });
      }

      const existingCustomerDetail = await prisma.customerDetail.findFirst({
        where: { email: emailToCheck },
      });
      if (existingCustomerDetail && existingCustomerDetail.dbUserId !== id) {
        return res.status(409).json({ message: "Customer with same email already exists" });
      }
    }

    // Update in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update user if there are user fields to update
      let updatedUser = existingCustomer;
      if (Object.keys(userUpdateData).length > 0) {
        updatedUser = await tx.user.update({
          where: { id },
          data: userUpdateData,
          include: {
            CustomerDetail: true,
          },
        });
      }

      // Update customer detail if there are customer detail fields to update
      let updatedCustomerDetail = existingCustomer.CustomerDetail[0];
      if (Object.keys(customerDetailUpdateData).length > 0) {
        updatedCustomerDetail = await tx.customerDetail.update({
          where: { id: existingCustomer.CustomerDetail[0].id },
          data: customerDetailUpdateData,
        });
      }

      return { user: updatedUser, customerDetail: updatedCustomerDetail };
    });

    res.json({
      customer: result.user,
      customerDetail: result.customerDetail
    });
  } catch (error) {
    console.error("Error updating own customer profile:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Delete a customer
export const deleteCustomer = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if customer exists and is actually a customer
    const customer = await prisma.user.findUnique({
      where: { id },
      include: {
        Order: true,
        CustomerDetail: true,
        Forecast: true,
      },
    });

    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    if (customer.userType !== "CUSTOMER") {
      return res.status(400).json({ message: "User is not a customer" });
    }

    // Check if customer has orders
    if (customer.Order.length > 0) {
      return res.status(400).json({
        message: "Cannot delete customer with existing orders. Please delete orders first."
      });
    }

    // Check if customer has any forecasts
    if (customer.Forecast.length > 0) {
      return res.status(400).json({
        message: "Cannot delete customer with existing forecasts. Please delete forecasts first."
      });
    }

    // Delete customer and customer detail in a transaction
    await prisma.$transaction(async (tx) => {
      // Delete customer details first
      if (customer.CustomerDetail && customer.CustomerDetail.length > 0) {
        await tx.customerDetail.deleteMany({
          where: { dbUserId: id },
        });
      }

      // Delete user
      await tx.user.delete({
        where: { id },
      });
    });

    res.json({ message: "Customer deleted successfully" });
  } catch (error) {
    console.error("Error deleting customer:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

//delete all customers and customer details
export const deleteAllCustomers = async (req: Request, res: Response) => {
  try {
    // Get all customers
    const customers = await prisma.user.findMany({
      where: { userType: "CUSTOMER" },
    });

    await prisma.$transaction(async (tx) => {
      // Delete all customer details before deleting customers
      await tx.customerDetail.deleteMany({
        where: { dbUserId: { in: customers.map(customer => customer.id) } },
      });
      // Delete all customers
      await tx.user.deleteMany({
        where: { userType: "CUSTOMER" },
      });
    });
    res.json({ message: `All ${customers.length} customers and customer details deleted successfully` });
  } catch (error) {
    console.error("Error deleting all customers and customer details:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
