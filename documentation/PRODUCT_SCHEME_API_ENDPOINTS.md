# Product Scheme API Endpoints

Base URL: `/api/product-schemes`

## Endpoints

### 1. Create Product Scheme

**Endpoint:** `POST /api/product-schemes`

**Description:** Create a new product scheme with a specific percentage discount for a date range.

**Request Body:**
```json
{
  "schemePercentage": 15.5,
  "startDate": "2024-01-01T00:00:00Z",
  "endDate": "2024-12-31T23:59:59Z",
  "isActive": true,
  "productId": "507f1f77bcf86cd799439011"
}
```

**Validation Rules:**
- `schemePercentage`: Required, number between 0-100
- `startDate`: Required, valid date string or Date object
- `endDate`: Required, valid date string or Date object, must be after startDate
- `isActive`: Optional, boolean (defaults to false)
- `productId`: Required, valid MongoDB ObjectId (24 characters)

**Success Response:** `201 Created`
```json
{
  "productScheme": {
    "id": "507f1f77bcf86cd799439012",
    "schemePercentage": 15.5,
    "startDate": "2024-01-01T00:00:00.000Z",
    "endDate": "2024-12-31T23:59:59.000Z",
    "isActive": true,
    "productId": "507f1f77bcf86cd799439011",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z",
    "Product": {
      "id": "507f1f77bcf86cd799439011",
      "name": "Premium Product",
      "productCode": "PP-001"
    }
  }
}
```

**Error Responses:**
- `400 Bad Request`: Validation error (invalid data)
- `404 Not Found`: Product not found
- `409 Conflict`: Overlapping scheme exists for the product within the date range
- `500 Internal Server Error`: Server error

---

### 2. Get All Product Schemes

**Endpoint:** `GET /api/product-schemes`

**Description:** Retrieve all product schemes with pagination and filtering.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `productId` (optional): Filter by product ID
- `isActive` (optional): Filter by active status (true/false)

**Example Request:**
```
GET /api/product-schemes?page=1&limit=10&isActive=true
GET /api/product-schemes?productId=507f1f77bcf86cd799439011
```

**Success Response:** `200 OK`
```json
{
  "productSchemes": [
    {
      "id": "507f1f77bcf86cd799439012",
      "schemePercentage": 15.5,
      "startDate": "2024-01-01T00:00:00.000Z",
      "endDate": "2024-12-31T23:59:59.000Z",
      "isActive": true,
      "productId": "507f1f77bcf86cd799439011",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z",
      "Product": {
        "id": "507f1f77bcf86cd799439011",
        "name": "Premium Product",
        "productCode": "PP-001"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": false
  }
}
```

**Error Responses:**
- `400 Bad Request`: Invalid query parameters
- `500 Internal Server Error`: Server error

---

### 3. Get Product Scheme by ID

**Endpoint:** `GET /api/product-schemes/:id`

**Description:** Retrieve a specific product scheme by its ID.

**URL Parameters:**
- `id`: Product scheme ID (MongoDB ObjectId)

**Example Request:**
```
GET /api/product-schemes/507f1f77bcf86cd799439012
```

**Success Response:** `200 OK`
```json
{
  "productScheme": {
    "id": "507f1f77bcf86cd799439012",
    "schemePercentage": 15.5,
    "startDate": "2024-01-01T00:00:00.000Z",
    "endDate": "2024-12-31T23:59:59.000Z",
    "isActive": true,
    "productId": "507f1f77bcf86cd799439011",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z",
    "Product": {
      "id": "507f1f77bcf86cd799439011",
      "name": "Premium Product",
      "productCode": "PP-001",
      "mrp": 1500
    }
  }
}
```

**Error Responses:**
- `404 Not Found`: Product scheme not found
- `500 Internal Server Error`: Server error

---

### 4. Get Active Schemes by Product

**Endpoint:** `GET /api/product-schemes/product/:productId/active`

**Description:** Retrieve all currently active schemes for a specific product (schemes that are active and within the current date range).

**URL Parameters:**
- `productId`: Product ID (MongoDB ObjectId)

**Example Request:**
```
GET /api/product-schemes/product/507f1f77bcf86cd799439011/active
```

**Success Response:** `200 OK`
```json
{
  "activeSchemes": [
    {
      "id": "507f1f77bcf86cd799439012",
      "schemePercentage": 15.5,
      "startDate": "2024-01-01T00:00:00.000Z",
      "endDate": "2024-12-31T23:59:59.000Z",
      "isActive": true,
      "productId": "507f1f77bcf86cd799439011",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z",
      "Product": {
        "id": "507f1f77bcf86cd799439011",
        "name": "Premium Product",
        "productCode": "PP-001"
      }
    }
  ]
}
```

**Error Responses:**
- `404 Not Found`: Product not found
- `500 Internal Server Error`: Server error

---

### 5. Update Product Scheme

**Endpoint:** `PUT /api/product-schemes/:id`

**Description:** Update an existing product scheme.

**URL Parameters:**
- `id`: Product scheme ID (MongoDB ObjectId)

**Request Body:** (all fields optional)
```json
{
  "schemePercentage": 20,
  "startDate": "2024-02-01T00:00:00Z",
  "endDate": "2024-11-30T23:59:59Z",
  "isActive": false,
  "productId": "507f1f77bcf86cd799439011"
}
```

**Validation Rules:**
- `schemePercentage`: Optional, number between 0-100
- `startDate`: Optional, valid date string or Date object
- `endDate`: Optional, valid date string or Date object, must be after startDate if both provided
- `isActive`: Optional, boolean
- `productId`: Optional, valid MongoDB ObjectId (24 characters)

**Success Response:** `200 OK`
```json
{
  "productScheme": {
    "id": "507f1f77bcf86cd799439012",
    "schemePercentage": 20,
    "startDate": "2024-02-01T00:00:00.000Z",
    "endDate": "2024-11-30T23:59:59.000Z",
    "isActive": false,
    "productId": "507f1f77bcf86cd799439011",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-20T14:45:00.000Z",
    "Product": {
      "id": "507f1f77bcf86cd799439011",
      "name": "Premium Product",
      "productCode": "PP-001"
    }
  }
}
```

**Error Responses:**
- `400 Bad Request`: Validation error
- `404 Not Found`: Product scheme or product not found
- `409 Conflict`: Overlapping scheme exists for the product within the updated date range
- `500 Internal Server Error`: Server error

---

### 6. Toggle Product Scheme Status

**Endpoint:** `PATCH /api/product-schemes/:id/toggle-status`

**Description:** Activate or deactivate a product scheme.

**URL Parameters:**
- `id`: Product scheme ID (MongoDB ObjectId)

**Request Body:**
```json
{
  "isActive": true
}
```

**Success Response:** `200 OK`
```json
{
  "productScheme": {
    "id": "507f1f77bcf86cd799439012",
    "schemePercentage": 15.5,
    "startDate": "2024-01-01T00:00:00.000Z",
    "endDate": "2024-12-31T23:59:59.000Z",
    "isActive": true,
    "productId": "507f1f77bcf86cd799439011",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-20T16:00:00.000Z",
    "Product": {
      "id": "507f1f77bcf86cd799439011",
      "name": "Premium Product",
      "productCode": "PP-001"
    }
  }
}
```

**Error Responses:**
- `400 Bad Request`: Validation error (isActive must be boolean)
- `404 Not Found`: Product scheme not found
- `500 Internal Server Error`: Server error

---

### 7. Delete Product Scheme

**Endpoint:** `DELETE /api/product-schemes/:id`

**Description:** Delete a product scheme.

**URL Parameters:**
- `id`: Product scheme ID (MongoDB ObjectId)

**Success Response:** `200 OK`
```json
{
  "message": "Product scheme deleted successfully"
}
```

**Error Responses:**
- `404 Not Found`: Product scheme not found
- `500 Internal Server Error`: Server error

---

## Authentication

All endpoints can be protected with JWT authentication by uncommenting the following line in the route file:
```typescript
router.use(validateAccessToken);
```

When authentication is enabled, include the access token in the Authorization header:
```
Authorization: Bearer <your-access-token>
```

---

## Common Error Response Format

```json
{
  "message": "Error message description"
}
```

For validation errors:
```json
{
  "message": [
    {
      "code": "invalid_type",
      "expected": "number",
      "received": "string",
      "path": ["schemePercentage"],
      "message": "Expected number, received string"
    }
  ]
}
```

---

## Notes

1. **Date Validation**: The system ensures that `endDate` is always after `startDate`.

2. **Overlapping Schemes**: The system prevents creating or updating schemes that overlap with existing schemes for the same product.

3. **Active Schemes**: The `/product/:productId/active` endpoint only returns schemes where:
   - `isActive` is `true`
   - Current date is between `startDate` and `endDate`

4. **Pagination**: Default pagination is 10 items per page. You can adjust this using the `limit` query parameter.

5. **Product Relationship**: Each scheme is linked to a product, and the product information is included in the response.

