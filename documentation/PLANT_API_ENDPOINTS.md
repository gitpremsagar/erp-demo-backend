# Plant API Endpoints

Base URL: `/api/plants`

## 1. Create Plant

**Endpoint:** `POST /api/plants`

**Description:** Creates a new plant

**Request Body:**
```json
{
  "name": "Plant Name",
  "location": "Plant Location"
}
```

**Validation Rules:**
- `name`: Required, 1-100 characters, trimmed
- `location`: Optional, max 200 characters, trimmed

**Success Response:**
- **Status Code:** 201 Created
- **Response Body:**
```json
{
  "plant": {
    "id": "plant_id",
    "name": "Plant Name",
    "location": "Plant Location",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Error Responses:**
- **409 Conflict** - Plant name already exists
  ```json
  {
    "message": "Plant name already exists"
  }
  ```
- **400 Bad Request** - Validation error
- **500 Internal Server Error** - Server error

---

## 2. Get All Plants

**Endpoint:** `GET /api/plants`

**Description:** Retrieves all plants ordered by name (ascending)

**Success Response:**
- **Status Code:** 200 OK
- **Response Body:**
```json
{
  "plants": [
    {
      "id": "plant_id",
      "name": "Plant Name",
      "location": "Plant Location",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

**Error Responses:**
- **500 Internal Server Error** - Server error

---

## 3. Get Plant by ID

**Endpoint:** `GET /api/plants/:id`

**Description:** Retrieves a specific plant by ID with associated products

**URL Parameters:**
- `id` - Plant ID (MongoDB ObjectId)

**Success Response:**
- **Status Code:** 200 OK
- **Response Body:**
```json
{
  "plant": {
    "id": "plant_id",
    "name": "Plant Name",
    "location": "Plant Location",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "Product": [
      {
        "id": "product_id",
        "name": "Product Name",
        // ... other product fields
      }
    ]
  }
}
```

**Error Responses:**
- **404 Not Found** - Plant not found
  ```json
  {
    "message": "Plant not found"
  }
  ```
- **500 Internal Server Error** - Server error

---

## 4. Update Plant

**Endpoint:** `PUT /api/plants/:id`

**Description:** Updates an existing plant

**URL Parameters:**
- `id` - Plant ID (MongoDB ObjectId)

**Request Body:** (all fields optional)
```json
{
  "name": "Updated Plant Name",
  "location": "Updated Plant Location"
}
```

**Validation Rules:**
- `name`: Optional, 1-100 characters, trimmed
- `location`: Optional, max 200 characters, trimmed

**Success Response:**
- **Status Code:** 200 OK
- **Response Body:**
```json
{
  "plant": {
    "id": "plant_id",
    "name": "Updated Plant Name",
    "location": "Updated Plant Location",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.001Z"
  }
}
```

**Error Responses:**
- **404 Not Found** - Plant not found
  ```json
  {
    "message": "Plant not found"
  }
  ```
- **409 Conflict** - Plant name already exists
  ```json
  {
    "message": "Plant name already exists"
  }
  ```
- **400 Bad Request** - Validation error
- **500 Internal Server Error** - Server error

---

## 5. Delete Plant

**Endpoint:** `DELETE /api/plants/:id`

**Description:** Deletes a plant (only if not associated with any products)

**URL Parameters:**
- `id` - Plant ID (MongoDB ObjectId)

**Success Response:**
- **Status Code:** 200 OK
- **Response Body:**
```json
{
  "message": "Plant deleted successfully"
}
```

**Error Responses:**
- **404 Not Found** - Plant not found
  ```json
  {
    "message": "Plant not found"
  }
  ```
- **400 Bad Request** - Plant is associated with products
  ```json
  {
    "message": "Cannot delete plant as it is associated with existing products"
  }
  ```
- **500 Internal Server Error** - Server error

---

## Notes

- Authentication is currently commented out in the route file. Uncomment `router.use(validateAccessToken);` to enable authentication for all plant routes.
- All timestamps are in ISO 8601 format
- Plant names must be unique across the system
- Plants cannot be deleted if they are associated with existing products

