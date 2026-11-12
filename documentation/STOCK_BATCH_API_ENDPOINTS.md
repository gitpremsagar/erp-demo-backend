# Stock Batch API Endpoints

This document describes all the available endpoints for managing stock batches in the system.

## Base URL
```
/api/stock-batches
```

## Authentication
All endpoints require authentication (currently commented out in routes for development).

---

## Endpoints

### 1. Create Stock Batch
**POST** `/api/stock-batches`

Creates a new stock batch entry. The expiry date is automatically calculated based on the manufacturing date and the product's `lifeOfProduct` value.

**Request Body:**
```json
{
  "productId": "string (required, 24 chars)",
  "manufacturingDate": "string (required, ISO datetime or date)",
  "arrivalDate": "string (required, ISO datetime or date)",
  "stockQuantity": "number (optional, default: 0, must be integer >= 0)",
  "isArchived": "boolean (optional, default: false)"
}
```

**Validation Rules:**
- `productId`: Required, must be exactly 24 characters (MongoDB ObjectId)
- `manufacturingDate`: Required, must be a valid date string
- `arrivalDate`: Required, must be a valid date string
- `stockQuantity`: Optional, must be an integer >= 0 (default: 0)
- `isArchived`: Optional boolean (default: false)

**Success Response:**
- **Status Code:** 201 Created
- **Response Body:**
```json
{
  "stock": {
    "id": "string",
    "productId": "string",
    "manufacturingDate": "datetime",
    "arrivalDate": "datetime",
    "expiryDate": "datetime",
    "stockQuantity": "number",
    "isArchived": "boolean",
    "createdAt": "datetime",
    "updatedAt": "datetime",
    "product": {
      "id": "string",
      "name": "string",
      "productCode": "string",
      "mrp": "number",
      "lifeOfProduct": "number",
      "Category": {
        "id": "string",
        "name": "string"
      }
    }
  }
}
```

**Error Responses:**
- **400 Bad Request** - Product does not have a lifeOfProduct value
  ```json
  {
    "message": "Product does not have a lifeOfProduct value. Cannot calculate expiry date."
  }
  ```
- **404 Not Found** - Product not found
  ```json
  {
    "message": "Product not found"
  }
  ```
- **500 Internal Server Error** - Server error

---

### 2. Get All Stock Batches
**GET** `/api/stock-batches`

Retrieves all stock batches with pagination and filtering options.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `search` (optional): Search in product name or product code (case-insensitive)
- `productId` (optional): Filter by product ID
- `isArchived` (optional): Filter by archive status (true/false)
- `expired` (optional): Filter expired items (true) or non-expired items (false)
- `lowStock` (optional): Filter low stock items (true) - items with stockQuantity <= 10

**Success Response:**
- **Status Code:** 200 OK
- **Response Body:**
```json
{
  "stockBatches": [
    {
      "id": "string",
      "productId": "string",
      "manufacturingDate": "datetime",
      "arrivalDate": "datetime",
      "expiryDate": "datetime",
      "stockQuantity": "number",
      "isArchived": "boolean",
      "createdAt": "datetime",
      "updatedAt": "datetime",
      "product": {
        "id": "string",
        "name": "string",
        "productCode": "string",
        "Category": {
          "id": "string",
          "name": "string"
        }
      },
      "StockRecord": [
        {
          "id": "string",
          "changeInStock": "number",
          "reason": "string",
          "createdAt": "datetime"
        }
      ]
    }
  ],
  "pagination": {
    "page": "number",
    "limit": "number",
    "total": "number",
    "totalPages": "number",
    "hasNext": "boolean",
    "hasPrev": "boolean"
  }
}
```

**Error Responses:**
- **500 Internal Server Error** - Server error

---

### 3. Get Stock Batch by ID
**GET** `/api/stock-batches/:id`

Retrieves a specific stock batch by its database ID with full details including stock records.

**URL Parameters:**
- `id` - Stock batch ID (MongoDB ObjectId)

**Success Response:**
- **Status Code:** 200 OK
- **Response Body:**
```json
{
  "stockBatch": {
    "id": "string",
    "productId": "string",
    "manufacturingDate": "datetime",
    "arrivalDate": "datetime",
    "expiryDate": "datetime",
    "stockQuantity": "number",
    "isArchived": "boolean",
    "createdAt": "datetime",
    "updatedAt": "datetime",
    "product": {
      "id": "string",
      "name": "string",
      "productCode": "string",
      "Category": {
        "id": "string",
        "name": "string"
      }
    },
    "StockRecord": [
      {
        "id": "string",
        "changeInStock": "number",
        "reason": "string",
        "createdAt": "datetime",
        "User": {
          "id": "string",
          "name": "string",
          "email": "string"
        }
      }
    ]
  }
}
```

**Error Responses:**
- **404 Not Found** - Stock batch not found
  ```json
  {
    "message": "Stock not found"
  }
  ```
- **500 Internal Server Error** - Server error

---

### 4. Update Stock Batch
**PUT** `/api/stock-batches/:id`

Updates an existing stock batch. If `manufacturingDate` or `productId` is updated, the expiry date will be automatically recalculated.

**URL Parameters:**
- `id` - Stock batch ID (MongoDB ObjectId)

**Request Body:** (all fields optional)
```json
{
  "productId": "string (optional, 24 chars)",
  "manufacturingDate": "string (optional, ISO datetime or date)",
  "arrivalDate": "string (optional, ISO datetime or date)",
  "stockQuantity": "number (optional, must be integer >= 0)",
  "isArchived": "boolean (optional)"
}
```

**Validation Rules:**
- All fields are optional
- If `productId` is provided, must be exactly 24 characters
- If `manufacturingDate` is provided, must be a valid date string
- If `arrivalDate` is provided, must be a valid date string
- If `stockQuantity` is provided, must be an integer >= 0

**Success Response:**
- **Status Code:** 200 OK
- **Response Body:**
```json
{
  "stockBatch": {
    "id": "string",
    "productId": "string",
    "manufacturingDate": "datetime",
    "arrivalDate": "datetime",
    "expiryDate": "datetime",
    "stockQuantity": "number",
    "isArchived": "boolean",
    "createdAt": "datetime",
    "updatedAt": "datetime",
    "product": {
      "id": "string",
      "name": "string",
      "productCode": "string",
      "Category": {
        "id": "string",
        "name": "string"
      }
    }
  }
}
```

**Error Responses:**
- **400 Bad Request** - Product does not have a lifeOfProduct value
  ```json
  {
    "message": "Product does not have a lifeOfProduct value. Cannot calculate expiry date."
  }
  ```
- **404 Not Found** - Stock batch or product not found
  ```json
  {
    "message": "Stock not found"
  }
  ```
  or
  ```json
  {
    "message": "Product not found"
  }
  ```
- **500 Internal Server Error** - Server error

---

### 5. Delete Stock Batch
**DELETE** `/api/stock-batches/:id`

Deletes a stock batch. The stock batch can only be deleted if it has no associated stock records.

**URL Parameters:**
- `id` - Stock batch ID (MongoDB ObjectId)

**Success Response:**
- **Status Code:** 200 OK
- **Response Body:**
```json
{
  "message": "Stock batch deleted successfully"
}
```

**Error Responses:**
- **404 Not Found** - Stock batch not found
  ```json
  {
    "message": "Stock not found"
  }
  ```
- **400 Bad Request** - Stock batch has associated stock records
  ```json
  {
    "message": "Cannot delete stock as it has associated stock records"
  }
  ```
- **500 Internal Server Error** - Server error

---

### 6. Archive/Unarchive Stock Batch
**PATCH** `/api/stock-batches/:id/archive`

Toggles the archive status of a stock batch.

**URL Parameters:**
- `id` - Stock batch ID (MongoDB ObjectId)

**Request Body:**
```json
{
  "isArchived": "boolean (required)"
}
```

**Validation Rules:**
- `isArchived`: Required boolean value

**Success Response:**
- **Status Code:** 200 OK
- **Response Body:**
```json
{
  "stockBatch": {
    "id": "string",
    "productId": "string",
    "manufacturingDate": "datetime",
    "arrivalDate": "datetime",
    "expiryDate": "datetime",
    "stockQuantity": "number",
    "isArchived": "boolean",
    "createdAt": "datetime",
    "updatedAt": "datetime",
    "product": {
      "id": "string",
      "name": "string",
      "productCode": "string",
      "Category": {
        "id": "string",
        "name": "string"
      }
    }
  }
}
```

**Error Responses:**
- **404 Not Found** - Stock batch not found
  ```json
  {
    "message": "Stock not found"
  }
  ```
- **500 Internal Server Error** - Server error

---

### 7. Get Stock Batches by Product ID
**GET** `/api/stock-batches/product/:productId`

Retrieves all stock batches for a specific product with pagination and filtering.

**URL Parameters:**
- `productId` - Product ID (MongoDB ObjectId)

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `isArchived` (optional): Filter by archive status (true/false)
- `expired` (optional): Filter expired items (true) or non-expired items (false)
- `lowStock` (optional): Filter low stock items (true) - items with stockQuantity <= 10

**Success Response:**
- **Status Code:** 200 OK
- **Response Body:**
```json
{
  "product": {
    "id": "string",
    "name": "string",
    "productCode": "string",
    "Category": {
      "id": "string",
      "name": "string"
    }
  },
  "stockBatches": [
    {
      "id": "string",
      "productId": "string",
      "manufacturingDate": "datetime",
      "arrivalDate": "datetime",
      "expiryDate": "datetime",
      "stockQuantity": "number",
      "isArchived": "boolean",
      "createdAt": "datetime",
      "updatedAt": "datetime",
      "product": {
        "id": "string",
        "name": "string",
        "productCode": "string",
        "Category": {
          "id": "string",
          "name": "string"
        }
      },
      "StockRecord": [
        {
          "id": "string",
          "changeInStock": "number",
          "reason": "string",
          "createdAt": "datetime"
        }
      ]
    }
  ],
  "pagination": {
    "page": "number",
    "limit": "number",
    "total": "number",
    "totalPages": "number",
    "hasNext": "boolean",
    "hasPrev": "boolean"
  }
}
```

**Error Responses:**
- **404 Not Found** - Product not found
  ```json
  {
    "message": "Product not found"
  }
  ```
- **500 Internal Server Error** - Server error

---

### 8. Get Stock Statistics
**GET** `/api/stock-batches/stats`

Retrieves comprehensive stock statistics and summary information.

**Success Response:**
- **Status Code:** 200 OK
- **Response Body:**
```json
{
  "stats": {
    "totalStockBatches": "number",
    "totalQuantity": "number",
    "totalInventoryValue": "number",
    "expiredStocks": "number",
    "lowStockCount": "number",
    "archivedStockBatches": "number",
    "activeStockBatches": "number"
  }
}
```

**Response Fields:**
- `totalStockBatches`: Total number of stock batches in the system
- `totalQuantity`: Sum of all stock quantities across all batches
- `totalInventoryValue`: Total inventory value calculated as sum of (product.mrp × stockQuantity) for all batches
- `expiredStocks`: Count of stock batches with expiry date in the past
- `lowStockCount`: Count of stock batches with quantity <= 10
- `archivedStockBatches`: Count of archived stock batches
- `activeStockBatches`: Count of non-archived stock batches

**Error Responses:**
- **500 Internal Server Error** - Server error

---

### 9. Get Stock Alerts
**GET** `/api/stock-batches/alerts`

Retrieves stock alerts for expired items, low stock items, and items expiring soon (within 30 days).

**Success Response:**
- **Status Code:** 200 OK
- **Response Body:**
```json
{
  "alerts": {
    "expired": [
      {
        "id": "string",
        "productId": "string",
        "manufacturingDate": "datetime",
        "arrivalDate": "datetime",
        "expiryDate": "datetime",
        "stockQuantity": "number",
        "isArchived": "boolean",
        "product": {
          "name": "string",
          "productCode": "string"
        }
      }
    ],
    "lowStock": [
      {
        "id": "string",
        "productId": "string",
        "manufacturingDate": "datetime",
        "arrivalDate": "datetime",
        "expiryDate": "datetime",
        "stockQuantity": "number",
        "isArchived": "boolean",
        "product": {
          "name": "string",
          "productCode": "string",
          "lowStockLimit": "number"
        }
      }
    ],
    "expiringSoon": [
      {
        "id": "string",
        "productId": "string",
        "manufacturingDate": "datetime",
        "arrivalDate": "datetime",
        "expiryDate": "datetime",
        "stockQuantity": "number",
        "isArchived": "boolean",
        "product": {
          "name": "string",
          "productCode": "string"
        }
      }
    ],
    "totalAlerts": "number"
  }
}
```

**Response Fields:**
- `expired`: Array of stock batches that have expired (expiryDate < current date), ordered by expiry date (ascending)
- `lowStock`: Array of stock batches with quantity <= 10, ordered by stock quantity (ascending)
- `expiringSoon`: Array of stock batches expiring within 30 days, ordered by expiry date (ascending)
- `totalAlerts`: Total count of all alerts (sum of expired, lowStock, and expiringSoon)

**Note:** All alerts only include non-archived stock batches (`isArchived: false`).

**Error Responses:**
- **500 Internal Server Error** - Server error

---

## Error Responses

All endpoints may return the following error responses:

### 400 Bad Request
```json
{
  "message": "Validation error details or business logic error"
}
```

### 404 Not Found
```json
{
  "message": "Resource not found (Stock batch, Product, etc.)"
}
```

### 500 Internal Server Error
```json
{
  "message": "Internal server error"
}
```

---

## Notes

1. **Expiry Date Calculation**: The expiry date is automatically calculated when creating or updating a stock batch. The formula is: `expiryDate = manufacturingDate + product.lifeOfProduct (months)`. The product must have a `lifeOfProduct` value for this calculation to work.

2. **Stock Records**: Each stock batch can have multiple stock records tracking changes in quantity. Stock records are included in the response when fetching stock batches.

3. **Archive Status**: Archived stock batches are hidden from normal operations but can still be queried by explicitly setting `isArchived: true` in filters.

4. **Low Stock Threshold**: Currently set to 10 units as an example threshold. This should be configured based on business requirements. The system also checks if the product has a `lowStockLimit` value.

5. **Expiring Soon**: Items expiring within 30 days from the current date are flagged in alerts.

6. **Pagination**: All list endpoints support pagination with `page` and `limit` query parameters. The default page size is 10 items.

7. **Search**: The search functionality in "Get All Stock Batches" searches in product name and product code (case-insensitive).

8. **Deletion Restriction**: Stock batches cannot be deleted if they have associated stock records. This ensures data integrity and audit trail.

9. **Authentication**: All routes are currently set up for authentication but commented out for development purposes. Uncomment `router.use(validateAccessToken);` in the route file to enable authentication.

10. **Date Formats**: Date fields accept various formats including ISO datetime strings and date-only strings. The system will parse them appropriately.

