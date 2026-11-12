# Product Group API Endpoints

This document describes the API endpoints for managing Product Groups in the ERP system.

## Base URL
```
/api/product-groups
```

---

## Endpoints

### 1. Create Product Group
**POST** `/api/product-groups`

Creates a new product group.

**Request Body:**
```json
{
  "name": "Snacks"
}
```

**Validation Rules:**
- `name` (required): String, min 1 character, max 100 characters

**Success Response:**
- **Code:** 201 Created
- **Content:**
```json
{
  "productGroup": {
    "id": "507f1f77bcf86cd799439011",
    "name": "Snacks",
    "createdAt": "2024-11-29T10:00:00.000Z",
    "updatedAt": "2024-11-29T10:00:00.000Z"
  }
}
```

**Error Responses:**
- **Code:** 400 Bad Request
  - **Content:** `{ "message": "Validation error details" }`
- **Code:** 409 Conflict
  - **Content:** `{ "message": "Product group with this name already exists" }`
- **Code:** 500 Internal Server Error
  - **Content:** `{ "message": "Internal server error" }`

---

### 2. Get All Product Groups
**GET** `/api/product-groups`

Retrieves a paginated list of product groups with optional search filtering.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `search` (optional): Search term for filtering by name (case-insensitive)

**Example Request:**
```
GET /api/product-groups?page=1&limit=10&search=snack
```

**Success Response:**
- **Code:** 200 OK
- **Content:**
```json
{
  "productGroups": [
    {
      "id": "507f1f77bcf86cd799439011",
      "name": "Snacks",
      "createdAt": "2024-11-29T10:00:00.000Z",
      "updatedAt": "2024-11-29T10:00:00.000Z",
      "_count": {
        "Product": 15
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  }
}
```

**Error Responses:**
- **Code:** 400 Bad Request
  - **Content:** `{ "message": "Validation error details" }`
- **Code:** 500 Internal Server Error
  - **Content:** `{ "message": "Internal server error" }`

---

### 3. Get Product Group by ID
**GET** `/api/product-groups/:id`

Retrieves a specific product group by its ID, including associated products.

**URL Parameters:**
- `id` (required): Product group ID

**Example Request:**
```
GET /api/product-groups/507f1f77bcf86cd799439011
```

**Success Response:**
- **Code:** 200 OK
- **Content:**
```json
{
  "productGroup": {
    "id": "507f1f77bcf86cd799439011",
    "name": "Snacks",
    "createdAt": "2024-11-29T10:00:00.000Z",
    "updatedAt": "2024-11-29T10:00:00.000Z",
    "Product": [
      {
        "id": "507f1f77bcf86cd799439012",
        "name": "Chips",
        "productCode": "SNK001",
        "mrp": 50,
        "imageUrl": "https://example.com/chips.jpg"
      }
    ],
    "_count": {
      "Product": 15
    }
  }
}
```

**Error Responses:**
- **Code:** 404 Not Found
  - **Content:** `{ "message": "Product group not found" }`
- **Code:** 500 Internal Server Error
  - **Content:** `{ "message": "Internal server error" }`

---

### 4. Update Product Group
**PUT** `/api/product-groups/:id`

Updates an existing product group.

**URL Parameters:**
- `id` (required): Product group ID

**Request Body:**
```json
{
  "name": "Premium Snacks"
}
```

**Validation Rules:**
- `name` (optional): String, min 1 character, max 100 characters

**Success Response:**
- **Code:** 200 OK
- **Content:**
```json
{
  "productGroup": {
    "id": "507f1f77bcf86cd799439011",
    "name": "Premium Snacks",
    "createdAt": "2024-11-29T10:00:00.000Z",
    "updatedAt": "2024-11-29T11:00:00.000Z",
    "_count": {
      "Product": 15
    }
  }
}
```

**Error Responses:**
- **Code:** 400 Bad Request
  - **Content:** `{ "message": "Validation error details" }`
- **Code:** 404 Not Found
  - **Content:** `{ "message": "Product group not found" }`
- **Code:** 409 Conflict
  - **Content:** `{ "message": "Product group with this name already exists" }`
- **Code:** 500 Internal Server Error
  - **Content:** `{ "message": "Internal server error" }`

---

### 5. Delete Product Group
**DELETE** `/api/product-groups/:id`

Deletes a product group. Cannot delete if products are still associated with this group.

**URL Parameters:**
- `id` (required): Product group ID

**Success Response:**
- **Code:** 200 OK
- **Content:**
```json
{
  "message": "Product group deleted successfully"
}
```

**Error Responses:**
- **Code:** 400 Bad Request
  - **Content:** `{ "message": "Cannot delete product group. X product(s) are still associated with this group. Please reassign or delete these products first." }`
- **Code:** 404 Not Found
  - **Content:** `{ "message": "Product group not found" }`
- **Code:** 500 Internal Server Error
  - **Content:** `{ "message": "Internal server error" }`

---

### 6. Get Product Group Statistics
**GET** `/api/product-groups/stats`

Retrieves statistics about product groups including most used groups and empty groups.

**Success Response:**
- **Code:** 200 OK
- **Content:**
```json
{
  "stats": {
    "totalGroups": 10,
    "mostUsedGroups": [
      {
        "id": "507f1f77bcf86cd799439011",
        "name": "Snacks",
        "createdAt": "2024-11-29T10:00:00.000Z",
        "updatedAt": "2024-11-29T10:00:00.000Z",
        "_count": {
          "Product": 25
        }
      },
      {
        "id": "507f1f77bcf86cd799439012",
        "name": "Beverages",
        "createdAt": "2024-11-29T10:00:00.000Z",
        "updatedAt": "2024-11-29T10:00:00.000Z",
        "_count": {
          "Product": 18
        }
      }
    ],
    "emptyGroupsCount": 2,
    "emptyGroups": [
      {
        "id": "507f1f77bcf86cd799439013",
        "name": "Frozen Foods",
        "createdAt": "2024-11-29T10:00:00.000Z",
        "updatedAt": "2024-11-29T10:00:00.000Z",
        "_count": {
          "Product": 0
        }
      }
    ]
  }
}
```

**Error Responses:**
- **Code:** 500 Internal Server Error
  - **Content:** `{ "message": "Internal server error" }`

---

## Data Model

### ProductGroup
```typescript
{
  id: string              // MongoDB ObjectId
  name: string            // Product group name
  createdAt: DateTime     // Creation timestamp
  updatedAt: DateTime     // Last update timestamp
  Product: Product[]      // Related products
}
```

---

## Notes

- All endpoints currently have authentication commented out. Uncomment `router.use(validateAccessToken)` in the route file to enable authentication.
- Search functionality is case-insensitive and searches within the `name` field.
- Pagination is 1-indexed (first page is page 1).
- When deleting a product group, ensure no products are associated with it to avoid deletion errors.
- Product groups help organize products into logical collections for better inventory management.
- The `_count` field provides the number of products associated with each group.

---

## Common Use Cases

1. **Creating Product Families**: Group related products together (e.g., all "Organic" products, "Premium" line)
2. **Inventory Organization**: Categorize products by department or business unit
3. **Reporting**: Generate reports by product groups
4. **Bulk Operations**: Apply changes to all products in a group
5. **Product Management**: Easily find and manage related products

---

## Example Workflows

### Creating a New Product Group
1. POST to `/api/product-groups` with group name
2. Assign products to this group via product update endpoint
3. Use GET `/api/product-groups/:id` to verify products are assigned

### Deleting a Product Group
1. GET `/api/product-groups/:id` to check product count
2. If products exist, reassign them to another group or remove group association
3. DELETE `/api/product-groups/:id` once no products are associated

### Finding Product Groups with No Products
1. GET `/api/product-groups/stats`
2. Check `emptyGroups` array for groups that can be cleaned up

