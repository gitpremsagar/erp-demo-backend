# Customer Product Order History API Endpoint

This document describes the API endpoint for retrieving the order history of a specific product for a specific customer.

## Base URL
```
/api/order-items
```

## Endpoint

### Get Customer Product Order History
**GET** `/api/order-items/customer-product-order-history/:customerId/:productId`

Retrieves the complete order history for a specific product ordered by a specific customer. This endpoint returns all completed order items that match both the customer ID and product ID.

**Path Parameters:**
- `customerId` (required): Customer ID (MongoDB ObjectId - 24 characters)
- `productId` (required): Product ID (MongoDB ObjectId - 24 characters)

**Example Request:**
```
GET /api/order-items/customer-product-order-history/507f1f77bcf86cd799439011/507f1f77bcf86cd799439012
```

**Response (200):**
```json
{
  "customerProductOrderHistory": [
    {
      "id": "string",
      "orderId": "string",
      "productId": "string",
      "customerId": "string",
      "quantity": "number",
      "orderDate": "datetime",
      "deliveryDate": "datetime",
      "orderCompleted": "boolean",
      "createdAt": "datetime",
      "updatedAt": "datetime"
    }
  ]
}
```

**Response (404):**
```json
{
  "message": "Customer product order history not found"
}
```

**Response (500):**
```json
{
  "message": "Internal server error"
}
```

---

## Business Logic

1. **Filtering Criteria:**
   - Filters order items by `customerId` and `productId`
   - Only returns order items where `orderCompleted` is `true`
   - Returns all matching completed order items (no pagination)

2. **Data Retrieval:**
   - Queries the `OrderItem` table using Prisma
   - Matches records where:
     - `customerId` equals the provided customer ID
     - `productId` equals the provided product ID
     - `orderCompleted` is `true`

3. **Response:**
   - Returns an array of order items (can be empty if no matches found)
   - Each order item includes all standard OrderItem fields

---

## Use Cases

This endpoint is useful for:

1. **Customer Purchase Analysis**: Analyzing a customer's purchase history for a specific product
2. **Repeat Order Tracking**: Identifying how often a customer orders a particular product
3. **Customer Behavior Insights**: Understanding customer preferences and ordering patterns
4. **Sales Reporting**: Generating reports on product sales to specific customers
5. **Inventory Planning**: Understanding demand patterns for specific customer-product combinations

---

## Example Use Cases

### Example 1: Get all completed orders for Product A by Customer B
```
GET /api/order-items/customer-product-order-history/507f1f77bcf86cd799439011/507f1f77bcf86cd799439012
```

**Response:**
```json
{
  "customerProductOrderHistory": [
    {
      "id": "507f1f77bcf86cd799439013",
      "orderId": "507f1f77bcf86cd799439014",
      "productId": "507f1f77bcf86cd799439012",
      "customerId": "507f1f77bcf86cd799439011",
      "quantity": 10,
      "orderDate": "2024-01-15T10:30:00Z",
      "deliveryDate": "2024-01-20T14:00:00Z",
      "orderCompleted": true,
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-20T14:00:00Z"
    },
    {
      "id": "507f1f77bcf86cd799439015",
      "orderId": "507f1f77bcf86cd799439016",
      "productId": "507f1f77bcf86cd799439012",
      "customerId": "507f1f77bcf86cd799439011",
      "quantity": 5,
      "orderDate": "2024-02-10T09:15:00Z",
      "deliveryDate": "2024-02-15T11:30:00Z",
      "orderCompleted": true,
      "createdAt": "2024-02-10T09:15:00Z",
      "updatedAt": "2024-02-15T11:30:00Z"
    }
  ]
}
```

### Example 2: No matching orders found
```
GET /api/order-items/customer-product-order-history/507f1f77bcf86cd799439011/507f1f77bcf86cd799439012
```

**Response:**
```json
{
  "customerProductOrderHistory": []
}
```

---

## Error Handling

### Invalid Customer ID or Product ID Format
If the provided IDs are not valid MongoDB ObjectIds (24 characters), Prisma will throw an error and the endpoint will return a 500 Internal Server Error.

### Database Connection Issues
If there are database connectivity issues, the endpoint will return:
```json
{
  "message": "Internal server error"
}
```

---

## Implementation Details

### Controller Function
```typescript
export const getCustomerProductOrderHistory = async (req: Request, res: Response) => {
  try {
    const { customerId, productId } = req.params;
    const customerProductOrderHistory = await prisma.orderItem.findMany({
      where: { customerId, productId, orderCompleted: true },
    });
    // Note: Response should be sent here
    res.json({ customerProductOrderHistory });
  } catch (error) {
    console.error("Error fetching customer product order history:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
```

### Route Definition
```typescript
router.get("/customer-product-order-history/:customerId/:productId", getCustomerProductOrderHistory);
```

---

## Related Endpoints

- **Get Product Order History**: `GET /api/order-items/product-order-history/:productId`
  - Returns order history for a product across all customers
- **Get All Order Items**: `GET /api/order-items`
  - Returns all order items with pagination and filtering options
- **Get Order Item by ID**: `GET /api/order-items/:id`
  - Returns a specific order item by its ID

---

## Data Model

### OrderItem Schema
```typescript
{
  id: string;                    // MongoDB ObjectId
  orderId: string;               // Reference to Order
  productId: string;             // Reference to Product
  customerId: string;            // Reference to Customer (User)
  quantity: number;              // Quantity ordered
  orderDate: Date;               // Order date (optional)
  deliveryDate: Date;            // Expected delivery date (optional)
  orderCompleted: boolean;       // Completion status (must be true for this endpoint)
  createdAt: Date;               // Creation timestamp
  updatedAt: Date;               // Last update timestamp
}
```

### Related Models
- **Order**: Contains order information, status, and customer details
- **Product**: Contains product details, pricing, and inventory information
- **User (Customer)**: Contains customer information and details

---

## Notes

1. **Completed Orders Only**: This endpoint only returns order items where `orderCompleted` is `true`. Pending or incomplete orders are excluded.

2. **No Pagination**: Unlike the general order items endpoint, this endpoint does not support pagination. All matching records are returned in a single response.

3. **No Related Data**: Currently, the endpoint does not include related Order or Product data in the response. The `include` statements are commented out in the implementation. If you need related data, uncomment the include statements in the controller.

4. **Empty Array vs 404**: If no matching orders are found, the endpoint returns an empty array `[]` rather than a 404 error, as this is a valid state (a customer may not have ordered a specific product yet).

---

## Authentication

Currently, authentication is commented out in the routes. To enable authentication:

1. Uncomment the line: `router.use(validateAccessToken);` in `orderItem.route.ts`
2. Ensure the `validateAccessToken` middleware is properly configured
3. Include the access token in the Authorization header: `Authorization: Bearer <token>`

---

## Future Enhancements

Potential improvements for this endpoint:

1. **Include Related Data**: Uncomment the `include` statements to return Order and Product details
2. **Pagination Support**: Add pagination for customers with extensive order history
3. **Date Range Filtering**: Add query parameters for filtering by date range
4. **Sorting Options**: Add sorting by date, quantity, or other fields
5. **Aggregation Support**: Add summary statistics (total quantity, average quantity, etc.)
6. **Response Formatting**: Format dates and include calculated fields like total value

