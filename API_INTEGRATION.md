# Backend API Integration Guide

This document describes the backend API integration that has been implemented in the frontend.

## Overview

The frontend has been integrated with the FastAPI backend located in `Viz-AI-Backend/`. All mock API implementations have been replaced with real API calls.

## Configuration

### Environment Variables

Create a `.env` file in the frontend root directory (`VizAI Analytics Portal Design/`) with the following:

```env
VITE_API_BASE_URL=http://localhost:8000
```

For production, update this to your production API URL:
```env
VITE_API_BASE_URL=https://api.yourdomain.com
```

### Default Configuration

If `VITE_API_BASE_URL` is not set, the API client defaults to `http://localhost:8000`.

## Authentication

### Token Management

- **Access Token**: Stored in `localStorage` with key `vizai_access_token`
- **Refresh Token**: Stored in `localStorage` with key `vizai_refresh_token`
- **Auto-Refresh**: The API client automatically refreshes expired tokens on 401 responses

### Login Flow

1. User enters username and password
2. Frontend calls `POST /api/v1/auth/login`
3. Backend returns `access_token` and `refresh_token`
4. Tokens are stored in localStorage
5. All subsequent API calls include `Authorization: Bearer {access_token}` header

### API Endpoints Used

- `POST /api/v1/auth/login` - User authentication
- `POST /api/v1/auth/register-super-admin` - User registration
- `POST /api/v1/auth/refresh-token` - Token refresh

## API Integration Status

### ✅ Completed

- **Authentication**: Login, Register, Logout, Token Refresh
- **Projects**: Get, Create, Update, Delete
- **Dashboards**: Get, Create
- **Charts**: Get, Create, Get Chart Data
- **Databases**: Get, Create, Test Connection
- **Users/Teams**: Get Team Members
- **Roles**: Get Roles, Create Role

### ⚠️ Partially Implemented

- **Charts**: Chart data fetching requires chart query to be passed separately
- **Database Schema**: Schema endpoint not available in backend yet
- **Insights**: Insight generation endpoint not available in backend yet
- **Audit Logs**: Audit log endpoint not available in backend yet

## Backend API Routes

The backend uses the following route prefixes:

- `/api/v1/auth` - Authentication routes
- `/api/v1/backend` - Main backend routes (projects, dashboards, charts, etc.)
- `/api/v1/llm` - LLM and spreadsheet routes

## Request/Response Format

### Request Format

All authenticated requests include:
```http
Authorization: Bearer {access_token}
Content-Type: application/json
```

### Response Format

The API client wraps all responses in a consistent format:
```typescript
{
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}
```

## Error Handling

- **401 Unauthorized**: Automatically attempts token refresh
- **Network Errors**: Returns error object with descriptive message
- **Backend Errors**: Extracts error message from `detail` field in response

## Usage Examples

### Login
```typescript
import { login } from './services/api';

const result = await login({
  username: 'johndoe',
  password: 'password123'
});

if (result.success) {
  // User authenticated
  const token = result.data.token;
}
```

### Get Projects
```typescript
import { getProjects } from './services/api';

const result = await getProjects();
if (result.success && result.data) {
  const projects = result.data;
}
```

### Create Project
```typescript
import { createProject } from './services/api';

const result = await createProject({
  name: 'My Project',
  description: 'Project description'
});
```

## Backend Requirements

Ensure your backend is:

1. Running on `http://localhost:8000` (or update `VITE_API_BASE_URL`)
2. CORS configured to allow requests from frontend origin
3. Database connected and migrations applied
4. JWT tokens properly configured

## Testing

1. Start the backend server:
   ```bash
   cd Viz-AI-Backend
   uvicorn app.main:app --reload
   ```

2. Start the frontend:
   ```bash
   cd "VizAI Analytics Portal Design"
   yarn dev
   ```

3. Test login with valid credentials

## Notes

- The backend uses `username` for login (not `email`)
- Some endpoints may return data in different formats than expected - these are mapped in the API client
- Token refresh is handled automatically, but you may need to implement a periodic refresh strategy for long sessions
- Some features like schema fetching and insights generation are not yet available in the backend

