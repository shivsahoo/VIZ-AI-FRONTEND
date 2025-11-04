# VizAI API Reference

This document outlines the API structure for VizAI. Currently, the application uses stub/mock implementations. This serves as a reference for future backend integration.

## API Architecture

### Base URL
```
Development: http://localhost:3000/api
Production: https://api.vizai.app
```

### Authentication
All API requests require authentication via Bearer token (except auth endpoints).

```http
Authorization: Bearer {access_token}
```

## API Endpoints

### 1. Authentication

#### POST /auth/login
Authenticate user and receive access token.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_123",
      "name": "John Doe",
      "email": "user@example.com",
      "role": "admin"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 3600
  }
}
```

#### POST /auth/register
Create new user account.

**Request:**
```json
{
  "name": "John Doe",
  "email": "user@example.com",
  "password": "securepassword",
  "organizationName": "Acme Corp"
}
```

#### POST /auth/logout
Invalidate current session.

#### POST /auth/refresh
Refresh access token.

---

### 2. Projects

#### GET /projects
List all projects for the current user.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "proj_123",
      "name": "Sales Analytics Q4",
      "description": "Quarterly sales performance tracking",
      "createdAt": "2024-10-15T10:30:00Z",
      "updatedAt": "2024-11-01T14:20:00Z",
      "owner": "user_123",
      "memberCount": 5,
      "databaseCount": 2,
      "dashboardCount": 8
    }
  ]
}
```

#### POST /projects
Create new project.

**Request:**
```json
{
  "name": "Marketing Dashboard",
  "description": "Campaign performance metrics"
}
```

#### GET /projects/:id
Get project details.

#### PUT /projects/:id
Update project.

#### DELETE /projects/:id
Delete project.

---

### 3. Dashboards

#### GET /projects/:projectId/dashboards
List all dashboards in a project.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "dash_123",
      "name": "Revenue Overview",
      "description": "Monthly revenue tracking",
      "projectId": "proj_123",
      "createdAt": "2024-10-20T09:15:00Z",
      "updatedAt": "2024-11-02T11:30:00Z",
      "chartCount": 6,
      "layout": "grid",
      "isPublic": false
    }
  ]
}
```

#### POST /projects/:projectId/dashboards
Create new dashboard.

**Request:**
```json
{
  "name": "Sales Dashboard",
  "description": "Regional sales performance",
  "layout": "grid",
  "charts": ["chart_1", "chart_2", "chart_3"]
}
```

#### GET /dashboards/:id
Get dashboard details with all charts.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "dash_123",
    "name": "Revenue Overview",
    "description": "Monthly revenue tracking",
    "charts": [
      {
        "id": "chart_1",
        "name": "Monthly Revenue",
        "type": "line",
        "position": { "x": 0, "y": 0, "w": 6, "h": 4 }
      }
    ]
  }
}
```

#### PUT /dashboards/:id
Update dashboard.

#### DELETE /dashboards/:id
Delete dashboard.

---

### 4. Charts

#### GET /projects/:projectId/charts
List all charts in a project.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "chart_123",
      "name": "Monthly Revenue Trend",
      "type": "line",
      "projectId": "proj_123",
      "databaseId": "db_123",
      "query": "SELECT month, SUM(revenue) FROM sales GROUP BY month",
      "config": {
        "xAxis": "month",
        "yAxis": "revenue",
        "color": "#00C2A8"
      },
      "createdAt": "2024-10-25T13:45:00Z"
    }
  ]
}
```

#### POST /projects/:projectId/charts
Create new chart.

**Request:**
```json
{
  "name": "Sales by Region",
  "type": "bar",
  "databaseId": "db_123",
  "query": "SELECT region, SUM(sales) FROM transactions GROUP BY region",
  "config": {
    "xAxis": "region",
    "yAxis": "sales",
    "color": "#00C2A8"
  }
}
```

#### GET /charts/:id
Get chart details.

#### PUT /charts/:id
Update chart configuration.

#### DELETE /charts/:id
Delete chart.

#### GET /charts/:id/data
Get chart data (executes query).

**Response:**
```json
{
  "success": true,
  "data": [
    { "month": "Jan", "revenue": 45000 },
    { "month": "Feb", "revenue": 52000 },
    { "month": "Mar", "revenue": 48000 }
  ],
  "metadata": {
    "rowCount": 3,
    "executionTime": 45,
    "cachedAt": null
  }
}
```

---

### 5. Databases

#### GET /projects/:projectId/databases
List database connections.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "db_123",
      "name": "Production DB",
      "type": "postgresql",
      "host": "db.example.com",
      "port": 5432,
      "database": "sales_db",
      "username": "readonly_user",
      "status": "connected",
      "lastChecked": "2024-11-03T10:00:00Z"
    }
  ]
}
```

#### POST /projects/:projectId/databases
Add database connection.

**Request:**
```json
{
  "name": "Analytics DB",
  "type": "mysql",
  "host": "analytics.db.example.com",
  "port": 3306,
  "database": "analytics",
  "username": "vizai_user",
  "password": "encrypted_password",
  "ssl": true
}
```

#### POST /databases/:id/test
Test database connection.

**Response:**
```json
{
  "success": true,
  "data": {
    "connected": true,
    "latency": 45,
    "version": "PostgreSQL 14.5"
  }
}
```

#### GET /databases/:id/schema
Get database schema (tables and columns).

**Response:**
```json
{
  "success": true,
  "data": {
    "tables": [
      {
        "name": "users",
        "rowCount": 15420,
        "columns": [
          { "name": "id", "type": "integer", "nullable": false },
          { "name": "email", "type": "varchar", "nullable": false },
          { "name": "created_at", "type": "timestamp", "nullable": false }
        ]
      }
    ]
  }
}
```

#### PUT /databases/:id
Update database connection.

#### DELETE /databases/:id
Remove database connection.

---

### 6. AI/Insights

#### POST /ai/query
Natural language to SQL conversion.

**Request:**
```json
{
  "question": "What were the top 5 selling products last month?",
  "databaseId": "db_123",
  "context": {
    "tables": ["products", "sales", "transactions"]
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sql": "SELECT p.name, SUM(s.quantity) as total_sold FROM products p JOIN sales s ON p.id = s.product_id WHERE s.date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') GROUP BY p.name ORDER BY total_sold DESC LIMIT 5",
    "explanation": "This query joins products and sales tables to find the top 5 selling products from last month",
    "confidence": 0.92
  }
}
```

#### POST /ai/insights
Generate insights from data.

**Request:**
```json
{
  "chartId": "chart_123",
  "analysisType": "trend"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "insights": [
      {
        "type": "trend",
        "title": "Revenue increasing 15% month-over-month",
        "description": "Revenue has shown consistent growth over the past 6 months",
        "confidence": 0.88,
        "actionable": true,
        "recommendation": "Consider scaling operations to support growth"
      }
    ]
  }
}
```

#### POST /ai/dashboard/create
Create dashboard from conversation.

**Request:**
```json
{
  "prompt": "Create a sales dashboard showing revenue, top products, and regional breakdown",
  "databaseId": "db_123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "dashboardId": "dash_new_123",
    "charts": [
      { "id": "chart_1", "type": "line", "name": "Revenue Trend" },
      { "id": "chart_2", "type": "bar", "name": "Top Products" },
      { "id": "chart_3", "type": "pie", "name": "Sales by Region" }
    ]
  }
}
```

---

### 7. Users & Teams

#### GET /projects/:projectId/users
List project members.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "user_123",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "admin",
      "joinedAt": "2024-09-15T08:00:00Z",
      "lastActive": "2024-11-03T14:30:00Z"
    }
  ]
}
```

#### POST /projects/:projectId/users/invite
Invite user to project.

**Request:**
```json
{
  "email": "newuser@example.com",
  "role": "member",
  "permissions": {
    "databases": ["db_123"],
    "canCreateDashboards": true
  }
}
```

#### PUT /projects/:projectId/users/:userId
Update user role/permissions.

#### DELETE /projects/:projectId/users/:userId
Remove user from project.

---

### 8. Roles & Permissions

#### GET /projects/:projectId/roles
List all roles in project.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "role_123",
      "name": "Admin",
      "isBuiltIn": true,
      "permissions": {
        "projects": "read",
        "team": "all",
        "databases": "all",
        "dashboards": "all",
        "insights": "all"
      }
    }
  ]
}
```

#### POST /projects/:projectId/roles
Create custom role.

**Request:**
```json
{
  "name": "Analyst",
  "permissions": {
    "projects": "read",
    "team": "read",
    "databases": "update",
    "dashboards": "update",
    "insights": "update"
  },
  "databaseAccess": {
    "databases": ["db_123"],
    "tables": {
      "db_123": ["sales", "products"]
    }
  }
}
```

---

### 9. Settings

#### GET /users/me
Get current user profile.

#### PUT /users/me
Update user profile.

#### GET /projects/:projectId/settings
Get project settings.

#### PUT /projects/:projectId/settings
Update project settings.

#### GET /projects/:projectId/audit-logs
Get audit logs.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "log_123",
      "action": "chart.created",
      "userId": "user_123",
      "userName": "John Doe",
      "timestamp": "2024-11-03T15:20:00Z",
      "details": {
        "chartId": "chart_456",
        "chartName": "Sales Overview"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 50,
    "total": 234
  }
}
```

---

## Error Responses

All API errors follow this format:

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or expired token",
    "details": {}
  }
}
```

### Error Codes

- `UNAUTHORIZED` (401): Authentication failed
- `FORBIDDEN` (403): Insufficient permissions
- `NOT_FOUND` (404): Resource not found
- `VALIDATION_ERROR` (422): Invalid request data
- `RATE_LIMIT` (429): Too many requests
- `SERVER_ERROR` (500): Internal server error
- `DATABASE_ERROR` (503): Database connection failed

---

## Rate Limiting

- Authentication endpoints: 5 requests/minute
- Query execution: 60 requests/minute
- Other endpoints: 100 requests/minute

**Rate Limit Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1699027200
```

---

## Pagination

List endpoints support pagination:

**Query Parameters:**
- `page`: Page number (default: 1)
- `pageSize`: Items per page (default: 20, max: 100)
- `sortBy`: Field to sort by
- `sortOrder`: `asc` or `desc`

**Response:**
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 145,
    "totalPages": 8
  }
}
```

---

## Filtering & Search

Most list endpoints support filtering:

**Query Parameters:**
- `search`: Full-text search
- `filter[field]`: Filter by field value
- `dateFrom`: Start date filter
- `dateTo`: End date filter

**Example:**
```
GET /projects/proj_123/charts?search=revenue&filter[type]=line&dateFrom=2024-10-01
```

---

## Webhooks (Planned)

Subscribe to events:
- `dashboard.created`
- `chart.updated`
- `insight.generated`
- `user.invited`

---

**Last Updated**: November 2024  
**Version**: 1.0.0
