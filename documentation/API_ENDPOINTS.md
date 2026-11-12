# Product Management API Endpoints

This document describes all the API endpoints for the Product Management system.

## Authentication

All endpoints (except auth endpoints) require authentication. Include the JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Base URL
```
http://localhost:3008/api
```

---

## Product Endpoints

### 1. Create Product
**POST** `/products`

**Request Body:**
```json
{
  "name": "Sample Product",
  "mrp": 1000,
  "productCode": "PROD001",
  "lowStockLimit": 10,
  "overStockLimit": 1000,
  "categoryId": "507f1f77bcf86cd799439011",
  "grammage": 500,
  "imageUrl": "https://example.com/image.jpg",
  "productGroupId": "507f1f77bcf86cd799439012",
  "tagIds": ["507f1f77bcf86cd799439015"],
  "lifeOfProduct": 24.5,
  "cartonsPerPallet": 50,
  "packetsPerCarton": 12,
  "costPricePerPacket": 80.50,
  "costPricePerCarton": 966.00,
  "gstPercentage": 18.0,
  "sellingPricePerPacketForDb": 100.75,
  "sellingPricePerPacketForDbWithGst": 118.89,
  "sellingPricePerCartonForDb": 1209.00,
  "sellingPricePerCartonForDbWithGst": 1426.62,
  "marginPercentageForDb": 25.15,
  "sellingPricePerPacketForRss": 95.25,
  "sellingPricePerPacketForRssWithGst": 112.40,
  "sellingPricePerCartonForRss": 1143.00,
  "sellingPricePerCartonForRssWithGst": 1348.74,
  "marginPercentageForRss": 18.75,
  "marginDiff": 6.4
}
```

**Note:** Only `name`, `mrp`, `productCode`, and `categoryId` are required. All other fields are optional.

**Response:**
```json
{
  "product": {
    "id": "507f1f77bcf86cd799439014",
    "name": "Sample Product",
    "mrp": 1000,
    "productCode": "PROD001",
    "lowStockLimit": 10,
    "overStockLimit": 1000,
    "categoryId": "507f1f77bcf86cd799439011",
    "grammage": 500,
    "imageUrl": "https://example.com/image.jpg",
    "productGroupId": "507f1f77bcf86cd799439012",
    "lifeOfProduct": 24.5,
    "cartonsPerPallet": 50,
    "packetsPerCarton": 12,
    "costPricePerPacket": 80.50,
    "costPricePerCarton": 966.00,
    "gstPercentage": 18.0,
    "sellingPricePerPacketForDb": 100.75,
    "sellingPricePerPacketForDbWithGst": 118.89,
    "sellingPricePerCartonForDb": 1209.00,
    "sellingPricePerCartonForDbWithGst": 1426.62,
    "marginPercentageForDb": 25.15,
    "sellingPricePerPacketForRss": 95.25,
    "sellingPricePerPacketForRssWithGst": 112.40,
    "sellingPricePerCartonForRss": 1143.00,
    "sellingPricePerCartonForRssWithGst": 1348.74,
    "marginPercentageForRss": 18.75,
    "marginDiff": 6.4,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "Category": { ... },
    "ProductGroup": { ... }
  },
  "tagRelations": [...]
}
```

### 2. Get All Products
**GET** `/products`

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `search` (optional): Search in name, productCode, or description
- `categoryId` (optional): Filter by category
- `productTagIds` (optional): Filter by product tag(s). Can be a single tag ID or comma-separated multiple tag IDs
- `minPrice` (optional): Minimum price filter
- `maxPrice` (optional): Maximum price filter

**Example:**
```
GET /products?page=1&limit=10&search=laptop&minPrice=500&maxPrice=2000&productTagIds=507f1f77bcf86cd799439015,507f1f77bcf86cd799439016
```

**Response:**
```json
{
  "products": [...],
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

### 3. Get Product by ID
**GET** `/products/:id`

**Response:**
```json
{
  "product": {
    "id": "507f1f77bcf86cd799439014",
    "name": "Sample Product",
    "mrp": 1000,
    "productCode": "PROD001",
    "lowStockLimit": 10,
    "overStockLimit": 1000,
    "categoryId": "507f1f77bcf86cd799439011",
    "grammage": 500,
    "imageUrl": "https://example.com/image.jpg",
    "productGroupId": "507f1f77bcf86cd799439012",
    "lifeOfProduct": 24.5,
    "cartonsPerPallet": 50,
    "packetsPerCarton": 12,
    "costPricePerPacket": 80.50,
    "costPricePerCarton": 966.00,
    "gstPercentage": 18.0,
    "sellingPricePerPacketForDb": 100.75,
    "sellingPricePerPacketForDbWithGst": 118.89,
    "sellingPricePerCartonForDb": 1209.00,
    "sellingPricePerCartonForDbWithGst": 1426.62,
    "marginPercentageForDb": 25.15,
    "sellingPricePerPacketForRss": 95.25,
    "sellingPricePerPacketForRssWithGst": 112.40,
    "sellingPricePerCartonForRss": 1143.00,
    "sellingPricePerCartonForRssWithGst": 1348.74,
    "marginPercentageForRss": 18.75,
    "marginDiff": 6.4,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "Category": { ... },
    "ProductGroup": { ... },
    "ProductTagRelation": [...],
    "StockBatch": [...],
    "StockRecord": [...]
  }
}
```

### 4. Update Product
**PUT** `/products/:id`

**Request Body:** (All fields optional)
```json
{
  "name": "Updated Product Name",
  "mrp": 1200,
  "lowStockLimit": 15,
  "overStockLimit": 1200,
  "grammage": 600,
  "lifeOfProduct": 36.0,
  "cartonsPerPallet": 60,
  "packetsPerCarton": 15,
  "costPricePerPacket": 85.75,
  "costPricePerCarton": 1286.25,
  "gstPercentage": 18.0,
  "sellingPricePerPacketForDb": 105.50,
  "sellingPricePerPacketForDbWithGst": 124.49,
  "sellingPricePerCartonForDb": 1266.00,
  "sellingPricePerCartonForDbWithGst": 1493.88,
  "marginPercentageForDb": 22.88,
  "sellingPricePerPacketForRss": 98.25,
  "sellingPricePerPacketForRssWithGst": 115.94,
  "sellingPricePerCartonForRss": 1179.00,
  "sellingPricePerCartonForRssWithGst": 1391.22,
  "marginPercentageForRss": 14.55,
  "marginDiff": 8.33,
  "tagIds": ["507f1f77bcf86cd799439015", "507f1f77bcf86cd799439016"]
}
```

**Note:** You can update any combination of fields. Only include the fields you want to update.

### 5. Delete Product
**DELETE** `/products/:id`

**Response:**
```json
{
  "message": "Product deleted successfully"
}
```

### 6. Get Product Statistics
**GET** `/products/stats`

**Response:**
```json
{
  "stats": {
    "totalProducts": 150,
    "lowStockProducts": 12,
    "totalValue": 150000,
    "averagePrice": 1000
  }
}
```

---

## Category Endpoints

### 1. Create Category
**POST** `/categories/categories`

**Request Body:**
```json
{
  "name": "Electronics",
  "description": "Electronic products and gadgets"
}
```

### 2. Get All Categories
**GET** `/categories/categories`

### 3. Get Category by ID
**GET** `/categories/categories/:id`

### 4. Update Category
**PUT** `/categories/categories/:id`

### 5. Delete Category
**DELETE** `/categories/categories/:id`

---

## Error Responses

### 400 Bad Request
```json
{
  "message": [
    {
      "code": "invalid_type",
      "expected": "string",
      "received": "number",
      "path": ["name"],
      "message": "Expected string, received number"
    }
  ]
}
```

### 401 Unauthorized
```json
{
  "message": "Access token is missing"
}
```

### 404 Not Found
```json
{
  "message": "Product not found"
}
```

### 409 Conflict
```json
{
  "message": "Product code already exists"
}
```

### 500 Internal Server Error
```json
{
  "message": "Internal server error"
}
```

---

## Usage Examples

### Creating a Complete Product Setup

1. **Create Category:**
```bash
curl -X POST http://localhost:3008/api/categories/categories \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Electronics", "description": "Electronic products"}'
```

2. **Create Product:**
```bash
curl -X POST http://localhost:3008/api/products \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Premium Tea Pack",
    "mrp": 500,
    "productCode": "TEA001",
    "lowStockLimit": 20,
    "overStockLimit": 500,
    "categoryId": "CATEGORY_ID",
    "grammage": 250,
    "imageUrl": "https://example.com/tea.jpg",
    "productGroupId": "PRODUCT_GROUP_ID",
    "tagIds": ["TAG_ID"],
    "lifeOfProduct": 24.0,
    "cartonsPerPallet": 100,
    "packetsPerCarton": 20,
    "costPricePerPacket": 20.50,
    "costPricePerCarton": 410.00,
    "gstPercentage": 5.0,
    "sellingPricePerPacketForDb": 25.75,
    "sellingPricePerPacketForDbWithGst": 27.04,
    "sellingPricePerCartonForDb": 515.00,
    "sellingPricePerCartonForDbWithGst": 540.75,
    "marginPercentageForDb": 25.61,
    "sellingPricePerPacketForRss": 23.50,
    "sellingPricePerPacketForRssWithGst": 24.68,
    "sellingPricePerCartonForRss": 470.00,
    "sellingPricePerCartonForRssWithGst": 493.50,
    "marginPercentageForRss": 14.63,
    "marginDiff": 10.98
  }'
```

### Searching Products
```bash
curl -X GET "http://localhost:3008/api/products?search=laptop&minPrice=50000&maxPrice=200000&productTagIds=TAG_ID1,TAG_ID2&page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```
