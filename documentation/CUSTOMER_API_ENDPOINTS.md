# Customer API Endpoints

This document describes the API endpoints for managing customers (distributors) in the ERP backend system.

## Base URL
```
/api/customers
```

## Authentication
All endpoints require authentication (currently commented out in routes for development).

## Endpoints

### 1. Create Customer
**POST** `/api/customers`

Creates a new customer (distributor) with user account and customer details.

**Request Body:**
```json
{
  // User fields
  "name": "string (required, 1-100 characters)",
  "email": "string (required, valid email format)",
  "phone": "string (optional, 10-15 digits)",
  "password": "string (optional, min 6 characters, defaults to 'defaultPassword' if not provided)",
  
  // CustomerDetail fields
  "dbName": "string (required, 1-100 characters)",
  "dbCategory": "RSS | DISTRIBUTOR | OTHER (required)",
  "area": "string (required, 1-200 characters)",
  "state": "string (required, 1-100 characters)",
  "address": "string (required, 1-500 characters)",
  "pincode": "string (required, exactly 6 digits)",
  "vehicleType": "LPT | LCV | PICKUP (required)",
  "panNumber": "string (optional)",
  "gstinNumber": "string (optional)",
  "ownerAadharNumber": "number (required, 12-digit integer, 100000000000-999999999999)",
  "salesOfficerName": "string (required, 1-100 characters)",
  "salesOfficerContact": "string (required, 10-15 digits)",
  "creditLimit": "number (optional, integer, min 0, defaults to 0)",
  "paymentTerms": "ADVANCE | ONE_BILL_CREDIT (required)",
  "isCashDiscountAllowed": "boolean (optional, defaults to false)",
  "cashDiscountPercentage": "POINT_5 | POINT_75 (optional, only if isCashDiscountAllowed is true)",
  "isSundayDispatchAllowed": "boolean (optional, defaults to false)",
  "isMondayDispatchAllowed": "boolean (optional, defaults to false)",
  "isTuesdayDispatchAllowed": "boolean (optional, defaults to false)",
  "isWednesdayDispatchAllowed": "boolean (optional, defaults to false)",
  "isThursdayDispatchAllowed": "boolean (optional, defaults to false)",
  "isFridayDispatchAllowed": "boolean (optional, defaults to false)",
  "isSaturdayDispatchAllowed": "boolean (optional, defaults to false)",
  "twoSideDistance": "number (optional, integer, min 0, defaults to 0)"
}
```

**Example Request:**
```json
{
  "name": "ABC Distributors",
  "email": "abc@distributor.com",
  "phone": "9876543210",
  "password": "securePassword123",
  "dbName": "ABC Distributors",
  "dbCategory": "DISTRIBUTOR",
  "area": "North Zone",
  "state": "Delhi",
  "address": "123 Main Street, Sector 5",
  "pincode": "110001",
  "vehicleType": "LCV",
  "panNumber": "ABCDE1234F",
  "gstinNumber": "29ABCDE1234F1Z5",
  "ownerAadharNumber": 123456789012,
  "salesOfficerName": "John Doe",
  "salesOfficerContact": "9876543211",
  "creditLimit": 50000,
  "paymentTerms": "ONE_BILL_CREDIT",
  "isCashDiscountAllowed": true,
  "cashDiscountPercentage": "POINT_5",
  "isMondayDispatchAllowed": true,
  "isTuesdayDispatchAllowed": true,
  "isWednesdayDispatchAllowed": true,
  "isThursdayDispatchAllowed": true,
  "isFridayDispatchAllowed": true,
  "twoSideDistance": 50
}
```

**Response:**
```json
{
  "customer": {
    "id": "string",
    "name": "string",
    "email": "string",
    "phone": "string",
    "userType": "CUSTOMER",
    "createdAt": "datetime",
    "updatedAt": "datetime"
  },
  "customerDetail": {
    "id": "string",
    "dbUserId": "string",
    "dbName": "string",
    "dbCategory": "string",
    "email": "string",
    "area": "string",
    "state": "string",
    "address": "string",
    "pincode": "string",
    "vehicleType": "string",
    "panNumber": "string",
    "gstinNumber": "string",
    "ownerAadharNumber": "number",
    "salesOfficerName": "string",
    "salesOfficerContact": "string",
    "creditLimit": "number",
    "paymentTerms": "string",
    "isCashDiscountAllowed": "boolean",
    "cashDiscountPercentage": "string",
    "isSundayDispatchAllowed": "boolean",
    "isMondayDispatchAllowed": "boolean",
    "isTuesdayDispatchAllowed": "boolean",
    "isWednesdayDispatchAllowed": "boolean",
    "isThursdayDispatchAllowed": "boolean",
    "isFridayDispatchAllowed": "boolean",
    "isSaturdayDispatchAllowed": "boolean",
    "twoSideDistance": "number",
    "createdAt": "datetime",
    "updatedAt": "datetime"
  }
}
```

**Status Codes:**
- `201` - Customer created successfully
- `400` - Validation error
- `409` - User with same email already exists, or customer with same email, PAN, GSTIN, or Aadhar number already exists
- `500` - Internal server error

---

### 2. Get All Customers
**GET** `/api/customers`

Retrieves all customers (distributors) with pagination and search functionality.

**Query Parameters:**
- `page` (optional) - Page number (default: 1)
- `limit` (optional) - Items per page (default: 10)
- `search` (optional) - Search by customer name, email, phone, DB name, area, or state (case-insensitive)

**Example Request:**
```
GET /api/customers?page=1&limit=10&search=ABC
```

**Response:**
```json
{
  "customers": [
    {
      "id": "string",
      "name": "string",
      "email": "string",
      "phone": "string",
      "userType": "CUSTOMER",
      "createdAt": "datetime",
      "updatedAt": "datetime",
      "CustomerDetail": [
        {
          "id": "string",
          "dbUserId": "string",
          "dbName": "string",
          "dbCategory": "string",
          "email": "string",
          "area": "string",
          "state": "string",
          "address": "string",
          "pincode": "string",
          "vehicleType": "string",
          "panNumber": "string",
          "gstinNumber": "string",
          "ownerAadharNumber": "number",
          "salesOfficerName": "string",
          "salesOfficerContact": "string",
          "creditLimit": "number",
          "paymentTerms": "string",
          "isCashDiscountAllowed": "boolean",
          "cashDiscountPercentage": "string",
          "isSundayDispatchAllowed": "boolean",
          "isMondayDispatchAllowed": "boolean",
          "isTuesdayDispatchAllowed": "boolean",
          "isWednesdayDispatchAllowed": "boolean",
          "isThursdayDispatchAllowed": "boolean",
          "isFridayDispatchAllowed": "boolean",
          "isSaturdayDispatchAllowed": "boolean",
          "twoSideDistance": "number",
          "createdAt": "datetime",
          "updatedAt": "datetime"
        }
      ]
    }
  ],
  "pagination": {
    "currentPage": "number",
    "totalPages": "number",
    "totalItems": "number",
    "itemsPerPage": "number"
  }
}
```

**Status Codes:**
- `200` - Success
- `400` - Validation error
- `500` - Internal server error

---

### 3. Get Customer Statistics
**GET** `/api/customers/stats`

Retrieves customer statistics including total customers and customers with/without orders.

**Response:**
```json
{
  "totalCustomers": "number",
  "customersWithOrders": "number",
  "customersWithoutOrders": "number"
}
```

**Status Codes:**
- `200` - Success
- `500` - Internal server error

---

### 4. Get Distributors with Forecast
**GET** `/api/customers/distributors-with-forecast`

Retrieves all customers (distributors) along with their associated forecast information. This endpoint is useful for viewing distributors and their recent forecast history. Each distributor includes their customer details and up to 6 most recent forecasts ordered by date (newest first).

**Query Parameters:**
- `page` (optional) - Page number (default: 1)
- `limit` (optional) - Items per page (default: 1000)

**Example Request:**
```
GET /api/customers/distributors-with-forecast?page=1&limit=50
```

**Response:**
```json
{
  "distributors": [
    {
      "id": "string",
      "name": "string",
      "email": "string",
      "phone": "string",
      "userType": "CUSTOMER",
      "createdAt": "datetime",
      "updatedAt": "datetime",
      "CustomerDetail": [
        {
          "id": "string",
          "dbName": "string"
        }
      ],
      "Forecast": [
        {
          "id": "string",
          "forecastDate": "datetime"
        }
      ]
    }
  ],
  "pagination": {
    "currentPage": "number",
    "totalPages": "number",
    "totalItems": "number",
    "itemsPerPage": "number"
  }
}
```

**Response Fields:**
- **distributors**: Array of customer (distributor) objects with their details and forecasts
  - Each distributor includes all standard user fields (id, name, email, phone, etc.)
  - **CustomerDetail**: Array containing limited distributor business details
    - **id**: Customer detail ID
    - **dbName**: Distributor business name
  - **Forecast**: Array of forecast objects (limited to 6 most recent)
    - **id**: Forecast ID
    - **forecastDate**: Date when the forecast was created
- **pagination**: Pagination metadata
  - **currentPage**: Current page number
  - **totalPages**: Total number of pages
  - **totalItems**: Total number of distributors
  - **itemsPerPage**: Number of items per page

**Status Codes:**
- `200` - Success
- `500` - Internal server error

**Notes:**
- This endpoint returns all customers with `userType: "CUSTOMER"`, regardless of whether they have forecasts or not
- The `CustomerDetail` array only includes `id` and `dbName` fields for optimized performance. To get complete customer details, use the `GET /api/customers/:id` endpoint
- Each distributor includes up to 6 most recent forecasts, ordered by `forecastDate` in descending order (newest first)
- If a distributor has no forecasts, the `Forecast` array will be empty
- The default limit is 1000 items per page (higher than the standard 10) to accommodate viewing all distributors at once
- Results are ordered by creation date (newest first) at the distributor level
- To get full forecast details including forecast items, use the forecast-specific endpoints

---

### 5. Get Customer by ID
**GET** `/api/customers/:id`

Retrieves a specific customer (distributor) by their user ID.

**Path Parameters:**
- `id` (required) - Customer user ID

**Example Request:**
```
GET /api/customers/123e4567-e89b-12d3-a456-426614174000
```

**Response:**
```json
{
  "customer": {
    "id": "string",
    "name": "string",
    "email": "string",
    "phone": "string",
    "userType": "CUSTOMER",
    "createdAt": "datetime",
    "updatedAt": "datetime",
    "CustomerDetail": [
      {
        "id": "string",
        "dbUserId": "string",
        "dbName": "string",
        "dbCategory": "string",
        "email": "string",
        "area": "string",
        "state": "string",
        "address": "string",
        "pincode": "string",
        "vehicleType": "string",
        "panNumber": "string",
        "gstinNumber": "string",
        "ownerAadharNumber": "number",
        "salesOfficerName": "string",
        "salesOfficerContact": "string",
        "creditLimit": "number",
        "paymentTerms": "string",
        "isCashDiscountAllowed": "boolean",
        "cashDiscountPercentage": "string",
        "isSundayDispatchAllowed": "boolean",
        "isMondayDispatchAllowed": "boolean",
        "isTuesdayDispatchAllowed": "boolean",
        "isWednesdayDispatchAllowed": "boolean",
        "isThursdayDispatchAllowed": "boolean",
        "isFridayDispatchAllowed": "boolean",
        "isSaturdayDispatchAllowed": "boolean",
        "twoSideDistance": "number",
        "createdAt": "datetime",
        "updatedAt": "datetime"
      }
    ]
  }
}
```

**Status Codes:**
- `200` - Success
- `400` - User is not a customer
- `404` - Customer not found
- `500` - Internal server error

---

### 6. Update Customer
**PUT** `/api/customers/:id`

Updates an existing customer (distributor). All fields are optional - only provide the fields you want to update.

**Path Parameters:**
- `id` (required) - Customer user ID

**Request Body:**
```json
{
  // User fields (optional)
  "name": "string (optional, 1-100 characters)",
  "phone": "string (optional, 10-15 digits)",
  
  // CustomerDetail fields (optional)
  "dbName": "string (optional, 1-100 characters)",
  "dbCategory": "RSS | DISTRIBUTOR | OTHER (optional)",
  "area": "string (optional, 1-200 characters)",
  "state": "string (optional, 1-100 characters)",
  "address": "string (optional, 1-500 characters)",
  "pincode": "string (optional, exactly 6 digits)",
  "vehicleType": "LPT | LCV | PICKUP (optional)",
  "panNumber": "string (optional)",
  "gstinNumber": "string (optional)",
  "ownerAadharNumber": "number (optional, 12-digit integer)",
  "salesOfficerName": "string (optional, 1-100 characters)",
  "salesOfficerContact": "string (optional, 10-15 digits)",
  "creditLimit": "number (optional, integer, min 0)",
  "paymentTerms": "ADVANCE | ONE_BILL_CREDIT (optional)",
  "isCashDiscountAllowed": "boolean (optional)",
  "cashDiscountPercentage": "POINT_5 | POINT_75 (optional)",
  "isSundayDispatchAllowed": "boolean (optional)",
  "isMondayDispatchAllowed": "boolean (optional)",
  "isTuesdayDispatchAllowed": "boolean (optional)",
  "isWednesdayDispatchAllowed": "boolean (optional)",
  "isThursdayDispatchAllowed": "boolean (optional)",
  "isFridayDispatchAllowed": "boolean (optional)",
  "isSaturdayDispatchAllowed": "boolean (optional)",
  "twoSideDistance": "number (optional, integer, min 0)"
}
```

**Example Request:**
```json
{
  "creditLimit": 75000,
  "paymentTerms": "ADVANCE",
  "isCashDiscountAllowed": false
}
```

**Response:**
```json
{
  "customer": {
    "id": "string",
    "name": "string",
    "email": "string",
    "phone": "string",
    "userType": "CUSTOMER",
    "createdAt": "datetime",
    "updatedAt": "datetime",
    "CustomerDetail": [
      {
        "id": "string",
        "dbUserId": "string",
        "dbName": "string",
        "dbCategory": "string",
        "email": "string",
        "area": "string",
        "state": "string",
        "address": "string",
        "pincode": "string",
        "vehicleType": "string",
        "panNumber": "string",
        "gstinNumber": "string",
        "ownerAadharNumber": "number",
        "salesOfficerName": "string",
        "salesOfficerContact": "string",
        "creditLimit": "number",
        "paymentTerms": "string",
        "isCashDiscountAllowed": "boolean",
        "cashDiscountPercentage": "string",
        "isSundayDispatchAllowed": "boolean",
        "isMondayDispatchAllowed": "boolean",
        "isTuesdayDispatchAllowed": "boolean",
        "isWednesdayDispatchAllowed": "boolean",
        "isThursdayDispatchAllowed": "boolean",
        "isFridayDispatchAllowed": "boolean",
        "isSaturdayDispatchAllowed": "boolean",
        "twoSideDistance": "number",
        "createdAt": "datetime",
        "updatedAt": "datetime"
      }
    ]
  },
  "customerDetail": {
    "id": "string",
    "dbUserId": "string",
    "dbName": "string",
    "dbCategory": "string",
    "email": "string",
    "area": "string",
    "state": "string",
    "address": "string",
    "pincode": "string",
    "vehicleType": "string",
    "panNumber": "string",
    "gstinNumber": "string",
    "ownerAadharNumber": "number",
    "salesOfficerName": "string",
    "salesOfficerContact": "string",
    "creditLimit": "number",
    "paymentTerms": "string",
    "isCashDiscountAllowed": "boolean",
    "cashDiscountPercentage": "string",
    "isSundayDispatchAllowed": "boolean",
    "isMondayDispatchAllowed": "boolean",
    "isTuesdayDispatchAllowed": "boolean",
    "isWednesdayDispatchAllowed": "boolean",
    "isThursdayDispatchAllowed": "boolean",
    "isFridayDispatchAllowed": "boolean",
    "isSaturdayDispatchAllowed": "boolean",
    "twoSideDistance": "number",
    "createdAt": "datetime",
    "updatedAt": "datetime"
  }
}
```

**Status Codes:**
- `200` - Customer updated successfully
- `400` - Validation error, user is not a customer, or customer detail not found
- `404` - Customer not found
- `409` - Customer with same PAN, GSTIN, or Aadhar number already exists
- `500` - Internal server error

---

### 7. Delete Customer
**DELETE** `/api/customers/:id`

Deletes a customer (distributor) and their associated customer details. Cannot delete customers with existing orders.

**Path Parameters:**
- `id` (required) - Customer user ID

**Example Request:**
```
DELETE /api/customers/123e4567-e89b-12d3-a456-426614174000
```

**Response:**
```json
{
  "message": "Customer deleted successfully"
}
```

**Status Codes:**
- `200` - Customer deleted successfully
- `400` - User is not a customer, or cannot delete customer with existing orders
- `404` - Customer not found
- `500` - Internal server error

---

## Error Response Format

All error responses follow this format:

```json
{
  "message": "Error description"
}
```

For validation errors:
```json
{
  "message": [
    {
      "code": "string",
      "expected": "string",
      "received": "string",
      "path": ["string"],
      "message": "string"
    }
  ]
}
```

## Field Descriptions

### User Fields
- **name**: Customer's full name (1-100 characters)
- **email**: Customer's email address (must be unique, valid email format)
- **phone**: Customer's phone number (10-15 digits, optional)
- **password**: Customer's password (min 6 characters, optional, defaults to 'defaultPassword' if not provided)

### Customer Detail Fields
- **dbName**: Distributor business name (1-100 characters)
- **dbCategory**: Distributor category - `RSS`, `DISTRIBUTOR`, or `OTHER`
- **area**: Geographic area where distributor operates (1-200 characters)
- **state**: State where distributor is located (1-100 characters)
- **address**: Complete address of distributor (1-500 characters)
- **pincode**: 6-digit postal code
- **vehicleType**: Type of vehicle used - `LPT` (Light Passenger Transport), `LCV` (Light Commercial Vehicle), or `PICKUP`
- **panNumber**: PAN (Permanent Account Number) - optional, must be unique if provided
- **gstinNumber**: GSTIN (GST Identification Number) - optional, must be unique if provided
- **ownerAadharNumber**: Owner's Aadhar number (12-digit integer, must be unique)
- **salesOfficerName**: Name of assigned sales officer (1-100 characters)
- **salesOfficerContact**: Contact number of sales officer (10-15 digits)
- **creditLimit**: Maximum credit limit allowed (integer, min 0, defaults to 0)
- **paymentTerms**: Payment terms - `ADVANCE` or `ONE_BILL_CREDIT`
- **isCashDiscountAllowed**: Whether cash discount is allowed (boolean, defaults to false)
- **cashDiscountPercentage**: Cash discount percentage - `POINT_5` (0.5%) or `POINT_75` (0.75%), only applicable if `isCashDiscountAllowed` is true
- **isSundayDispatchAllowed**: Whether dispatch is allowed on Sunday (boolean, defaults to false)
- **isMondayDispatchAllowed**: Whether dispatch is allowed on Monday (boolean, defaults to false)
- **isTuesdayDispatchAllowed**: Whether dispatch is allowed on Tuesday (boolean, defaults to false)
- **isWednesdayDispatchAllowed**: Whether dispatch is allowed on Wednesday (boolean, defaults to false)
- **isThursdayDispatchAllowed**: Whether dispatch is allowed on Thursday (boolean, defaults to false)
- **isFridayDispatchAllowed**: Whether dispatch is allowed on Friday (boolean, defaults to false)
- **isSaturdayDispatchAllowed**: Whether dispatch is allowed on Saturday (boolean, defaults to false)
- **twoSideDistance**: Two-side distance in kilometers (integer, min 0, defaults to 0)

## Notes

1. **Unique Constraints**: 
   - Email addresses must be unique across all users
   - PAN numbers, GSTIN numbers, and Aadhar numbers must be unique across all customer details
   - Attempting to create or update with duplicate values will result in a 409 Conflict error

2. **Customer Deletion**: 
   - Customers cannot be deleted if they have existing orders
   - You must delete all associated orders before deleting a customer

3. **Password Handling**: 
   - Passwords are hashed using bcrypt before storage
   - If password is not provided during creation, it defaults to 'defaultPassword'
   - Password cannot be updated through the customer update endpoint (use auth endpoints for password changes)

4. **Pagination**: 
   - Default page size is 10 items per page
   - Results are ordered by creation date (newest first)

5. **Search Functionality**: 
   - Search is case-insensitive
   - Searches across customer name, email, phone, DB name, area, and state

6. **Transaction Safety**: 
   - Customer creation and updates are performed within database transactions to ensure data consistency
   - If any part of the operation fails, all changes are rolled back

7. **Dispatch Days**: 
   - Each day of the week can be individually configured for dispatch allowance
   - Useful for managing delivery schedules based on distributor preferences

8. **Credit Management**: 
   - Credit limit is set per distributor
   - Payment terms determine when payment is expected (advance or one bill credit)

