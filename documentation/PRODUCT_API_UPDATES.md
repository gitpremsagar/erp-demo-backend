# Product API Updates - ProductScheme Integration

This document describes the updates made to the Product API endpoints to integrate with the new ProductScheme model.

## What Changed?

The Product API has been updated to include **ProductScheme** data in all product responses. ProductScheme allows you to manage time-based discount schemes for products with start dates, end dates, and activation status.

---

## Updated Endpoints

### 1. Get All Products - `GET /api/products`

**What's New:**
- Now includes `ProductScheme` array in each product response
- Shows all schemes (active and inactive) for each product, ordered by creation date (newest first)

**Example Response:**
```json
{
  "products": [
    {
      "id": "507f1f77bcf86cd799439014",
      "name": "Sample Product",
      "productCode": "PROD001",
      "mrp": 1000,
      "schemePercentage": 10,
      // ... other product fields ...
      "ProductScheme": [
        {
          "id": "507f1f77bcf86cd799439020",
          "schemePercentage": 15.5,
          "startDate": "2024-01-01T00:00:00.000Z",
          "endDate": "2024-12-31T23:59:59.000Z",
          "isActive": true,
          "productId": "507f1f77bcf86cd799439014",
          "createdAt": "2024-01-15T10:30:00.000Z",
          "updatedAt": "2024-01-15T10:30:00.000Z"
        },
        {
          "id": "507f1f77bcf86cd799439021",
          "schemePercentage": 10.0,
          "startDate": "2023-01-01T00:00:00.000Z",
          "endDate": "2023-12-31T23:59:59.000Z",
          "isActive": false,
          "productId": "507f1f77bcf86cd799439014",
          "createdAt": "2023-01-10T10:30:00.000Z",
          "updatedAt": "2023-01-10T10:30:00.000Z"
        }
      ],
      "Category": { ... },
      "ProductGroup": { ... },
      "Plant": { ... },
      "StockBatch": [ ... ]
    }
  ],
  "pagination": { ... }
}
```

---

### 2. Get Product by ID - `GET /api/products/:id`

**What's New:**
- Now includes `ProductScheme` array in the product response
- Shows complete scheme history for the product

**Example Response:**
```json
{
  "product": {
    "id": "507f1f77bcf86cd799439014",
    "name": "Sample Product",
    "productCode": "PROD001",
    // ... all product fields ...
    "ProductScheme": [
      {
        "id": "507f1f77bcf86cd799439020",
        "schemePercentage": 15.5,
        "startDate": "2024-01-01T00:00:00.000Z",
        "endDate": "2024-12-31T23:59:59.000Z",
        "isActive": true,
        "productId": "507f1f77bcf86cd799439014",
        "createdAt": "2024-01-15T10:30:00.000Z",
        "updatedAt": "2024-01-15T10:30:00.000Z"
      }
    ],
    "Category": { ... },
    "ProductGroup": { ... },
    "Plant": { ... },
    "StockBatch": [ ... ],
    "StockRecord": [ ... ]
  }
}
```

---

### 3. Create Product - `POST /api/products`

**What's New:**
- Now includes empty `ProductScheme` array in response
- You can still use the legacy `schemePercentage` field on the product
- To create schemes with date ranges, use the `/api/product-schemes` endpoint after creating the product

**Response includes:**
```json
{
  "product": {
    "id": "507f1f77bcf86cd799439014",
    // ... product fields ...
    "ProductScheme": []
  },
  "tagRelations": [ ... ]
}
```

---

### 4. Update Product - `PUT /api/products/:id`

**What's New:**
- Response now includes `ProductScheme` array
- Updating the product's `schemePercentage` field does NOT affect ProductScheme records
- ProductScheme records are managed separately via `/api/product-schemes` endpoints

**Response includes:**
```json
{
  "product": {
    // ... updated product fields ...
    "ProductScheme": [ ... ]
  },
  "tagRelations": [ ... ]
}
```

---

### 5. Get Products for Distributor - `GET /api/products/distributor`

**What's New:**
- Now includes only **active** `ProductScheme` records
- This helps distributors see current applicable schemes

**Example Response:**
```json
{
  "products": [
    {
      "id": "507f1f77bcf86cd799439014",
      "productCode": "PROD001",
      "name": "Sample Product",
      "mrp": 1000,
      // ... pricing fields ...
      "ProductScheme": [
        {
          "id": "507f1f77bcf86cd799439020",
          "schemePercentage": 15.5,
          "startDate": "2024-01-01T00:00:00.000Z",
          "endDate": "2024-12-31T23:59:59.000Z",
          "isActive": true,
          "productId": "507f1f77bcf86cd799439014",
          "createdAt": "2024-01-15T10:30:00.000Z",
          "updatedAt": "2024-01-15T10:30:00.000Z"
        }
      ],
      "Category": { ... },
      "ForecastItem": [ ... ]
    }
  ],
  "pagination": { ... }
}
```

---

## New Endpoint

### 6. Get Current Active Scheme - `GET /api/products/:id/active-scheme` ⭐ NEW

**Description:**
Get the currently active scheme for a specific product based on:
- `isActive` is `true`
- Current date is between `startDate` and `endDate`

**URL Parameters:**
- `id`: Product ID (MongoDB ObjectId)

**Example Request:**
```
GET /api/products/507f1f77bcf86cd799439014/active-scheme
```

**Success Response:** `200 OK`
```json
{
  "product": {
    "id": "507f1f77bcf86cd799439014",
    "name": "Sample Product",
    "productCode": "PROD001"
  },
  "activeScheme": {
    "id": "507f1f77bcf86cd799439020",
    "schemePercentage": 15.5,
    "startDate": "2024-01-01T00:00:00.000Z",
    "endDate": "2024-12-31T23:59:59.000Z",
    "isActive": true,
    "productId": "507f1f77bcf86cd799439014",
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
    "id": "507f1f77bcf86cd799439014",
    "name": "Sample Product",
    "productCode": "PROD001"
  },
  "activeScheme": null,
  "effectiveSchemePercentage": 0
}
```

**Error Responses:**
- `404 Not Found`: Product not found
- `500 Internal Server Error`: Server error

---

## Migration Notes

### For Existing Code:

1. **Product `schemePercentage` field is still supported** for backward compatibility
2. **ProductScheme provides more flexibility** with date-based schemes
3. **You can use both**: The product-level `schemePercentage` and ProductScheme records coexist

### Best Practices:

1. **For simple schemes**: Use the product's `schemePercentage` field
2. **For time-based schemes**: Use the ProductScheme model via `/api/product-schemes`
3. **For current discounts**: Use the new `/api/products/:id/active-scheme` endpoint
4. **When displaying products**: Check both `schemePercentage` and active ProductScheme to determine the effective discount

### Recommended Flow:

```javascript
// 1. Get product with schemes
const response = await fetch('/api/products/PRODUCT_ID');
const { product } = await response.json();

// 2. Get current active scheme
const schemeResponse = await fetch('/api/products/PRODUCT_ID/active-scheme');
const { activeScheme, effectiveSchemePercentage } = await schemeResponse.json();

// 3. Determine which scheme to use
const finalSchemePercentage = effectiveSchemePercentage || product.schemePercentage || 0;

// 4. Calculate discounted price
const discountedPrice = product.mrp * (1 - finalSchemePercentage / 100);
```

---

## Related Endpoints

For managing ProductScheme records, see:
- **PRODUCT_SCHEME_API_ENDPOINTS.md** - Complete ProductScheme API documentation

Key ProductScheme endpoints:
- `POST /api/product-schemes` - Create a new scheme
- `GET /api/product-schemes?productId=PRODUCT_ID` - Get all schemes for a product
- `GET /api/product-schemes/product/PRODUCT_ID/active` - Get active schemes for a product
- `PUT /api/product-schemes/:id` - Update a scheme
- `PATCH /api/product-schemes/:id/toggle-status` - Activate/deactivate a scheme
- `DELETE /api/product-schemes/:id` - Delete a scheme

---

## Summary of Changes

| Endpoint | Change | Impact |
|----------|--------|--------|
| `GET /api/products` | Added `ProductScheme` array | ✅ Backward compatible - new field added |
| `GET /api/products/:id` | Added `ProductScheme` array | ✅ Backward compatible - new field added |
| `POST /api/products` | Response includes `ProductScheme` | ✅ Backward compatible - new field added |
| `PUT /api/products/:id` | Response includes `ProductScheme` | ✅ Backward compatible - new field added |
| `GET /api/products/distributor` | Added active `ProductScheme` only | ✅ Backward compatible - new field added |
| `GET /api/products/:id/active-scheme` | ⭐ NEW ENDPOINT | ✅ New feature - no breaking changes |

**All changes are backward compatible!** Existing code will continue to work without modifications.

