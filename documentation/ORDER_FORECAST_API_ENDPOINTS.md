# Order Forecast API Endpoints

## Forecast Endpoints

### 1. Get Forecasts by Distributor ID

- **GET** `/api/order-forecasts/distributor/:distributorId`
- **Description**: Retrieve forecasts for a specific distributor with pagination and date filtering. Returns only forecast ID and forecast date for each forecast.
- **Path Parameters**:
  - `distributorId` (required): The ID of the distributor (MongoDB ObjectId)
- **Query Parameters**:
  - `page` (optional): Page number for pagination (default: 1)
  - `limit` (optional): Number of items per page (default: 1000)
  - `startDate` (optional): Start date for filtering forecasts (ISO string). Defaults to the first day of the current month if not provided.
  - `endDate` (optional): End date for filtering forecasts (ISO string). Defaults to the last day of the current month if not provided.

- **Response**: 200 OK
```json
{
  "forecasts": [
    {
      "id": "string (MongoDB ObjectId)",
      "forecastDate": "ISO date string"
    }
  ],
  "distributor": {
    "id": "string (MongoDB ObjectId)",
    "name": "string",
    "email": "string"
  },
  "pagination": {
    "currentPage": "number",
    "totalPages": "number",
    "totalItems": "number",
    "itemsPerPage": "number"
  }
}
```

- **Features**: 
  - Validates distributor existence
  - Returns only forecast ID and forecast date (minimal data for performance)
  - Pagination support
  - Date range filtering with sensible defaults (current month)
  - Results ordered by forecast date (descending - newest first)
  - Includes distributor basic information in response

- **Example Request**:
```
GET /api/order-forecasts/distributor/507f1f77bcf86cd799439011?page=1&limit=10&startDate=2024-01-01T00:00:00.000Z&endDate=2024-01-31T23:59:59.999Z
```

- **Example Response**:
```json
{
  "forecasts": [
    {
      "id": "507f1f77bcf86cd799439012",
      "forecastDate": "2024-01-15T00:00:00.000Z"
    },
    {
      "id": "507f1f77bcf86cd799439013",
      "forecastDate": "2024-01-10T00:00:00.000Z"
    }
  ],
  "distributor": {
    "id": "507f1f77bcf86cd799439011",
    "name": "ABC Distributors",
    "email": "abc@distributor.com"
  },
  "pagination": {
    "currentPage": 1,
    "totalPages": 1,
    "totalItems": 2,
    "itemsPerPage": 10
  }
}
```

- **Error Responses**:
  - `400 Bad Request`: If distributorId is missing
    ```json
    {
      "message": "distributorId query parameter is required"
    }
    ```
  - `404 Not Found`: If distributor doesn't exist
    ```json
    {
      "message": "Distributor not found"
    }
    ```
  - `500 Internal Server Error`: For server errors
    ```json
    {
      "message": "Internal server error"
    }
    ```

- **Notes for Developers**:
  - This endpoint is optimized for performance by returning only essential forecast data (ID and date)
  - If you need full forecast details including forecast items and product information, use the `GET /api/order-forecasts/:forecastId` endpoint instead
  - Date filtering uses inclusive ranges (gte/lte)
  - Default date range is the current month (first day to last day)
  - Results are sorted by forecast date in descending order (newest forecasts first)
  - The distributor information is included in the response for convenience, even though it's already known from the path parameter

---

### 2. Get Forecast by ID

- **GET** `/api/order-forecasts/:forecastId`
- **Description**: Retrieve a single forecast by its unique ID with complete details including distributor information, forecast items, and associated product details. This endpoint provides comprehensive forecast data including pricing information for different customer categories (DB and RSS).

- **Path Parameters**:
  - `forecastId` (required): The unique ID of the forecast (MongoDB ObjectId)

- **Request Headers**:
  - No special headers required (authentication middleware is currently commented out)

- **Response**: 200 OK
```json
{
  "forecast": {
    "id": "string (MongoDB ObjectId)",
    "distributorId": "string (MongoDB ObjectId)",
    "forecastDate": "ISO date string",
    "createdAt": "ISO date string",
    "Distributor": {
      "id": "string (MongoDB ObjectId)",
      "name": "string",
      "email": "string",
      "userType": "string",
      "CustomerDetail": {
        "dbCategory": "string (DistributorCategory enum)"
      }
    },
    "ForecastItem": [
      {
        "id": "string (MongoDB ObjectId)",
        "productId": "string (MongoDB ObjectId)",
        "distributorId": "string (MongoDB ObjectId)",
        "forecastId": "string (MongoDB ObjectId)",
        "forecastDate": "ISO date string",
        "quantity": "number (integer)",
        "createdAt": "ISO date string",
        "Product": {
          "id": "string (MongoDB ObjectId)",
          "name": "string",
          "sellingPricePerCartonForDb": "number (float)",
          "sellingPricePerCartonForDbWithGst": "number (float)",
          "sellingPricePerCartonForRss": "number (float)",
          "sellingPricePerCartonForRssWithGst": "number (float)",
          "productCode": "string",
          "mrp": "number (float)"
        }
      }
    ]
  }
}
```

- **Response Fields Description**:
  - `forecast.id`: Unique identifier for the forecast
  - `forecast.distributorId`: ID of the distributor who created the forecast
  - `forecast.forecastDate`: The date for which the forecast was created
  - `forecast.createdAt`: Timestamp when the forecast was created
  - `forecast.Distributor`: Object containing distributor information
    - `id`: Distributor's unique identifier
    - `name`: Distributor's name
    - `email`: Distributor's email address
    - `userType`: Type of user (e.g., "DISTRIBUTOR")
    - `CustomerDetail.dbCategory`: Category of the distributor (enum value)
  - `forecast.ForecastItem`: Array of forecast items associated with this forecast
    - `id`: Unique identifier for the forecast item
    - `productId`: ID of the product being forecasted
    - `distributorId`: ID of the distributor (same as forecast.distributorId)
    - `forecastId`: ID of the parent forecast (same as forecast.id)
    - `forecastDate`: Date of the forecast (same as forecast.forecastDate)
    - `quantity`: Forecasted quantity for this product
    - `createdAt`: Timestamp when the forecast item was created
    - `Product`: Object containing detailed product information
      - `id`: Product's unique identifier
      - `name`: Product name
      - `sellingPricePerCartonForDb`: Selling price per carton for DB category (without GST)
      - `sellingPricePerCartonForDbWithGst`: Selling price per carton for DB category (with GST)
      - `sellingPricePerCartonForRss`: Selling price per carton for RSS category (without GST)
      - `sellingPricePerCartonForRssWithGst`: Selling price per carton for RSS category (with GST)
      - `productCode`: Unique product code/SKU
      - `mrp`: Maximum Retail Price

- **Features**:
  - Returns complete forecast details with all related data
  - Includes distributor information with customer category details
  - Includes all forecast items with full product pricing information
  - Provides pricing for both DB (Distributor Business) and RSS categories
  - Single database query with optimized includes for performance

- **Example Request**:
```
GET /api/order-forecasts/507f1f77bcf86cd799439012
```

- **Example Response**:
```json
{
  "forecast": {
    "id": "507f1f77bcf86cd799439012",
    "distributorId": "507f1f77bcf86cd799439011",
    "forecastDate": "2024-01-15T00:00:00.000Z",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "Distributor": {
      "id": "507f1f77bcf86cd799439011",
      "name": "ABC Distributors",
      "email": "abc@distributor.com",
      "userType": "DISTRIBUTOR",
      "CustomerDetail": {
        "dbCategory": "DB"
      }
    },
    "ForecastItem": [
      {
        "id": "507f1f77bcf86cd799439020",
        "productId": "507f1f77bcf86cd799439030",
        "distributorId": "507f1f77bcf86cd799439011",
        "forecastId": "507f1f77bcf86cd799439012",
        "forecastDate": "2024-01-15T00:00:00.000Z",
        "quantity": 100,
        "createdAt": "2024-01-15T10:30:00.000Z",
        "Product": {
          "id": "507f1f77bcf86cd799439030",
          "name": "Premium Product A",
          "sellingPricePerCartonForDb": 500.00,
          "sellingPricePerCartonForDbWithGst": 590.00,
          "sellingPricePerCartonForRss": 480.00,
          "sellingPricePerCartonForRssWithGst": 566.40,
          "productCode": "PPA-001",
          "mrp": 750.00
        }
      },
      {
        "id": "507f1f77bcf86cd799439021",
        "productId": "507f1f77bcf86cd799439031",
        "distributorId": "507f1f77bcf86cd799439011",
        "forecastId": "507f1f77bcf86cd799439012",
        "forecastDate": "2024-01-15T00:00:00.000Z",
        "quantity": 50,
        "createdAt": "2024-01-15T10:30:00.000Z",
        "Product": {
          "id": "507f1f77bcf86cd799439031",
          "name": "Standard Product B",
          "sellingPricePerCartonForDb": 300.00,
          "sellingPricePerCartonForDbWithGst": 354.00,
          "sellingPricePerCartonForRss": 280.00,
          "sellingPricePerCartonForRssWithGst": 330.40,
          "productCode": "SPB-002",
          "mrp": 450.00
        }
      }
    ]
  }
}
```

- **Error Responses**:
  - `404 Not Found`: If forecast with the given ID doesn't exist
    ```json
    {
      "message": "Forecast not found"
    }
    ```
  - `500 Internal Server Error`: For server errors or database issues
    ```json
    {
      "message": "Internal server error"
    }
    ```

- **Notes for Developers**:
  - This endpoint returns the complete forecast object with all nested relationships in a single request
  - The response includes detailed product pricing information for both DB and RSS categories, which is useful for calculating order values based on distributor category
  - All dates are returned in ISO 8601 format
  - The `ForecastItem` array will be empty if the forecast has no items
  - Product pricing fields (`sellingPricePerCartonForDb`, `sellingPricePerCartonForDbWithGst`, etc.) may be `null` if not set for a product
  - The `CustomerDetail.dbCategory` field helps determine which pricing tier to use (DB vs RSS)
  - This endpoint is ideal for displaying forecast details in a UI or for processing forecast data in downstream systems
  - The endpoint uses Prisma's `findUnique` with `include` for efficient data fetching with relationships
  - Currently, authentication middleware is commented out, but it may be enabled in the future - check the route file for current authentication requirements

