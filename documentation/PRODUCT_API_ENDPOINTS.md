# Product API Endpoints

Complete documentation for all Product API endpoints. This document provides detailed information about request/response formats, validation requirements, and usage examples.

---

## Table of Contents

1. [Create Product](#1-create-product)
2. [Get All Products](#2-get-all-products)
3. [Get Products for Distributor](#3-get-products-for-distributor)
4. [Get Distributor Order Products](#4-get-distributor-order-products)
5. [Get Product by ID](#5-get-product-by-id)
6. [Get Current Active Scheme](#6-get-current-active-scheme)
7. [Update Product](#7-update-product)
8. [Delete Product](#8-delete-product)
9. [Get Product Statistics](#9-get-product-statistics)
10. [Data Models](#data-models)
11. [Error Handling](#error-handling)

---

## 1. Create Product

**POST** `/api/products`

Creates a new product with all associated information including pricing, packaging, and tags.

### Request Body

```json
{
  "name": "string (1-200 chars, required)",
  "mrp": "number (positive integer, required)",
  "productCode": "string (1-50 chars, required, unique)",
  "lowStockLimit": "number (integer, >= 0, optional, default: 0)",
  "overStockLimit": "number (integer, >= 0, optional, default: 0)",
  "categoryId": "string (24 chars MongoDB ObjectId, required)",
  "grammage": "number (positive integer, optional)",
  "imageUrl": "string (valid URL, optional)",
  "productGroupId": "string (24 chars MongoDB ObjectId, optional)",
  "tagIds": ["string (24 chars MongoDB ObjectId)", "..."] (optional),
  
  // Product Lifecycle
  "lifeOfProduct": "number (positive, optional)",
  
  // Packaging Information
  "cartonsPerPallet": "number (positive integer, optional)",
  "packetsPerCarton": "number (positive integer, optional)",
  "schemePercentage": "number (0-100, optional)",
  "plantId": "string (24 chars MongoDB ObjectId, optional)",
  
  // Cost Pricing
  "costPricePerPacket": "number (positive, optional)",
  "costPricePerPacketWithGst": "number (positive, optional)",
  "costPricePerCarton": "number (positive, optional)",
  "costPricePerCartonWithGst": "number (positive, optional)",
  "gstPercentage": "number (0-100, optional)",
  
  // Selling Price for Distributors (DB)
  "sellingPricePerPacketForDb": "number (positive, optional)",
  "sellingPricePerPacketForDbWithGst": "number (positive, optional)",
  "sellingPricePerCartonForDb": "number (positive, optional)",
  "sellingPricePerCartonForDbWithGst": "number (positive, optional)",
  "marginPercentageForDb": "number (optional)",
  
  // Selling Price for Distributors (RSS)
  "sellingPricePerPacketForRss": "number (positive, optional)",
  "sellingPricePerPacketForRssWithGst": "number (positive, optional)",
  "sellingPricePerCartonForRss": "number (positive, optional)",
  "sellingPricePerCartonForRssWithGst": "number (positive, optional)",
  "marginPercentageForRss": "number (optional)"
}
```

### Example Request

```json
{
  "name": "Premium Rice 1kg",
  "mrp": 150,
  "productCode": "RICE-001",
  "lowStockLimit": 100,
  "overStockLimit": 1000,
  "categoryId": "507f1f77bcf86cd799439011",
  "grammage": 1000,
  "productGroupId": "507f1f77bcf86cd799439012",
  "tagIds": ["507f1f77bcf86cd799439013", "507f1f77bcf86cd799439014"],
  "lifeOfProduct": 365,
  "cartonsPerPallet": 50,
  "packetsPerCarton": 12,
  "schemePercentage": 5,
  "plantId": "507f1f77bcf86cd799439015",
  "gstPercentage": 5,
  "costPricePerPacket": 100,
  "costPricePerPacketWithGst": 105,
  "sellingPricePerPacketForDb": 120,
  "sellingPricePerPacketForDbWithGst": 126,
  "marginPercentageForDb": 20,
  "sellingPricePerPacketForRss": 115,
  "sellingPricePerPacketForRssWithGst": 120.75,
  "marginPercentageForRss": 15
}
```

### Success Response: `201 Created`

```json
{
  "product": {
    "id": "507f1f77bcf86cd799439016",
    "name": "Premium Rice 1kg",
    "mrp": 150,
    "productCode": "RICE-001",
    "lowStockLimit": 100,
    "overStockLimit": 1000,
    "categoryId": "507f1f77bcf86cd799439011",
    "grammage": 1000,
    "productGroupId": "507f1f77bcf86cd799439012",
    "plantId": "507f1f77bcf86cd799439015",
    "lifeOfProduct": 365,
    "cartonsPerPallet": 50,
    "packetsPerCarton": 12,
    "schemePercentage": 5,
    "gstPercentage": 5,
    "costPricePerPacket": 100,
    "costPricePerPacketWithGst": 105,
    "costPricePerCarton": null,
    "costPricePerCartonWithGst": null,
    "sellingPricePerPacketForDb": 120,
    "sellingPricePerPacketForDbWithGst": 126,
    "sellingPricePerCartonForDb": null,
    "sellingPricePerCartonForDbWithGst": null,
    "marginPercentageForDb": 20,
    "sellingPricePerPacketForRss": 115,
    "sellingPricePerPacketForRssWithGst": 120.75,
    "sellingPricePerCartonForRss": null,
    "sellingPricePerCartonForRssWithGst": null,
    "marginPercentageForRss": 15,
    "marginDiff": 5,
    "imageUrl": null,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z",
    "Category": {
      "id": "507f1f77bcf86cd799439011",
      "name": "Grains"
    },
    "ProductGroup": {
      "id": "507f1f77bcf86cd799439012",
      "name": "Rice Products"
    },
    "Plant": {
      "id": "507f1f77bcf86cd799439015",
      "name": "Plant A"
    },
    "ProductScheme": []
  },
  "tagRelations": [
    {
      "id": "507f1f77bcf86cd799439017",
      "productId": "507f1f77bcf86cd799439016",
      "productTagId": "507f1f77bcf86cd799439013"
    },
    {
      "id": "507f1f77bcf86cd799439018",
      "productId": "507f1f77bcf86cd799439016",
      "productTagId": "507f1f77bcf86cd799439014"
    }
  ]
}
```

### Error Responses

- `400 Bad Request`: Validation error (check request body format)
- `404 Not Found`: Category, ProductGroup, or Plant not found
- `409 Conflict`: Product code already exists
- `500 Internal Server Error`: Server error

### Features

- Validates product code uniqueness
- Validates category existence
- Validates product group existence (if provided)
- Validates plant existence (if provided)
- Validates all tag IDs exist before creating relations
- Automatically calculates `marginDiff` (marginPercentageForDb - marginPercentageForRss)
- Creates product and tag relations in a transaction

---

## 2. Get All Products

**GET** `/api/products`

Retrieves all products with pagination, filtering, and search capabilities.

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | number | No | 1 | Page number for pagination |
| `limit` | number | No | 10 | Number of items per page |
| `search` | string | No | - | Search by product name or product code (case-insensitive) |
| `categoryId` | string | No | - | Filter by category ID |
| `minPrice` | number | No | - | Minimum MRP filter |
| `maxPrice` | number | No | - | Maximum MRP filter |
| `productTagIds` | string/array | No | - | Filter by product tag IDs (comma-separated or array) |

### Example Requests

```
GET /api/products
GET /api/products?page=1&limit=20
GET /api/products?search=rice&categoryId=507f1f77bcf86cd799439011
GET /api/products?minPrice=100&maxPrice=500
GET /api/products?productTagIds=507f1f77bcf86cd799439013,507f1f77bcf86cd799439014
```

### Success Response: `200 OK`

```json
{
  "products": [
    {
      "id": "507f1f77bcf86cd799439016",
      "name": "Premium Rice 1kg",
      "mrp": 150,
      "productCode": "RICE-001",
      "lowStockLimit": 100,
      "overStockLimit": 1000,
      "categoryId": "507f1f77bcf86cd799439011",
      "grammage": 1000,
      "productGroupId": "507f1f77bcf86cd799439012",
      "plantId": "507f1f77bcf86cd799439015",
      "lifeOfProduct": 365,
      "cartonsPerPallet": 50,
      "packetsPerCarton": 12,
      "schemePercentage": 5,
      "gstPercentage": 5,
      "costPricePerPacket": 100,
      "costPricePerPacketWithGst": 105,
      "sellingPricePerPacketForDb": 120,
      "sellingPricePerPacketForDbWithGst": 126,
      "marginPercentageForDb": 20,
      "sellingPricePerPacketForRss": 115,
      "sellingPricePerPacketForRssWithGst": 120.75,
      "marginPercentageForRss": 15,
      "marginDiff": 5,
      "imageUrl": null,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z",
      "Category": {
        "id": "507f1f77bcf86cd799439011",
        "name": "Grains"
      },
      "ProductGroup": {
        "id": "507f1f77bcf86cd799439012",
        "name": "Rice Products"
      },
      "Plant": {
        "id": "507f1f77bcf86cd799439015",
        "name": "Plant A"
      },
      "ProductTagRelation": [
        {
          "id": "507f1f77bcf86cd799439017",
          "productId": "507f1f77bcf86cd799439016",
          "productTagId": "507f1f77bcf86cd799439013",
          "ProductTag": {
            "id": "507f1f77bcf86cd799439013",
            "name": "Premium"
          }
        }
      ],
      "StockBatch": [
        {
          "id": "507f1f77bcf86cd799439019",
          "manufacturingDate": "2024-01-01T00:00:00.000Z",
          "arrivalDate": "2024-01-05T00:00:00.000Z",
          "expiryDate": "2025-01-01T00:00:00.000Z",
          "stockQuantity": 500
        }
      ],
      "ProductScheme": [
        {
          "id": "507f1f77bcf86cd799439020",
          "schemePercentage": 10,
          "startDate": "2024-01-01T00:00:00.000Z",
          "endDate": "2024-12-31T23:59:59.000Z",
          "isActive": true,
          "productId": "507f1f77bcf86cd799439016"
        }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### Error Responses

- `400 Bad Request`: Invalid query parameters
- `500 Internal Server Error`: Server error

### Features

- Pagination support
- Case-insensitive search by name or product code
- Filter by category
- Filter by price range (min/max MRP)
- Filter by product tags (supports multiple tags)
- Includes related data: Category, ProductGroup, Plant, Tags, StockBatches, ProductSchemes
- Products ordered by creation date (newest first)

---

## 3. Get Products for Distributor

**GET** `/api/products/distributor`

Retrieves products specifically formatted for distributors. Only shows products with available stock and includes forecast items.

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | number | No | 1 | Page number for pagination |
| `limit` | number | No | 10 | Number of items per page (default: 10, max recommended: 1000) |
| `search` | string | No | - | Search by product name or product code (case-insensitive) |
| `categoryId` | string | No | - | Filter by category ID |
| `distributorId` | string | No | - | Filter forecast items by distributor ID |

### Example Requests

```
GET /api/products/distributor
GET /api/products/distributor?distributorId=507f1f77bcf86cd799439021&page=1&limit=50
GET /api/products/distributor?search=rice&categoryId=507f1f77bcf86cd799439011
```

### Success Response: `200 OK`

```json
{
  "products": [
    {
      "id": "507f1f77bcf86cd799439016",
      "productCode": "RICE-001",
      "name": "Premium Rice 1kg",
      "mrp": 150,
      "grammage": 1000,
      "lifeOfProduct": 365,
      "packetsPerCarton": 12,
      "schemePercentage": 5,
      "gstPercentage": 5,
      "sellingPricePerPacketForDb": 120,
      "sellingPricePerPacketForDbWithGst": 126,
      "sellingPricePerCartonForDb": 1440,
      "sellingPricePerCartonForDbWithGst": 1512,
      "sellingPricePerPacketForRss": 115,
      "sellingPricePerPacketForRssWithGst": 120.75,
      "sellingPricePerCartonForRss": 1380,
      "sellingPricePerCartonForRssWithGst": 1449,
      "Category": {
        "id": "507f1f77bcf86cd799439011",
        "name": "Grains"
      },
      "ForecastItem": [
        {
          "id": "507f1f77bcf86cd799439022",
          "distributorId": "507f1f77bcf86cd799439021",
          "forecastId": "507f1f77bcf86cd799439023",
          "forecastDate": "2024-02-01T00:00:00.000Z",
          "quantity": 100,
          "createdAt": "2024-01-20T10:30:00.000Z"
        }
      ],
      "ProductScheme": [
        {
          "id": "507f1f77bcf86cd799439020",
          "schemePercentage": 10,
          "startDate": "2024-01-01T00:00:00.000Z",
          "endDate": "2024-12-31T23:59:59.000Z",
          "isActive": true,
          "productId": "507f1f77bcf86cd799439016"
        }
      ]
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

### Error Responses

- `400 Bad Request`: Invalid query parameters
- `500 Internal Server Error`: Server error

### Features

- Only returns products with available stock (stockQuantity > 0)
- Includes only active ProductSchemes
- Includes ForecastItem data for the specified distributor
- Optimized response with essential fields only
- Pagination support

---

## 4. Get Distributor Order Products

**GET** `/api/products/distributor-order`

Retrieves products for distributor orders with forecast items and order history included. Similar to regular products endpoint but includes forecast data and recent order history.

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | number | No | 1 | Page number for pagination |
| `limit` | number | No | 10 | Number of items per page |
| `search` | string | No | - | Search by product name or product code (case-insensitive) |
| `categoryId` | string | No | - | Filter by category ID |
| `minPrice` | number | No | - | Minimum MRP filter |
| `maxPrice` | number | No | - | Maximum MRP filter |
| `productTagIds` | string/array | No | - | Filter by product tag IDs |
| `distributorId` | string | No | - | Filter forecast items and order history by distributor ID (required for forecast and order data) |

### Example Requests

```
GET /api/products/distributor-order?distributorId=507f1f77bcf86cd799439021
GET /api/products/distributor-order?distributorId=507f1f77bcf86cd799439021&search=rice&page=1&limit=20
```

### Success Response: `200 OK`

```json
{
  "products": [
    {
      "id": "507f1f77bcf86cd799439016",
      "name": "Premium Rice 1kg",
      "mrp": 150,
      "productCode": "RICE-001",
      "Category": {
        "id": "507f1f77bcf86cd799439011",
        "name": "Grains"
      },
      "ProductGroup": {
        "id": "507f1f77bcf86cd799439012",
        "name": "Rice Products"
      },
      "Plant": {
        "id": "507f1f77bcf86cd799439015",
        "name": "Plant A"
      },
      "ProductTagRelation": [...],
      "StockBatch": [...],
      "ProductScheme": [...],
      "ForecastItem": [
        {
          "id": "507f1f77bcf86cd799439022",
          "distributorId": "507f1f77bcf86cd799439021",
          "forecastId": "507f1f77bcf86cd799439023",
          "forecastDate": "2024-02-01T00:00:00.000Z",
          "quantity": 100
        }
      ],
      "OrderItem": [
        {
          "id": "507f1f77bcf86cd799439025",
          "quantity": 50,
          "orderDate": "2024-01-15T10:30:00.000Z"
        }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### Error Responses

- `400 Bad Request`: Invalid query parameters
- `500 Internal Server Error`: Server error

### Features

- Includes all product details like regular products endpoint
- Includes ForecastItem data (last 3 forecast items ordered by date descending)
- Includes OrderItem data (order history from last 3 months for the specified distributor, ordered by order date descending)
- Requires `distributorId` query parameter for forecast and order history data
- All filtering options from regular products endpoint

---

## 5. Get Product by ID

**GET** `/api/products/:id`

Retrieves a single product by its ID with all related information.

### URL Parameters

- `id`: Product ID (MongoDB ObjectId, 24 characters)

### Example Request

```
GET /api/products/507f1f77bcf86cd799439016
```

### Success Response: `200 OK`

```json
{
  "product": {
    "id": "507f1f77bcf86cd799439016",
    "name": "Premium Rice 1kg",
    "mrp": 150,
    "productCode": "RICE-001",
    "lowStockLimit": 100,
    "overStockLimit": 1000,
    "categoryId": "507f1f77bcf86cd799439011",
    "grammage": 1000,
    "productGroupId": "507f1f77bcf86cd799439012",
    "plantId": "507f1f77bcf86cd799439015",
    "lifeOfProduct": 365,
    "cartonsPerPallet": 50,
    "packetsPerCarton": 12,
    "schemePercentage": 5,
    "gstPercentage": 5,
    "costPricePerPacket": 100,
    "costPricePerPacketWithGst": 105,
    "sellingPricePerPacketForDb": 120,
    "sellingPricePerPacketForDbWithGst": 126,
    "marginPercentageForDb": 20,
    "sellingPricePerPacketForRss": 115,
    "sellingPricePerPacketForRssWithGst": 120.75,
    "marginPercentageForRss": 15,
    "marginDiff": 5,
    "imageUrl": null,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z",
    "Category": {
      "id": "507f1f77bcf86cd799439011",
      "name": "Grains",
      "description": "Grain products"
    },
    "ProductGroup": {
      "id": "507f1f77bcf86cd799439012",
      "name": "Rice Products"
    },
    "Plant": {
      "id": "507f1f77bcf86cd799439015",
      "name": "Plant A",
      "address": "123 Main St"
    },
    "ProductTagRelation": [
      {
        "id": "507f1f77bcf86cd799439017",
        "productId": "507f1f77bcf86cd799439016",
        "productTagId": "507f1f77bcf86cd799439013",
        "ProductTag": {
          "id": "507f1f77bcf86cd799439013",
          "name": "Premium"
        }
      }
    ],
    "StockBatch": [
      {
        "id": "507f1f77bcf86cd799439019",
        "manufacturingDate": "2024-01-01T00:00:00.000Z",
        "arrivalDate": "2024-01-05T00:00:00.000Z",
        "expiryDate": "2025-01-01T00:00:00.000Z",
        "stockQuantity": 500,
        "productId": "507f1f77bcf86cd799439016"
      }
    ],
    "StockRecord": [
      {
        "id": "507f1f77bcf86cd799439024",
        "type": "IN",
        "quantity": 100,
        "createdAt": "2024-01-10T10:30:00.000Z"
      }
    ],
    "ProductScheme": [
      {
        "id": "507f1f77bcf86cd799439020",
        "schemePercentage": 10,
        "startDate": "2024-01-01T00:00:00.000Z",
        "endDate": "2024-12-31T23:59:59.000Z",
        "isActive": true,
        "productId": "507f1f77bcf86cd799439016",
        "createdAt": "2024-01-15T10:30:00.000Z",
        "updatedAt": "2024-01-15T10:30:00.000Z"
      }
    ]
  }
}
```

### Error Responses

- `404 Not Found`: Product not found
- `500 Internal Server Error`: Server error

### Features

- Returns complete product information
- Includes all related data: Category, ProductGroup, Plant, Tags, StockBatches, StockRecords, ProductSchemes
- StockRecords ordered by creation date (newest first)
- ProductSchemes ordered by creation date (newest first)

---

## 6. Get Current Active Scheme

**GET** `/api/products/:id/active-scheme`

Retrieves the currently active scheme for a specific product based on current date and active status.

### URL Parameters

- `id`: Product ID (MongoDB ObjectId, 24 characters)

### Example Request

```
GET /api/products/507f1f77bcf86cd799439016/active-scheme
```

### Success Response: `200 OK`

**When Active Scheme Exists:**

```json
{
  "product": {
    "id": "507f1f77bcf86cd799439016",
    "name": "Premium Rice 1kg",
    "productCode": "RICE-001"
  },
  "activeScheme": {
    "id": "507f1f77bcf86cd799439020",
    "schemePercentage": 15.5,
    "startDate": "2024-01-01T00:00:00.000Z",
    "endDate": "2024-12-31T23:59:59.000Z",
    "isActive": true,
    "productId": "507f1f77bcf86cd799439016",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  },
  "effectiveSchemePercentage": 15.5
}
```

**When No Active Scheme:**

```json
{
  "product": {
    "id": "507f1f77bcf86cd799439016",
    "name": "Premium Rice 1kg",
    "productCode": "RICE-001"
  },
  "activeScheme": null,
  "effectiveSchemePercentage": 0
}
```

### Error Responses

- `404 Not Found`: Product not found
- `500 Internal Server Error`: Server error

### Features

- Finds scheme where:
  - `isActive` is `true`
  - Current date is between `startDate` and `endDate`
- Returns `effectiveSchemePercentage` for easy calculation
- Returns `null` for `activeScheme` if no active scheme exists

---

## 7. Update Product

**PUT** `/api/products/:id`

Updates an existing product. All fields are optional - only provided fields will be updated.

### URL Parameters

- `id`: Product ID (MongoDB ObjectId, 24 characters)

### Request Body

All fields from Create Product are optional. Only include fields you want to update.

```json
{
  "name": "string (1-200 chars, optional)",
  "mrp": "number (positive integer, optional)",
  "productCode": "string (1-50 chars, optional, must be unique if changed)",
  "lowStockLimit": "number (integer, >= 0, optional)",
  "overStockLimit": "number (integer, >= 0, optional)",
  "categoryId": "string (24 chars MongoDB ObjectId, optional)",
  "grammage": "number (positive integer, optional)",
  "imageUrl": "string (valid URL, optional)",
  "productGroupId": "string (24 chars MongoDB ObjectId, optional)",
  "tagIds": ["string (24 chars MongoDB ObjectId)", "..."] (optional),
  "lifeOfProduct": "number (positive, optional)",
  "cartonsPerPallet": "number (positive integer, optional)",
  "packetsPerCarton": "number (positive integer, optional)",
  "schemePercentage": "number (0-100, optional)",
  "plantId": "string (24 chars MongoDB ObjectId, optional)",
  "costPricePerPacket": "number (positive, optional)",
  "costPricePerPacketWithGst": "number (positive, optional)",
  "costPricePerCarton": "number (positive, optional)",
  "costPricePerCartonWithGst": "number (positive, optional)",
  "gstPercentage": "number (0-100, optional)",
  "sellingPricePerPacketForDb": "number (positive, optional)",
  "sellingPricePerPacketForDbWithGst": "number (positive, optional)",
  "sellingPricePerCartonForDb": "number (positive, optional)",
  "sellingPricePerCartonForDbWithGst": "number (positive, optional)",
  "marginPercentageForDb": "number (optional)",
  "sellingPricePerPacketForRss": "number (positive, optional)",
  "sellingPricePerPacketForRssWithGst": "number (positive, optional)",
  "sellingPricePerCartonForRss": "number (positive, optional)",
  "sellingPricePerCartonForRssWithGst": "number (positive, optional)",
  "marginPercentageForRss": "number (optional)",
  "marginDiff": "number (optional, calculated as marginPercentageForDb - marginPercentageForRss)"
}
```

### Example Request

```json
{
  "mrp": 160,
  "schemePercentage": 7,
  "tagIds": ["507f1f77bcf86cd799439013"]
}
```

### Success Response: `200 OK`

```json
{
  "product": {
    "id": "507f1f77bcf86cd799439016",
    "name": "Premium Rice 1kg",
    "mrp": 160,
    "productCode": "RICE-001",
    "schemePercentage": 7,
    "updatedAt": "2024-01-20T10:30:00.000Z",
    "Category": {...},
    "ProductGroup": {...},
    "Plant": {...},
    "ProductTagRelation": [...],
    "ProductScheme": [...]
  },
  "tagRelations": [
    {
      "id": "507f1f77bcf86cd799439017",
      "productId": "507f1f77bcf86cd799439016",
      "productTagId": "507f1f77bcf86cd799439013"
    }
  ]
}
```

### Error Responses

- `400 Bad Request`: Validation error or invalid scheme percentage (must be 0-100)
- `404 Not Found`: Product, Category, ProductGroup, or Plant not found
- `409 Conflict`: Product code already exists (if updating productCode)
- `500 Internal Server Error`: Server error

### Features

- Partial updates supported (only update fields you provide)
- Validates product code uniqueness if changed
- Validates category, product group, and plant existence if updated
- Validates scheme percentage is between 0 and 100
- Handles tag updates: removes existing tags and creates new ones
- Returns updated product with all relations

---

## 8. Delete Product

**DELETE** `/api/products/:id`

Deletes a product and all its tag relations. Cannot delete products that are associated with orders.

### URL Parameters

- `id`: Product ID (MongoDB ObjectId, 24 characters)

### Example Request

```
DELETE /api/products/507f1f77bcf86cd799439016
```

### Success Response: `200 OK`

```json
{
  "message": "Product deleted successfully"
}
```

### Error Responses

- `400 Bad Request`: Product is associated with existing orders (cannot delete)
- `404 Not Found`: Product not found
- `500 Internal Server Error`: Server error

### Features

- Prevents deletion if product has associated order items
- Automatically deletes all ProductTagRelation records
- Ensures data integrity by checking order associations

---

## 9. Get Product Statistics

**GET** `/api/products/stats`

Retrieves aggregate statistics about products.

### Example Request

```
GET /api/products/stats
```

### Success Response: `200 OK`

```json
{
  "stats": {
    "totalProducts": 150,
    "lowStockProducts": 25,
    "totalValue": 150000,
    "averagePrice": 1000
  }
}
```

### Response Fields

- `totalProducts`: Total number of products in the system
- `lowStockProducts`: Number of products with `lowStockLimit > 0`
- `totalValue`: Sum of all product MRPs
- `averagePrice`: Average MRP (rounded to nearest integer)

### Error Responses

- `500 Internal Server Error`: Server error

---

## Data Models

### Product Model

```typescript
{
  id: string;                              // MongoDB ObjectId
  name: string;                             // Product name (1-200 chars)
  mrp: number;                              // Maximum Retail Price (positive integer)
  productCode: string;                      // Unique product code (1-50 chars)
  lowStockLimit: number;                    // Low stock threshold (default: 0)
  overStockLimit: number;                   // Over stock threshold (default: 0)
  categoryId: string;                       // Reference to Category (MongoDB ObjectId)
  grammage: number;                         // Product weight in grams (optional)
  productGroupId: string;                   // Reference to ProductGroup (optional)
  plantId: string;                          // Reference to Plant (optional)
  lifeOfProduct: number;                    // Product shelf life in days (optional)
  imageUrl: string;                         // Product image URL (optional)
  cartonsPerPallet: number;                 // Packaging info (optional)
  packetsPerCarton: number;                 // Packaging info (optional)
  schemePercentage: number;                 // Default scheme percentage (0-100, optional)
  
  // Cost Pricing
  gstPercentage: number;                    // GST percentage (0-100, optional)
  costPricePerPacket: number;               // Cost price per packet (optional)
  costPricePerPacketWithGst: number;        // Cost price per packet with GST (optional)
  costPricePerCarton: number;               // Cost price per carton (optional)
  costPricePerCartonWithGst: number;       // Cost price per carton with GST (optional)
  
  // Selling Price for Distributors (DB)
  sellingPricePerPacketForDb: number;       // Selling price per packet for DB (optional)
  sellingPricePerPacketForDbWithGst: number; // Selling price per packet for DB with GST (optional)
  sellingPricePerCartonForDb: number;      // Selling price per carton for DB (optional)
  sellingPricePerCartonForDbWithGst: number; // Selling price per carton for DB with GST (optional)
  marginPercentageForDb: number;           // Margin percentage for DB (optional)
  
  // Selling Price for Distributors (RSS)
  sellingPricePerPacketForRss: number;     // Selling price per packet for RSS (optional)
  sellingPricePerPacketForRssWithGst: number; // Selling price per packet for RSS with GST (optional)
  sellingPricePerCartonForRss: number;     // Selling price per carton for RSS (optional)
  sellingPricePerCartonForRssWithGst: number; // Selling price per carton for RSS with GST (optional)
  marginPercentageForRss: number;         // Margin percentage for RSS (optional)
  
  marginDiff: number;                       // Calculated: marginPercentageForDb - marginPercentageForRss
  
  createdAt: Date;                         // Creation timestamp
  updatedAt: Date;                          // Last update timestamp
  
  // Relations
  Category: Category;                      // Category details
  ProductGroup: ProductGroup;              // Product group details
  Plant: Plant;                            // Plant details
  ProductTagRelation: ProductTagRelation[]; // Product tags
  StockBatch: StockBatch[];                // Stock batches
  StockRecord: StockRecord[];              // Stock records
  ProductScheme: ProductScheme[];          // Product schemes
}
```

---

## Error Handling

All endpoints return appropriate HTTP status codes:

- `200 OK`: Successful request
- `201 Created`: Resource created successfully
- `400 Bad Request`: Validation error or invalid input
- `404 Not Found`: Resource not found
- `409 Conflict`: Duplicate data (e.g., product code already exists)
- `500 Internal Server Error`: Server error

### Common Error Response Format

```json
{
  "message": "Error description"
}
```

### Validation Errors

When validation fails, the response includes detailed error information:

```json
{
  "message": {
    "issues": [
      {
        "code": "invalid_type",
        "expected": "string",
        "received": "number",
        "path": ["name"],
        "message": "Expected string, received number"
      }
    ]
  }
}
```

---

## Authentication

Currently, authentication middleware is commented out in the route file. To enable authentication:

1. Uncomment `router.use(validateAccessToken);` in `src/route/product.route.ts`
2. Ensure valid JWT tokens are provided in the `Authorization` header:
   ```
   Authorization: Bearer <your-jwt-token>
   ```

---

## Related Documentation

- **PRODUCT_API_UPDATES.md** - ProductScheme integration details
- **PRODUCT_SCHEME_API_ENDPOINTS.md** - ProductScheme API documentation
- **PRODUCT_GROUP_API_ENDPOINTS.md** - ProductGroup API documentation
- **PRODUCT_TAG_API_ENDPOINTS.md** - ProductTag API documentation
- **STOCK_BATCH_API_ENDPOINTS.md** - StockBatch API documentation
- **STOCK_RECORD_API_ENDPOINTS.md** - StockRecord API documentation

---

## Notes for Developers

### Product Code Uniqueness

- Product codes must be unique across all products
- The system validates uniqueness on create and update
- Returns `409 Conflict` if duplicate product code is detected

### Tag Management

- Tags are managed through `tagIds` array
- On create: All provided tag IDs are validated before creation
- On update: Existing tags are removed and replaced with new ones
- Tag relations are created/deleted in transactions for data consistency

### Stock Filtering

- The `/api/products/distributor` endpoint only returns products with available stock
- Stock availability is determined by `StockBatch.stockQuantity > 0`

### Scheme Management

- Products have a default `schemePercentage` field
- Time-based schemes are managed through `ProductScheme` model
- Use `/api/products/:id/active-scheme` to get the currently active scheme
- See **PRODUCT_API_UPDATES.md** for detailed scheme integration information

### Margin Calculation

- `marginDiff` is automatically calculated as `marginPercentageForDb - marginPercentageForRss`
- This field is set during product creation

### Transaction Safety

- Product creation with tags uses database transactions
- Tag updates use transactions to ensure consistency
- All related entity validations occur before database operations

