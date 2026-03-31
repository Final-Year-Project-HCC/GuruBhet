# API Contract for Academic Domains Management

## Overview

This document specifies all API endpoints required to support the Academic Domains management system in the Staff application.

## Base URL
```
{BASE_API_URL}/staff
```

All endpoints assume a valid authentication token is provided in headers.

---

## Universities Management

### 1. Get All Universities

**Endpoint:** `GET /universities`

**Authentication:** Required (Bearer token)

**Response:**
```json
[
  {
    "id": "uni-001",
    "name": "Tribhuvan University",
    "description": "Nepal's oldest and largest university",
    "createdAt": "2024-03-15T10:30:00Z",
    "updatedAt": "2024-03-15T10:30:00Z"
  }
]
```

**Status Codes:**
- `200` - Success
- `401` - Unauthorized
- `500` - Server error

---

### 2. Create University

**Endpoint:** `POST /universities`

**Authentication:** Required (Bearer token)

**Request Body:**
```json
{
  "name": "Tribhuvan University",
  "description": "Nepal's oldest and largest university" // optional
}
```

**Validation:**
- `name` - Required, string, min length 3, max length 100
- `description` - Optional, string, max length 500

**Response:**
```json
{
  "id": "uni-001",
  "name": "Tribhuvan University",
  "description": "Nepal's oldest and largest university",
  "createdAt": "2024-03-15T10:30:00Z",
  "updatedAt": "2024-03-15T10:30:00Z"
}
```

**Status Codes:**
- `201` - Created
- `400` - Bad request (validation error)
- `401` - Unauthorized
- `409` - Conflict (duplicate name)
- `500` - Server error

---

## Faculties Management

### 3. Get Faculties by University

**Endpoint:** `GET /universities/{universityId}/faculties`

**Authentication:** Required

**URL Parameters:**
- `universityId` - UUID of the university

**Response:**
```json
[
  {
    "id": "fac-001",
    "universityId": "uni-001",
    "name": "Faculty of Engineering",
    "description": "Engineering programs",
    "numberOfSemesters": 8,
    "createdAt": "2024-03-15T10:30:00Z",
    "updatedAt": "2024-03-15T10:30:00Z"
  }
]
```

**Status Codes:**
- `200` - Success
- `401` - Unauthorized
- `404` - University not found
- `500` - Server error

---

### 4. Create Faculty (Single)

**Endpoint:** `POST /universities/{universityId}/faculties`

**Authentication:** Required

**URL Parameters:**
- `universityId` - UUID of the university

**Request Body:**
```json
{
  "name": "Faculty of Engineering",
  "description": "Engineering programs", // optional
  "numberOfSemesters": 8
}
```

**Validation:**
- `name` - Required, string, min 3, max 100
- `description` - Optional, string, max 500
- `numberOfSemesters` - Required, number, min 1, max 20

**Response:**
```json
{
  "id": "fac-001",
  "universityId": "uni-001",
  "name": "Faculty of Engineering",
  "description": "Engineering programs",
  "numberOfSemesters": 8,
  "createdAt": "2024-03-15T10:30:00Z",
  "updatedAt": "2024-03-15T10:30:00Z"
}
```

**Status Codes:**
- `201` - Created
- `400` - Bad request
- `401` - Unauthorized
- `404` - University not found
- `409` - Conflict
- `500` - Server error

---

### 5. Bulk Create Faculties

**Endpoint:** `POST /faculties/bulk`

**Authentication:** Required

**Request Body:**
```json
{
  "faculties": [
    {
      "universityId": "uni-001",
      "name": "Faculty of Science",
      "description": "Science programs",
      "numberOfSemesters": 6
    },
    {
      "universityId": "uni-001",
      "name": "Faculty of Arts",
      "numberOfSemesters": 6
    }
  ]
}
```

**Constraints:**
- Minimum 1 faculty in request
- Maximum 10 faculties per request
- All must have valid universityId

**Response:**
```json
[
  {
    "id": "fac-002",
    "universityId": "uni-001",
    "name": "Faculty of Science",
    "description": "Science programs",
    "numberOfSemesters": 6,
    "createdAt": "2024-03-15T10:30:00Z",
    "updatedAt": "2024-03-15T10:30:00Z"
  },
  {
    "id": "fac-003",
    "universityId": "uni-001",
    "name": "Faculty of Arts",
    "numberOfSemesters": 6,
    "createdAt": "2024-03-15T10:30:00Z",
    "updatedAt": "2024-03-15T10:30:00Z"
  }
]
```

**Status Codes:**
- `201` - Created (all or none)
- `400` - Bad request / Validation error
- `401` - Unauthorized
- `500` - Server error

---

## Semesters Management

### 6. Get Semesters by Faculty

**Endpoint:** `GET /universities/{universityId}/faculties/{facultyId}/semesters`

**Authentication:** Required

**URL Parameters:**
- `universityId` - UUID of university
- `facultyId` - UUID of faculty

**Query Parameters:** (optional)
- `sort` - "number_asc" (default) | "number_desc"

**Response:**
```json
[
  {
    "id": "sem-001",
    "universityId": "uni-001",
    "facultyId": "fac-001",
    "semesterNumber": 1,
    "createdAt": "2024-03-15T10:30:00Z",
    "updatedAt": "2024-03-15T10:30:00Z"
  },
  {
    "id": "sem-002",
    "universityId": "uni-001",
    "facultyId": "fac-001",
    "semesterNumber": 2,
    "createdAt": "2024-03-15T10:30:00Z",
    "updatedAt": "2024-03-15T10:30:00Z"
  }
]
```

**Status Codes:**
- `200` - Success
- `401` - Unauthorized
- `404` - University or faculty not found
- `500` - Server error

---

### 7. Create Semester

**Endpoint:** `POST /universities/{universityId}/faculties/{facultyId}/semesters`

**Authentication:** Required

**URL Parameters:**
- `universityId` - UUID of university
- `facultyId` - UUID of faculty

**Request Body:**
```json
{
  "semesterNumber": 1
}
```

**Validation:**
- `semesterNumber` - Required, number, min 1
- Must be ≤ faculty's numberOfSemesters
- Must not already exist for this faculty

**Response:**
```json
{
  "id": "sem-001",
  "universityId": "uni-001",
  "facultyId": "fac-001",
  "semesterNumber": 1,
  "createdAt": "2024-03-15T10:30:00Z",
  "updatedAt": "2024-03-15T10:30:00Z"
}
```

**Status Codes:**
- `201` - Created
- `400` - Bad request / Validation error
- `401` - Unauthorized
- `404` - University or faculty not found
- `409` - Semester already exists
- `500` - Server error

---

## Subjects Management

### 8. Get Subjects by Semester

**Endpoint:** `GET /universities/{universityId}/faculties/{facultyId}/semesters/{semesterId}/subjects`

**Authentication:** Required

**URL Parameters:**
- `universityId` - UUID of university
- `facultyId` - UUID of faculty
- `semesterId` - UUID of semester

**Query Parameters:** (optional)
- `sort` - "name_asc" (default) | "name_desc"

**Response:**
```json
[
  {
    "id": "subj-001",
    "universityId": "uni-001",
    "facultyId": "fac-001",
    "semesterId": "sem-001",
    "name": "Calculus I",
    "description": "Advanced mathematics",
    "createdAt": "2024-03-15T10:30:00Z",
    "updatedAt": "2024-03-15T10:30:00Z"
  }
]
```

**Status Codes:**
- `200` - Success
- `401` - Unauthorized
- `404` - Any IDs not found
- `500` - Server error

---

### 9. Create Subject (Single)

**Endpoint:** `POST /universities/{universityId}/faculties/{facultyId}/semesters/{semesterId}/subjects`

**Authentication:** Required

**URL Parameters:**
- `universityId` - UUID of university
- `facultyId` - UUID of faculty
- `semesterId` - UUID of semester

**Request Body:**
```json
{
  "name": "Calculus I",
  "description": "Advanced mathematics" // optional
}
```

**Validation:**
- `name` - Required, string, min 2, max 100
- `description` - Optional, string, max 500
- Must not create duplicate names in same semester

**Response:**
```json
{
  "id": "subj-001",
  "universityId": "uni-001",
  "facultyId": "fac-001",
  "semesterId": "sem-001",
  "name": "Calculus I",
  "description": "Advanced mathematics",
  "createdAt": "2024-03-15T10:30:00Z",
  "updatedAt": "2024-03-15T10:30:00Z"
}
```

**Status Codes:**
- `201` - Created
- `400` - Bad request / Validation error
- `401` - Unauthorized
- `404` - Any IDs not found
- `409` - Duplicate subject in semester
- `500` - Server error

---

### 10. Bulk Create Subjects

**Endpoint:** `POST /subjects/bulk`

**Authentication:** Required

**Request Body:**
```json
{
  "subjects": [
    {
      "universityId": "uni-001",
      "facultyId": "fac-001",
      "semesterId": "sem-001",
      "name": "Calculus I",
      "description": "Advanced mathematics"
    },
    {
      "universityId": "uni-001",
      "facultyId": "fac-001",
      "semesterId": "sem-001",
      "name": "Physics I"
    }
  ]
}
```

**Constraints:**
- Minimum 1 subject in request
- Maximum 15 subjects per request
- All must have same semesterId for efficiency
- All references must be valid

**Response:**
```json
[
  {
    "id": "subj-001",
    "universityId": "uni-001",
    "facultyId": "fac-001",
    "semesterId": "sem-001",
    "name": "Calculus I",
    "description": "Advanced mathematics",
    "createdAt": "2024-03-15T10:30:00Z",
    "updatedAt": "2024-03-15T10:30:00Z"
  },
  {
    "id": "subj-002",
    "universityId": "uni-001",
    "facultyId": "fac-001",
    "semesterId": "sem-001",
    "name": "Physics I",
    "createdAt": "2024-03-15T10:30:00Z",
    "updatedAt": "2024-03-15T10:30:00Z"
  }
]
```

**Status Codes:**
- `201` - Created (all or none)
- `400` - Bad request / Validation error
- `401` - Unauthorized
- `404` - Any IDs not found
- `500` - Server error

---

## Authentication

All endpoints require:

**Header:**
```
Authorization: Bearer {token}
```

**Response on auth failure:**
```json
{
  "error": "Unauthorized",
  "message": "Invalid or missing authentication token"
}
```

---

## Error Response Format

All errors follow this format:

```json
{
  "error": "Bad Request",
  "message": "Validation failed",
  "details": [
    {
      "field": "name",
      "error": "Name is required and must be at least 3 characters"
    }
  ]
}
```

---

## Request/Response Headers

**Request Headers:**
```
Content-Type: application/json
Authorization: Bearer {token}
```

**Response Headers:**
```
Content-Type: application/json
X-Request-ID: {uuid} // for tracking
```

---

## Rate Limiting

- Rate limit: 100 requests per minute per user
- Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- Response on excess: `429 Too Many Requests`

---

## Data Types

### University
```typescript
interface University {
  id: string;              // UUID
  name: string;            // Max 100 chars
  description?: string;    // Max 500 chars
  createdAt: ISO8601;      // Timestamp
  updatedAt: ISO8601;      // Timestamp
}
```

### Faculty
```typescript
interface Faculty {
  id: string;              // UUID
  universityId: string;    // FK to University
  name: string;            // Max 100 chars
  description?: string;    // Max 500 chars
  numberOfSemesters: number; // 1-20
  createdAt: ISO8601;
  updatedAt: ISO8601;
}
```

### Semester
```typescript
interface Semester {
  id: string;              // UUID
  universityId: string;    // FK to University
  facultyId: string;       // FK to Faculty
  semesterNumber: number;  // 1-N
  createdAt: ISO8601;
  updatedAt: ISO8601;
}
```

### Subject
```typescript
interface Subject {
  id: string;              // UUID
  universityId: string;    // FK to University
  facultyId: string;       // FK to Faculty
  semesterId: string;      // FK to Semester
  name: string;            // Max 100 chars
  description?: string;    // Max 500 chars
  createdAt: ISO8601;
  updatedAt: ISO8601;
}
```

---

## Implementation Checklist

- [ ] Implement all 10 endpoints
- [ ] Add proper validation on all fields
- [ ] Add foreign key constraints
- [ ] Add unique constraints where needed
- [ ] Implement rate limiting
- [ ] Add request ID tracking
- [ ] Add proper error handling
- [ ] Add input sanitization
- [ ] Add permission checks (is staff)
- [ ] Add audit logging
- [ ] Add database indexes on foreign keys
- [ ] Test all endpoints
- [ ] Test error scenarios
- [ ] Document using OpenAPI/Swagger
- [ ] Setup monitoring/alerting

---

## Testing Guide

### Test Cases

1. **Create University**
   - Valid data ✓
   - Missing name ✗
   - Name too short ✗
   - Name too long ✗
   - Duplicate name ✓

2. **Create Faculty**
   - Valid data ✓
   - Invalid universityId ✗
   - Missing semesters ✗
   - Semesters > 20 ✗
   - Valid bulk operation ✓

3. **Create Semester**
   - Valid creation ✓
   - Semester number > faculty.numberOfSemesters ✗
   - Duplicate semester ✗
   - Invalid facultyId ✗

4. **Create Subject**
   - Valid creation ✓
   - Duplicate name in same semester ✗
   - Invalid semesterId ✗
   - Bulk operation ✓

---

**Document Version:** 1.0
**Last Updated:** March 2026
