/**
 * VizAI API Service
 * 
 * This file contains all API interactions for the VizAI application.
 * Integrated with the FastAPI backend.
 */

import type { ChartType } from "../components/features/charts/core/chartTypes";

// ============================================================================
// CONFIGURATION
// ============================================================================

// Get API base URL from environment or use default
const getApiBaseUrl = (): string => {
  // @ts-ignore - Vite environment variables
  const env = typeof import.meta !== 'undefined' ? import.meta.env : undefined;
  if (env && env.VITE_API_BASE_URL) {
    return env.VITE_API_BASE_URL;
  }
  return 'http://localhost:8000';
};

export const API_BASE_URL = getApiBaseUrl();

// Token storage keys
const ACCESS_TOKEN_KEY = 'vizai_access_token';
const REFRESH_TOKEN_KEY = 'vizai_refresh_token';

/**
 * Get stored access token
 */
const getAccessToken = (): string | null => {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
};

/**
 * Get stored refresh token
 */
const getRefreshToken = (): string | null => {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
};

/**
 * Store tokens
 */
const setTokens = (accessToken: string, refreshToken: string): void => {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
};

/**
 * Clear tokens
 */
const clearTokens = (): void => {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
};

/**
 * Generic API response type
 */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

/**
 * Backend error response
 */
interface BackendError {
  detail: string;
  message?: string;
}

/**
 * Make API request with authentication
 * @param endpoint - API endpoint path
 * @param options - Fetch options
 * @param timeout - Request timeout in milliseconds (default: 60 seconds)
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  timeout: number = 60000 // Default 60 seconds
): Promise<T> {
  const token = getAccessToken();
  const url = `${API_BASE_URL}${endpoint}`;

  // Determine if endpoint is public (doesn't need authentication)
  const publicEndpoints = ['/auth/login', '/auth/register-super-admin', '/auth/refresh-token'];
  const isPublicEndpoint = publicEndpoints.some(ep => endpoint.includes(ep));

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  // Add token to all endpoints except public ones
  if (token && !isPublicEndpoint) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Create an AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include', // Include cookies for CORS
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Handle token refresh on 401
    if (response.status === 401 && token && !isPublicEndpoint) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        // Retry with new token
        const newToken = getAccessToken();
        if (newToken) {
          headers['Authorization'] = `Bearer ${newToken}`;
          const retryController = new AbortController();
          const retryTimeoutId = setTimeout(() => retryController.abort(), timeout);
          try {
            const retryResponse = await fetch(url, {
              ...options,
              headers,
              credentials: 'include',
              signal: retryController.signal,
            });
            clearTimeout(retryTimeoutId);
            return handleResponse<T>(retryResponse);
          } catch (retryError: any) {
            clearTimeout(retryTimeoutId);
            if (retryError.name === 'AbortError') {
              throw new Error(`Request timeout after ${timeout / 1000} seconds`);
            }
            throw retryError;
          }
        }
      }
      // Refresh failed, clear tokens
      clearTokens();
      throw new Error('Authentication failed. Please login again.');
    }

    return handleResponse<T>(response);
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout / 1000} seconds. The server may be processing a long-running operation.`);
    }
    throw error;
  }
}

/**
 * Sanitize error message from HTML responses
 */
function sanitizeErrorMessage(errorText: string, statusCode: number): string {
  // If it's HTML, extract meaningful information or provide user-friendly message
  if (errorText.includes('<html>') || errorText.includes('<!DOCTYPE') || errorText.includes('<title>')) {
    // Extract title from HTML if possible
    const titleMatch = errorText.match(/<title>(.*?)<\/title>/i);
    const h1Match = errorText.match(/<h1>(.*?)<\/h1>/i);

    const extractedTitle = titleMatch?.[1] || h1Match?.[1] || '';

    // Map common HTTP error codes to user-friendly messages
    const errorMessages: Record<number, string> = {
      400: 'Invalid request. Please check your input and try again.',
      401: 'Authentication required. Please log in again.',
      403: 'You don\'t have permission to perform this action.',
      404: 'The requested resource was not found.',
      408: 'Request timed out. Please try again.',
      429: 'Too many requests. Please wait a moment and try again.',
      500: 'Server error. Our team has been notified. Please try again later.',
      502: 'Service temporarily unavailable. The server is experiencing issues. Please try again in a moment.',
      503: 'Service unavailable. The server is temporarily down for maintenance.',
      504: 'Request timeout. The server took too long to respond. Please try again.',
    };

    // Use specific message for status code, or generic message
    if (errorMessages[statusCode]) {
      return errorMessages[statusCode];
    }

    // If we extracted a title, try to make it user-friendly
    if (extractedTitle) {
      const cleanTitle = extractedTitle
        .replace(/Bad Gateway/i, 'Service temporarily unavailable')
        .replace(/Gateway Time-out/i, 'Request timeout')
        .replace(/Internal Server Error/i, 'Server error')
        .replace(/Not Found/i, 'Resource not found')
        .replace(/Unauthorized/i, 'Authentication required')
        .replace(/Forbidden/i, 'Access denied');

      return cleanTitle + '. Please try again later.';
    }

    return 'An unexpected error occurred. Please try again later.';
  }

  // If it's not HTML, return as-is (but limit length)
  return errorText.length > 500 ? errorText.substring(0, 500) + '...' : errorText;
}

/**
 * Handle API response
 */
async function handleResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type');

  if (!response.ok) {
    let errorMessage = `HTTP error! status: ${response.status}`;
    try {
      if (contentType?.includes('application/json')) {
        const error: BackendError = await response.json();
        errorMessage = error.detail || error.message || errorMessage;
      } else {
        const errorText = await response.text();
        // Sanitize HTML error messages
        errorMessage = sanitizeErrorMessage(errorText, response.status);
      }
    } catch (parseError) {
      // If we can't parse the error, use status code-based message
      errorMessage = sanitizeErrorMessage('', response.status);
    }
    throw new Error(errorMessage);
  }

  if (contentType?.includes('application/json')) {
    return await response.json();
  }

  return {} as T;
}

/**
 * Refresh access token
 */
async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return false;
  }

  try {
    // Backend expects refresh_token_str as a string in the body
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(refreshToken), // FastAPI will parse this as refresh_token_str
    });

    if (response.ok) {
      const data = await response.json();
      if (data.access_token) {
        localStorage.setItem(ACCESS_TOKEN_KEY, data.access_token);
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

// ============================================================================
// AUTHENTICATION
// ============================================================================

export interface LoginCredentials {
  username: string; // Backend uses username, not email
  password: string;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
}

export interface User {
  id: string;
  username: string;
  name?: string; // Alias for username for compatibility
  email: string;
  role?: string;
  organizationId?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  expiresIn: number;
}

/**
 * Authenticate user with username and password
 */
export const login = async (credentials: LoginCredentials): Promise<ApiResponse<AuthResponse>> => {
  try {
    const response = await apiRequest<{
      message: string;
      user: { id: string; username: string; email: string };
      access_token: string;
      refresh_token: string;
    }>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        username: credentials.username,
        password: credentials.password,
      }),
    });

    // Store tokens
    setTokens(response.access_token, response.refresh_token);

    return {
      success: true,
      data: {
        user: {
          id: response.user.id,
          username: response.user.username,
          name: response.user.username, // Alias for compatibility
          email: response.user.email,
          role: 'admin', // Default role, can be enhanced later
        },
        token: response.access_token,
        expiresIn: 3600, // Default, can be decoded from JWT if needed
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'LOGIN_FAILED',
        message: error.message || 'Login failed',
      },
    };
  }
};

/**
 * Get current user details (verify token and restore session)
 */
export const getCurrentUser = async (): Promise<ApiResponse<User>> => {
  try {
    const response = await apiRequest<{
      message: string;
      user: { id: string; username: string; email: string };
    }>('/api/v1/backend/user_profile');

    return {
      success: true,
      data: {
        id: response.user.id,
        username: response.user.username,
        name: response.user.username, // Alias for compatibility
        email: response.user.email,
        role: 'admin', // Default role, can be enhanced later
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'GET_CURRENT_USER_FAILED',
        message: error.message || 'Failed to get current user',
      },
    };
  }
};

/**
 * Register new user account
 */
export const register = async (data: RegisterData): Promise<ApiResponse<AuthResponse>> => {
  try {
    const response = await apiRequest<{
      message: string;
      user: { id: string; username: string; email: string };
      access_token: string;
      refresh_token: string;
    }>('/api/v1/auth/register-super-admin', {
      method: 'POST',
      body: JSON.stringify({
        username: data.username,
        email: data.email,
        password: data.password,
      }),
    });

    // Store tokens
    setTokens(response.access_token, response.refresh_token);

    return {
      success: true,
      data: {
        user: {
          id: response.user.id,
          username: response.user.username,
          name: response.user.username, // Alias for compatibility
          email: response.user.email,
          role: 'admin',
        },
        token: response.access_token,
        expiresIn: 3600,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'REGISTRATION_FAILED',
        message: error.message || 'Registration failed',
      },
    };
  }
};

/**
 * Logout current user
 */
export const logout = async (): Promise<ApiResponse<void>> => {
  clearTokens();
  return { success: true };
};

// ============================================================================
// PROFILE SETTINGS
// ============================================================================

export interface UpdateProfileData {
  username?: string;
  email?: string;
}

export interface UpdateProfileResponse {
  message: string;
  user: {
    id: string;
    username: string;
    email: string;
  };
}

export interface ChangePasswordData {
  current_password: string;
  new_password: string;
}

export interface DeleteAccountData {
  password: string;
}

/**
 * Update user profile (username and/or email)
 */
export const updateProfile = async (data: UpdateProfileData): Promise<ApiResponse<UpdateProfileResponse>> => {
  try {
    const response = await apiRequest<UpdateProfileResponse>('/api/v1/auth/profile/update', {
      method: 'PUT',
      body: JSON.stringify(data),
    });

    return {
      success: true,
      data: response,
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'UPDATE_PROFILE_FAILED',
        message: error.message || 'Failed to update profile',
      },
    };
  }
};

/**
 * Change user password
 */
export const changePassword = async (data: ChangePasswordData): Promise<ApiResponse<{ message: string }>> => {
  try {
    const response = await apiRequest<{ message: string }>('/api/v1/auth/profile/change-password', {
      method: 'PUT',
      body: JSON.stringify(data),
    });

    return {
      success: true,
      data: response,
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'CHANGE_PASSWORD_FAILED',
        message: error.message || 'Failed to change password',
      },
    };
  }
};

/**
 * Delete user account
 */
export const deleteAccount = async (data: DeleteAccountData): Promise<ApiResponse<{ message: string }>> => {
  try {
    const response = await apiRequest<{ message: string }>('/api/v1/auth/profile/delete-account', {
      method: 'DELETE',
      body: JSON.stringify(data),
    });

    // Clear tokens after successful deletion
    clearTokens();

    return {
      success: true,
      data: response,
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'DELETE_ACCOUNT_FAILED',
        message: error.message || 'Failed to delete account',
      },
    };
  }
};

// ============================================================================
// PROJECTS
// ============================================================================

export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt?: string;
  owner?: string;
  memberCount?: number;
  databaseCount?: number;
  dashboardCount?: number;
}

/**
 * Fetch all projects for current user
 */
export const getProjects = async (): Promise<ApiResponse<Project[]>> => {
  try {
    const response = await apiRequest<{
      message: string;
      projects: Array<{
        id: string;
        name: string;
        description: string | null;
        super_user_id: string;
        created_at: string;
        created_at_relative?: string;
        active_dashboards?: number;
        database_connections?: number;
        team_members?: number;
        owners?: Array<any>;
      }>;
    }>('/api/v1/backend/projects');

    return {
      success: true,
      data: response.projects.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description || '',
        createdAt: p.created_at,
        updatedAt: p.created_at,
        owner: p.super_user_id,
        memberCount: p.team_members || 0,
        databaseCount: p.database_connections || 0,
        dashboardCount: p.active_dashboards || 0,
      })),
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'FETCH_PROJECTS_FAILED',
        message: error.message || 'Failed to fetch projects',
      },
    };
  }
};

/**
 * Create new project
 */
export const createProject = async (data: {
  name: string;
  description: string;
  primary_domain: string;
  additional_kpis?: string | null;
}): Promise<ApiResponse<Project>> => {
  try {
    const response = await apiRequest<{
      message: string;
      project: {
        id: string;
        name: string;
        description: string | null;
        super_user_id: string;
        created_at: string;
      };
    }>('/api/v1/backend/create-project', {
      method: 'POST',
      body: JSON.stringify({
        name: data.name,
        description: data.description,
        primary_domain: data.primary_domain,
        additional_kpis: data.additional_kpis ?? null,
      }),
    });

    return {
      success: true,
      data: {
        id: response.project.id,
        name: response.project.name,
        description: response.project.description || '',
        createdAt: response.project.created_at,
        updatedAt: response.project.created_at,
        owner: response.project.super_user_id,
        memberCount: 1,
        databaseCount: 0,
        dashboardCount: 0,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'CREATE_PROJECT_FAILED',
        message: error.message || 'Failed to create project',
      },
    };
  }
};

/**
 * Get project by ID
 */
export const getProject = async (projectId: string): Promise<ApiResponse<Project>> => {
  try {
    const projects = await getProjects();
    if (projects.success && projects.data) {
      const project = projects.data.find((p) => p.id === projectId);
      if (project) {
        return { success: true, data: project };
      }
    }
    throw new Error('Project not found');
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'FETCH_PROJECT_FAILED',
        message: error.message || 'Failed to fetch project',
      },
    };
  }
};

/**
 * Update project
 */
export const updateProject = async (projectId: string, data: Partial<Project>): Promise<ApiResponse<Project>> => {
  try {
    const response = await apiRequest<{
      message: string;
      project: {
        id: string;
        name: string;
        description: string | null;
        super_user_id: string;
        created_at: string;
      };
    }>(`/api/v1/backend/projects/${projectId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: data.name,
        description: data.description,
      }),
    });

    return {
      success: true,
      data: {
        id: response.project.id,
        name: response.project.name,
        description: response.project.description || '',
        createdAt: response.project.created_at,
        updatedAt: new Date().toISOString(),
        owner: response.project.super_user_id,
        memberCount: 0,
        databaseCount: 0,
        dashboardCount: 0,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'UPDATE_PROJECT_FAILED',
        message: error.message || 'Failed to update project',
      },
    };
  }
};

/**
 * Delete project
 */
export const deleteProject = async (projectId: string): Promise<ApiResponse<void>> => {
  try {
    await apiRequest(`/api/v1/backend/projects/${projectId}`, {
      method: 'DELETE',
    });
    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'DELETE_PROJECT_FAILED',
        message: error.message || 'Failed to delete project',
      },
    };
  }
};

// ============================================================================
// DASHBOARDS
// ============================================================================

export interface Dashboard {
  id: string;
  name: string;
  description: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  chartCount: number;
  layout: 'grid' | 'list';
  isPublic: boolean;
  isAutopilot?: boolean;
  kpiQueries?: KpiQueryDescriptor[] | null;
}

/**
 * Get favorite dashboards for the current user
 */
export const getFavorites = async (): Promise<ApiResponse<Array<{
  id: string;
  name: string;
  description: string;
  user_id: string;
}>>> => {
  try {
    const response = await apiRequest<{
      message: string;
      dashboards: Array<{
        id: string;
        name: string;
        description: string;
        user_id: string;
      }>;
    }>('/api/v1/backend/favorites');

    return {
      success: true,
      data: response.dashboards || [],
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'FETCH_FAVORITES_FAILED',
        message: error.message || 'Failed to fetch favorites',
      },
    };
  }
};

/**
 * Get dashboards for a project
 */
export const getDashboards = async (projectId: string): Promise<ApiResponse<Dashboard[]>> => {
  try {
    const response = await apiRequest<Array<{
      id: string;
      title: string;
      description: string | null;
      project_id: string;
      created_by: string;
      is_favorite?: boolean;
      is_autopilot?: boolean;
      kpi_queries?: KpiQueryDescriptor[] | null;
    }> | {
      message: string;
      dashboards: Array<{
        id: string;
        title: string;
        description: string | null;
        project_id: string;
        created_by: string;
        is_favorite?: boolean;
        is_autopilot?: boolean;
        kpi_queries?: KpiQueryDescriptor[] | null;
      }>;
    }>(`/api/v1/backend/projects/${projectId}/users/dashboard`);

    // Handle both response formats: array directly or object with dashboards property
    const dashboardsArray: Array<{
      id: string;
      title: string;
      description: string | null;
      project_id: string;
      created_by: string;
      is_favorite?: boolean;
      is_autopilot?: boolean;
      kpi_queries?: KpiQueryDescriptor[] | null;
    }> = Array.isArray(response)
        ? response
        : (response as any).dashboards || [];

    return {
      success: true,
      data: dashboardsArray.map((d) => ({
        id: d.id,
        name: d.title,
        description: d.description || '',
        projectId: d.project_id,
        createdAt: new Date().toISOString(), // Backend doesn't provide this
        updatedAt: new Date().toISOString(),
        chartCount: 0, // Will need to fetch separately
        layout: 'grid' as const,
        isPublic: false,
        isAutopilot: d.is_autopilot ?? false,
        kpiQueries: d.kpi_queries ?? null,
      })),
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'FETCH_DASHBOARDS_FAILED',
        message: error.message || 'Failed to fetch dashboards',
      },
    };
  }
};

/**
 * Get dashboard charts
 */
export const getDashboardCharts = async (dashboardId: string): Promise<ApiResponse<Array<{
  id: string;
  title: string;
  query: string;
  created_at: string;
  connection_id: string | null;
  status?: string | null;
  chart_type?: string | null;
  x_axis?: string | null;
  y_axis?: string | null;
  is_time_based?: boolean;
}>>> => {
  try {
    const response = await apiRequest<{
      message: string;
      charts: Array<{
        id: string;
        title: string;
        query: string;
        created_at: string;
        connection_id: string | null;
        status?: string | null;
        chart_type?: string | null;
        x_axis?: string | null;
        y_axis?: string | null;
        is_time_based?: boolean;
      }>;
    }>(`/api/v1/backend/dashboards/${dashboardId}/charts`);

    return {
      success: true,
      data: response.charts || [],
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'FETCH_DASHBOARD_CHARTS_FAILED',
        message: error.message || 'Failed to fetch dashboard charts',
      },
    };
  }
};

export interface KpiQueryDescriptor {
  label: string;
  query: string;
  format: 'currency' | 'percentage' | 'number' | 'decimal';
  subtitle: string;
  icon: string;
  connection_id: string | null;
}

/**
 * Execute a raw SQL query against a connection and return the first cell value.
 * Used for KPI infographic scalar queries that return one row and one column.
 */
export const executeKpiQuery = async (
  connectionId: string,
  query: string
): Promise<number | null> => {
  try {
    const response = await apiRequest<{
      data?: any[];
      result?: any[];
      row_count?: number;
    }>(`/api/v1/backend/excecute-query/${connectionId}/`, {
      method: 'POST',
      body: JSON.stringify({ query, response_format: 'tabular' }),
    });

    const rows = Array.isArray(response.result)
      ? response.result
      : Array.isArray(response.data)
        ? response.data
        : [];

    if (rows.length === 0) return null;
    const firstRow = rows[0];
    // The KPI query must return a column named 'value'; fall back to first column
    const val = firstRow['value'] ?? Object.values(firstRow)[0];
    return val !== null && val !== undefined ? Number(val) : null;
  } catch {
    return null;
  }
};

/**
 * Generate (or return cached) KPI infographic queries for an Autopilot Dashboard.
 * On first call the LLM service analyses the schema to produce aggregation SQL.
 * Subsequent calls return the stored list without hitting the LLM unless force=true.
 */
export const generateDashboardKpiQueries = async (
  dashboardId: string,
  data: {
    connection_id: string;
    db_schema?: any;  // optional — backend fetches from connection if omitted
    db_type?: string;  // optional — backend fetches from connection if omitted
    num_kpis?: number;
    force?: boolean;
  }
): Promise<ApiResponse<{ kpi_queries: KpiQueryDescriptor[]; generated: boolean }>> => {
  try {
    const response = await apiRequest<{ kpi_queries: KpiQueryDescriptor[]; generated: boolean }>(
      `/api/v1/backend/dashboards/${dashboardId}/generate-kpi-queries`,
      {
        method: 'POST',
        body: JSON.stringify({
          connection_id: data.connection_id,
          db_schema: data.db_schema ?? null,
          db_type: data.db_type ?? null,
          num_kpis: data.num_kpis ?? 5,
          force: data.force ?? false,
        }),
      }
    );
    return { success: true, data: response };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'GENERATE_KPI_QUERIES_FAILED',
        message: error.message || 'Failed to generate KPI queries',
      },
    };
  }
};

/**
 * Create new dashboard
 */
export const createDashboard = async (
  projectId: string,
  data: {
    name: string;
    description: string;
    is_autopilot?: boolean;
    kpi_goals?: string;
  }
): Promise<ApiResponse<Dashboard>> => {
  try {
    const response = await apiRequest<{
      message: string;
      dashboard: {
        id: string;
        title: string;
        description: string | null;
        project_id: string;
        created_by: string;
        is_autopilot?: boolean;
        kpi_goals?: string | null;
      };
    }>(`/api/v1/backend/projects/${projectId}/dashboard`, {
      method: 'POST',
      body: JSON.stringify({
        dashboard_name: data.name,
        description: data.description,
        is_autopilot: data.is_autopilot ?? false,
        kpi_goals: data.kpi_goals ?? null,
      }),
    });

    return {
      success: true,
      data: {
        id: response.dashboard.id,
        name: response.dashboard.title,
        description: response.dashboard.description || '',
        projectId: response.dashboard.project_id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        chartCount: 0,
        layout: 'grid' as const,
        isPublic: false,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'CREATE_DASHBOARD_FAILED',
        message: error.message || 'Failed to create dashboard',
      },
    };
  }
};

/**
 * Delete a dashboard
 */
export const deleteDashboard = async (projectId: string, dashboardId: string): Promise<ApiResponse<{ message: string }>> => {
  try {
    const response = await apiRequest<{
      message?: string;
    }>(`/api/v1/backend/projects/${projectId}/dashboard/${dashboardId}`, {
      method: 'DELETE',
    });

    return {
      success: true,
      data: {
        message: response.message || 'Dashboard deleted successfully',
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'DELETE_DASHBOARD_FAILED',
        message: error.message || 'Failed to delete dashboard',
      },
    };
  }
};

// ============================================================================
// CHARTS
// ============================================================================

export interface Chart {
  id: string;
  name: string;
  type: ChartType;
  projectId: string;
  databaseId?: string;
  query?: string;
  config: {
    xAxis?: string;
    yAxis?: string;
    color?: string;
    /** Saved series/measure column names for stacked/multi-series charts. */
    seriesKeys?: string[];
  };
  createdAt: string;
  updatedAt: string;
  is_time_based?: boolean;
}

export interface ChartData {
  data: any[];
  metadata: {
    rowCount: number;
    executionTime: number;
    cachedAt: string | null;
    xAxis?: string | null;
    yAxis?: string | null;
  };
}

/** Pass-through to execute-query so the backend returns full tabular rows with optional axis hints. */
export interface ChartDataAxisHints {
  xAxis?: string | null;
  yAxis?: string | null;
}

/**
 * Get charts for a project
 */
export const getCharts = async (projectId: string): Promise<ApiResponse<Chart[]>> => {
  try {
    const response = await apiRequest<{
      message?: string;
      charts?: Array<{
        id: string;
        title: string;
        query: string;
        type: string; // Backend uses 'type' which is actually chart_type
        datasourceConnectionId: string | null; // Backend uses camelCase
        data_connection_id?: string | null; // Alternative field name
        created_at: string;
        isFavorite?: boolean;
        x_axis?: string | null;
        y_axis?: string | null;
        series_keys?: string[] | null;
        is_time_based?: boolean;
      }>;
    }>(`/api/v1/backend/charts?project_id=${projectId}`);

    // Handle both response formats: object with charts array or direct array
    const chartsArray = response.charts || (Array.isArray(response) ? response : []);

    return {
      success: true,
      data: chartsArray
        // Include all charts — don't drop charts that lack a connection ID here;
        // ChartsView already handles "missing query/connection" gracefully.
        .map((chart) => {
          const connectionId = chart.datasourceConnectionId || chart.data_connection_id || undefined;
          return {
            id: chart.id,
            name: chart.title,
            type: mapChartType(chart.type), // Backend returns 'type' which is chart_type
            projectId, // Will need to get from backend or context
            databaseId: connectionId,
            query: chart.query,
            config: {
              xAxis: chart.x_axis ?? undefined,
              yAxis: chart.y_axis ?? undefined,
              // Restore series keys for stacked/multi-series charts
              ...(chart.series_keys && chart.series_keys.length > 0
                ? { seriesKeys: chart.series_keys }
                : {}),
            },
            createdAt: chart.created_at,
            updatedAt: chart.created_at,
            is_time_based: chart.is_time_based ?? false,
          };
        }),
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'FETCH_CHARTS_FAILED',
        message: error.message || 'Failed to fetch charts',
      },
    };
  }
};

/**
 * Get charts for dashboards the current user has access to
 */
export const getUserDashboardCharts = async (): Promise<ApiResponse<Array<{
  dashboardId: string;
  dashboardTitle: string;
  projectId: string;
  charts: Array<{
    id: string;
    title: string;
    created_at: string | null;
    chart_type?: string | null;
    type?: string | null;
    status?: string | null;
    database_connection_id?: string | null;
    database_connection?: {
      id: string;
      name: string;
      type?: string;
    } | null;
    query?: string | null;
    x_axis?: string | null;
    y_axis?: string | null;
    is_time_based?: boolean;
  }>;
}>>> => {
  try {
    const response = await apiRequest<{
      message?: string;
      dashboards?: Array<{
        dashboard_id: string;
        dashboard_title: string;
        project_id: string;
        charts: Array<{
          id: string;
          title: string;
          created_at: string | null;
          chart_type?: string | null;
          type?: string | null;
          status?: string | null;
          database_connection_id?: string | null;
          database_connection?: {
            id: string;
            name: string;
            type?: string;
          } | null;
          query?: string | null;
          x_axis?: string | null;
          y_axis?: string | null;
          is_time_based?: boolean;
        }>;
      }>;
    }>('/api/v1/backend/dashboards/user/charts');

    const dashboardsArray = response.dashboards || [];

    return {
      success: true,
      data: dashboardsArray.map((dashboard) => ({
        dashboardId: dashboard.dashboard_id,
        dashboardTitle: dashboard.dashboard_title,
        projectId: dashboard.project_id,
        charts: dashboard.charts || [],
      })),
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'FETCH_USER_DASHBOARD_CHARTS_FAILED',
        message: error.message || 'Failed to fetch dashboard charts for user',
      },
    };
  }
};

/**
 * Map backend chart type to frontend type
 */
function mapChartType(backendType?: string | null): ChartType {
  if (!backendType) {
    return 'line';
  }
  const normalized = backendType.toString().toLowerCase();
  const typeMap: Record<string, ChartType> = {
    line: 'line',
    bar: 'bar',
    pie: 'pie',
    area: 'area',
    scatter: 'scatter',
    heatmap: 'heatmap',
    funnel: 'funnel',
    map: 'map',
    stackedlinechart: 'stackedlinechart',
    stacked_line_chart: 'stackedlinechart',
    stackedhorizontalbar: 'stackedhorizontalbar',
    stacked_horizontal_bar: 'stackedhorizontalbar',
    clustering: 'clustering',
    cluster: 'clustering',
    clustering_chart: 'clustering',
    multiyaxischart: 'multiyaxischart',
    multi_y_axis_chart: 'multiyaxischart',
    multiyaxis: 'multiyaxischart',
    donut: 'donut',
  };
  return typeMap[normalized] || 'line';
}

/**
 * Create new chart
 */
export const createChart = async (projectId: string, data: Partial<Chart>): Promise<ApiResponse<Chart>> => {
  try {
    const requestBody: Record<string, any> = {
      title: data.name || 'New Chart',
      query: data.query || '',
      chart_type: data.type || 'line',
      type: data.type || 'line',
      data_connection_id: data.databaseId,
      is_time_based: data.is_time_based ?? false,
    };

    if (data.config?.xAxis) {
      requestBody.x_axis = data.config.xAxis;
    }
    if (data.config?.yAxis) {
      requestBody.y_axis = data.config.yAxis;
    }
    // Send series keys so stacked-chart layout can be restored on reload
    const seriesKeys = (data.config as any)?.seriesKeys;
    if (Array.isArray(seriesKeys) && seriesKeys.length > 0) {
      requestBody.series_keys = seriesKeys;
    }

    const response = await apiRequest<{
      id?: string;
      chart_id?: string;
      title?: string;
      query?: string;
      chart_type?: string;
      message?: string;
    }>(`/api/v1/backend/projects/${projectId}/save-chart`, {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    const savedId = response.id ?? response.chart_id;
    const savedTitle = response.title ?? (requestBody.title as string) ?? data.name ?? 'New Chart';
    const savedQuery =
      response.query !== undefined && response.query !== null
        ? response.query
        : (data.query ?? '');
    const savedChartType = response.chart_type ?? (requestBody.chart_type as string) ?? data.type ?? 'line';

    if (!savedId) {
      return {
        success: false,
        error: {
          code: 'CREATE_CHART_INVALID_RESPONSE',
          message:
            'Chart was saved but the server did not return a chart id. Refresh the page or update the backend.',
        },
      };
    }

    return {
      success: true,
      data: {
        id: savedId,
        name: savedTitle,
        type: mapChartType(savedChartType),
        projectId,
        databaseId: data.databaseId,
        query: savedQuery,
        config: {
          xAxis: data.config?.xAxis,
          yAxis: data.config?.yAxis,
          color: data.config?.color,
          // Preserve series keys so stacked chart layout survives a refresh
          ...((data.config as any)?.seriesKeys?.length
            ? { seriesKeys: (data.config as any).seriesKeys }
            : {}),
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'CREATE_CHART_FAILED',
        message: error.message || 'Failed to create chart',
      },
    };
  }
};

/**
 * Add chart to dashboard
 * Note: This creates a new chart and associates it with the dashboard
 */
export const addChartToDashboard = async (data: {
  title: string;
  query: string;
  chart_type: ChartType;
  dashboard_id: string;
  data_connection_id: string; // Required - must be a valid UUID
  report?: string;
  type?: string;
  relevance?: string;
  is_time_based?: boolean;
  x_axis?: string | null;
  y_axis?: string | null;
  series_keys?: string[];
}): Promise<ApiResponse<{ chart_id: string }>> => {
  try {
    // Prepare request body - only include fields that have values
    const requestBody: any = {
      title: data.title,
      query: data.query,
      type: data.type || data.chart_type,
      is_time_based: data.is_time_based ?? false,
      chart_type: data.chart_type,
      dashboard_id: data.dashboard_id,
      data_connection_id: data.data_connection_id,
    };

    // Only include report if it has a value (not empty string)
    if (data.report && data.report.trim() !== '') {
      requestBody.report = data.report;
    }

    // Only include relevance if it has a valid numeric value
    // Convert string to number if provided, otherwise omit the field
    if (data.relevance && data.relevance.trim() !== '') {
      const relevanceValue = parseFloat(data.relevance);
      if (!isNaN(relevanceValue)) {
        requestBody.relevance = relevanceValue;
      }
    }

    if (data.x_axis) {
      requestBody.x_axis = data.x_axis;
    }
    if (data.y_axis) {
      requestBody.y_axis = data.y_axis;
    }
    if (Array.isArray(data.series_keys) && data.series_keys.length > 0) {
      requestBody.series_keys = data.series_keys;
    }

    const response = await apiRequest<{
      message: string;
      chart_id: string;
    }>('/api/v1/backend/charts/save-to-dashboard', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    return {
      success: true,
      data: {
        chart_id: response.chart_id,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'ADD_CHART_TO_DASHBOARD_FAILED',
        message: error.message || 'Failed to add chart to dashboard',
      },
    };
  }
};

/**
 * Get chart data (execute query)
 * Uses cache to reduce API calls for the same queries
 * @param bypassCache - If true, bypasses cache and always fetches fresh data
 */
export const getChartData = async (
  chartId: string,
  datasourceConnectionId: string,
  query: string,
  fromDate?: string,
  toDate?: string,
  bypassCache: boolean = false,
  axisHints?: ChartDataAxisHints | null
): Promise<ApiResponse<ChartData>> => {
  // Import cache utilities
  const { getCachedChartData, setCachedChartData, clearChartCache } = await import('../utils/chartDataCache');

  // Check cache first (unless bypassing)
  if (!bypassCache) {
    const cachedData = getCachedChartData(chartId, datasourceConnectionId, query, fromDate, toDate);
    if (cachedData) {
      return {
        success: true,
        data: cachedData,
      };
    }
  } else {
    // Clear cache if bypassing to ensure fresh data
    clearChartCache(chartId, datasourceConnectionId, query, fromDate, toDate);
  }

  try {
    const requestBody: {
      query: string;
      from_date?: string;
      to_date?: string;
      response_format: 'tabular' | 'legacy';
      x_axis?: string | null;
      y_axis?: string | null;
    } = {
      query: query,
      response_format: 'tabular',
    };

    if (fromDate) {
      requestBody.from_date = fromDate;
    }
    if (toDate) {
      requestBody.to_date = toDate;
    }
    const xHint = axisHints?.xAxis?.trim();
    const yHint = axisHints?.yAxis?.trim();
    if (xHint) {
      requestBody.x_axis = xHint;
    }
    if (yHint) {
      requestBody.y_axis = yHint;
    }

    const response = await apiRequest<{
      data?: any[];
      row_count?: number;
      result?: any[];
      x_axis?: string | null;
      y_axis?: string | null;
      execution_time_ms?: number;
      cached_at?: string | null;
    }>(`/api/v1/backend/excecute-query/${datasourceConnectionId}/`, {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    const normalizedData = Array.isArray(response.result)
      ? response.result
      : Array.isArray(response.data)
        ? response.data
        : [];

    const chartData: ChartData = {
      data: normalizedData,
      metadata: {
        rowCount: response.row_count ?? normalizedData.length ?? 0,
        executionTime: response.execution_time_ms ?? 0,
        cachedAt: response.cached_at ?? null,
        xAxis: response.x_axis ?? null,
        yAxis: response.y_axis ?? null,
      },
    };

    // Store in cache for future use (5 minute TTL)
    setCachedChartData(chartId, datasourceConnectionId, query, chartData, 5 * 60 * 1000, fromDate, toDate);

    return {
      success: true,
      data: chartData,
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'FETCH_CHART_DATA_FAILED',
        message: error.message || 'Failed to fetch chart data',
      },
    };
  }
};

/**
 * Filter charts by dashboard ID, database connection, or status
 */
export const filterCharts = async (filters: {
  dashboardId?: string;
  databaseConnectionId?: string;
  status?: 'draft' | 'published';
}): Promise<ApiResponse<Array<{
  id: string;
  title: string;
  query: string;
  chart_type: string;
  type: string;
  created_at: string;
  database_connection_id: string;
  database_connection_name?: string;
  status: string;
  is_favorite: boolean;
  dashboards: Array<{ id: string; title: string }>;
  dashboard_count: number;
}>>> => {
  try {
    const queryParams = new URLSearchParams();
    if (filters.dashboardId) {
      queryParams.append('dashboard_id', filters.dashboardId);
    }
    if (filters.databaseConnectionId) {
      queryParams.append('database_connection_id', filters.databaseConnectionId);
    }
    if (filters.status) {
      queryParams.append('status', filters.status);
    }

    const response = await apiRequest<{
      message: string;
      charts: Array<{
        id: string;
        title: string;
        query: string;
        chart_type: string;
        type: string;
        created_at: string;
        database_connection_id: string;
        database_connection_name?: string;
        status: string;
        is_favorite: boolean;
        dashboards: Array<{ id: string; title: string }>;
        dashboard_count: number;
      }>;
      total_count: number;
      filters_applied: Record<string, any>;
    }>(`/api/v1/backend/charts/filter?${queryParams.toString()}`);

    return {
      success: true,
      data: response.charts || [],
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'FILTER_CHARTS_FAILED',
        message: error.message || 'Failed to filter charts',
      },
    };
  }
};

/**
 * Get favorite charts for the current user
 */
export const getFavoriteCharts = async (): Promise<ApiResponse<Array<{
  id: string;
  title: string;
  created_at: string;
  connection_id: string;
  query: string;
  chart_type: string;
  status?: string;
  is_favorite?: boolean;
}>>> => {
  try {
    const response = await apiRequest<{
      message: string;
      favorite_charts: Array<{
        id: string;
        title: string;
        created_at: string;
        connection_id: string;
        query: string;
        chart_type: string;
        status?: string;
        is_favorite?: boolean;
      }>;
    }>('/api/v1/backend/users/charts/favorite');

    return {
      success: true,
      data: response.favorite_charts || [],
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'FETCH_FAVORITE_CHARTS_FAILED',
        message: error.message || 'Failed to fetch favorite charts',
      },
    };
  }
};

/**
 * Update favorite status of a chart (toggle pin/unpin)
 */
export const updateFavoriteChart = async (chartId: string): Promise<ApiResponse<{ is_favorite: boolean }>> => {
  try {
    const response = await apiRequest<{
      message: string;
      is_favorite: boolean;
    }>('/api/v1/backend/charts/favorite', {
      method: 'PATCH',
      body: JSON.stringify({
        chart_id: chartId,
      }),
    });

    return {
      success: true,
      data: {
        is_favorite: response.is_favorite,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'UPDATE_FAVORITE_CHART_FAILED',
        message: error.message || 'Failed to update favorite chart status',
      },
    };
  }
};

/**
 * Delete a chart
 * If dashboardId is provided, deletes the chart from that specific dashboard.
 * Otherwise, deletes the chart entirely using the general delete endpoint.
 */
export const deleteChart = async (chartId: string, dashboardId?: number | string): Promise<ApiResponse<{ message: string }>> => {
  try {
    // If dashboardId is provided, use the delete from dashboard endpoint
    if (dashboardId) {
      const dashboardIdStr = typeof dashboardId === 'string' ? dashboardId : String(dashboardId);
      const response = await apiRequest<{
        message: string;
      }>(`/api/v1/backend/dashboards/${dashboardIdStr}/charts/${chartId}`, {
        method: 'DELETE',
      });

      return {
        success: true,
        data: {
          message: response.message || 'Chart deleted successfully',
        },
      };
    }

    // Delete chart directly using general delete endpoint
    const response = await apiRequest<{
      message: string;
    }>(`/api/v1/backend/charts/${chartId}`, {
      method: 'DELETE',
    });

    return {
      success: true,
      data: {
        message: response.message || 'Chart deleted successfully',
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'DELETE_CHART_FAILED',
        message: error.message || 'Failed to delete chart',
      },
    };
  }
};

// ============================================================================
// DATABASES
// ============================================================================

export interface Database {
  id: string;
  name: string;
  type: 'postgresql' | 'mysql' | 'spreadsheet' | string;
  host: string;
  port: number;
  database: string;
  username: string;
  status: 'connected' | 'disconnected' | 'error';
  lastChecked: string;
  schema?: string | null;
  dsGraphJson?: string | null;
  hasDsGraph?: boolean;
  connectionString?: string | null;
  consentGiven?: boolean;
}

export interface DSGraphNode {
  id: string;
  label: string;
  table: string;
  schema?: string | null;
  catalog?: string | null;
  column_count: number;
  columns: Array<{ name: string; type: string; is_primary_key: boolean }>;
  pk_columns: string[];
}

export interface DSGraphEdge {
  id: string;
  source: string;
  target: string;
  source_column: string;
  target_column: string;
  label: string;
  relationship_type: string;
}

export interface DSGraphPayload {
  nodes: DSGraphNode[];
  edges: DSGraphEdge[];
  stats: {
    table_count: number;
    relation_count: number;
    orphan_table_count: number;
  };
}

export interface OntologyNode {
  id: string;
  label: string;
  type: string;
  meta?: Record<string, any>;
}

export interface OntologyEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  type: string;
  meta?: Record<string, any>;
}

export interface OntologyGraphPayload {
  nodes: OntologyNode[];
  edges: OntologyEdge[];
  stats: Record<string, number>;
}

export interface OntologyQuestion {
  question_id: string;
  target_term: string;
  question: string;
  reason: string;
  answer_type: "single_select" | "multi_select" | "text";
  options: string[];
  priority: number;
}

export interface OntologyVersionPayload {
  ontology_version_id: string;
  version_label: string;
  status: string;
  is_base: boolean;
  graph: OntologyGraphPayload;
  ontology: Record<string, any>;
}

export interface StartOntologyEnrichmentPayload {
  session_id: string;
  ontology_version_id: string;
  initial_message: string;
}

export interface EnrichmentChatPayload {
  session_id: string;
  assistant_message: string;
  extracted_updates: Record<string, any>;
  chat_history: Array<{ role: string; content: string }>;
}

export interface DatabaseSchema {
  tables: {
    name: string;
    rowCount: number;
    columns: {
      name: string;
      type: string;
      nullable: boolean;
    }[];
  }[];
}

export interface DatabaseCreationTask {
  taskId: string;
  tablesCount: number;
  connectionId?: string;
}

/**
 * Get database connections for project
 */
export const getDatabases = async (projectId: string): Promise<ApiResponse<Database[]>> => {
  try {
    const response = await apiRequest<{
      message?: string;
      connections?: Array<{
        id: string;
        name: string;
        db_type: string;
        db_host_link?: string;
        db_name?: string;
        db_username?: string;
        project_id: string;
        consent_given?: boolean;
        db_schema?: string;
        ds_graph_json?: string;
        has_ds_graph?: boolean;
        db_connection_string?: string;
      }>;
    }>(`/api/v1/backend/connections/${projectId}`);

    // Handle response format: object with connections array
    let connectionsArray: Array<{
      id: string;
      name: string;
      db_type: string;
      db_host_link?: string;
      db_name?: string;
      db_username?: string;
      project_id: string;
      consent_given?: boolean;
      db_schema?: string;
      ds_graph_json?: string;
      has_ds_graph?: boolean;
      db_connection_string?: string;
    }> = [];

    if (response.connections && Array.isArray(response.connections)) {
      connectionsArray = response.connections;
    }

    return {
      success: true,
      data: connectionsArray.map((conn) => ({
        id: conn.id, // Backend returns 'id', which is the UUID
        name: conn.name, // Backend returns 'name', not 'connection_name'
        type: conn.db_type || 'postgresql',
        host: conn.db_host_link || '',
        port: 5432, // Default, not provided by backend
        database: conn.db_name || '',
        username: conn.db_username || '',
        status: 'connected' as const,
        lastChecked: new Date().toISOString(), // Backend doesn't provide created_at in this response
        schema: conn.db_schema ?? null,
        dsGraphJson: conn.ds_graph_json ?? null,
        hasDsGraph: conn.has_ds_graph ?? undefined,
        connectionString: conn.db_connection_string ?? null,
        consentGiven: conn.consent_given ?? undefined,
      })),
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'FETCH_DATABASES_FAILED',
        message: error.message || 'Failed to fetch databases',
      },
    };
  }
};

/**
 * Create database connection
 *
 * @param projectId - The project ID
 * @param data - Database connection data. Can include:
 *   - connectionString: Full connection string (e.g., "postgresql://user:pass@host:port/db")
 *   - OR form fields: connectionName, dbType, host, port, database, username, password
 *   - Salesforce OAuth2 fields: sessionId, instanceUrl
 *   - Databricks fields: workspaceUrl, httpPath, catalogName, schemaName, accessToken
 */
export const createDatabase = async (
  projectId: string,
  data: {
    connectionString?: string;
    connectionName?: string;
    dbType?: string;
    host?: string;
    port?: number | string;
    database?: string;
    username?: string;
    password?: string;
    consentGiven?: boolean;
    // Salesforce OAuth2 fields (session-based authentication only)
    sessionId?: string;
    instanceUrl?: string;
    // Databricks fields
    workspaceUrl?: string;
    httpPath?: string;
    catalogName?: string;
    schemaName?: string;
    accessToken?: string;
  }
): Promise<ApiResponse<DatabaseCreationTask>> => {
  try {
    // Prepare request body based on whether connection string or form fields are provided
    const requestBody: any = {
      connection_name: data.connectionName || '',
    };

    if (data.connectionString) {
      // Use connection string method
      requestBody.connection_string = data.connectionString;
      // Extract db_type from connection string if not provided
      if (data.connectionString.startsWith('postgresql://')) {
        requestBody.db_type = 'postgres';
      } else if (data.connectionString.startsWith('mysql://')) {
        requestBody.db_type = 'mysql';
      }
    } else {
      // Use form fields method
      // Backend expects "postgres" not "postgresql", "oracledb" not "oracle", and "salesforce" as-is
      let dbType = data.dbType?.toLowerCase() || 'postgres';
      if (dbType === 'postgresql') {
        dbType = 'postgres';
      } else if (dbType === 'oracle') {
        dbType = 'oracledb';
      } else if (dbType === 'salesforce') {
        dbType = 'salesforce';
      } else if (dbType === 'databricks') {
        dbType = 'databricks';
      }

      requestBody.connection_name = data.connectionName || '';
      requestBody.db_type = dbType;

      // Handle Salesforce connections (OAuth2 session-based authentication only)
      if (dbType === 'salesforce') {
        // Salesforce uses session_id (OAuth access_token) and instance_url
        if (data.sessionId) {
          requestBody.session_id = data.sessionId;
        }
        if (data.instanceUrl) {
          requestBody.instance_url = data.instanceUrl;
        }
      } else if (dbType === 'databricks') {
        requestBody.workspace_url = data.workspaceUrl || '';
        requestBody.http_path = data.httpPath || '';
        requestBody.catalog_name = data.catalogName || '';
        requestBody.schema_name = data.schemaName || '';
        requestBody.access_token = data.accessToken || '';
      } else {
        // Traditional database fields
        // Construct host with port if port is provided and different from default
        let hostWithPort = data.host || '';
        if (data.port) {
          const portStr = String(data.port).trim();
          if (portStr) {
            const portNum = parseInt(portStr);
            if (!isNaN(portNum)) {
              const defaultPort = dbType === 'postgres' ? 5432 : dbType === 'mysql' ? 3306 : 1521;

              // Only append port if it's different from default and not already in host
              if (portNum !== defaultPort && !hostWithPort.includes(':')) {
                hostWithPort = `${hostWithPort}:${portNum}`;
              }
            }
          }
        }

        requestBody.host = hostWithPort;
        requestBody.db_name = data.database || '';
        // Backend accepts both 'username' and 'name', send 'username' to match expected payload format
        requestBody.username = data.username || '';
        requestBody.password = data.password || '';
        if (data.schemaName) {
          requestBody.schema_name = data.schemaName;
        }
      }
    }

    if (data.consentGiven !== undefined) {
      requestBody.consent_given = data.consentGiven;
    }

    const response = await apiRequest<{
      taskId: string;
      tablesCount: number;
      connectionId?: string;
    }>(`/api/v1/backend/database/${projectId}`, {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    return {
      success: true,
      data: {
        taskId: response.taskId,
        tablesCount: response.tablesCount,
        connectionId: response.connectionId,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'CREATE_DATABASE_FAILED',
        message: error.message || 'Failed to create database connection',
      },
    };
  }
};

/**
 * Delete database connection
 */
export const deleteConnection = async (connectionId: string): Promise<ApiResponse<{ message: string }>> => {
  try {
    const response = await apiRequest<{ message: string }>(
      `/api/v1/backend/connections/${connectionId}`,
      {
        method: 'DELETE',
      }
    );

    return {
      success: true,
      data: response,
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'DELETE_CONNECTION_FAILED',
        message: error.message || 'Failed to delete database connection',
      },
    };
  }
};

/**
 * Update database connection
 */
export const updateConnection = async (
  connectionId: string,
  data: {
    connection_name?: string;
    db_connection_string?: string;
    db_schema?: string;
    db_username?: string;
    db_password?: string;
    db_host_link?: string;
    db_name?: string;
    db_type?: string;
  }
): Promise<ApiResponse<{ message: string }>> => {
  try {
    const response = await apiRequest<{ message: string }>(
      `/api/v1/backend/connections/${connectionId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(data),
      }
    );

    return {
      success: true,
      data: response,
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'UPDATE_CONNECTION_FAILED',
        message: error.message || 'Failed to update database connection',
      },
    };
  }
};

/**
 * Test database connection
 */
export const testDatabaseConnection = async (config: Partial<Database>): Promise<ApiResponse<{ connected: boolean; latency: number; version: string }>> => {
  try {
    // Backend doesn't have a dedicated test endpoint, so we'll simulate
    // In a real scenario, you'd call a test endpoint or try to fetch schema
    return {
      success: true,
      data: {
        connected: true,
        latency: 45,
        version: config.type === 'postgresql' ? 'PostgreSQL 14.5' : 'MySQL 8.0.30',
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'TEST_CONNECTION_FAILED',
        message: error.message || 'Failed to test connection',
      },
    };
  }
};

/**
 * Get database schema
 */
export const getDatabaseSchema = async (databaseId: string): Promise<ApiResponse<DatabaseSchema>> => {
  try {
    // This endpoint doesn't exist in backend yet, returning mock
    // You'll need to implement this endpoint or use the read_data_service
    return {
      success: true,
      data: {
        tables: [],
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'FETCH_SCHEMA_FAILED',
        message: error.message || 'Failed to fetch schema',
      },
    };
  }
};

export const getDatabaseDSGraph = async (
  connectionId: string
): Promise<ApiResponse<DSGraphPayload>> => {
  try {
    const response = await apiRequest<{
      message: string;
      graph: DSGraphPayload;
    }>(`/api/v1/backend/connections/${connectionId}/ds-graph`);

    return {
      success: true,
      data: response.graph,
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: "FETCH_DS_GRAPH_FAILED",
        message: error.message || "Failed to fetch datasource graph",
      },
    };
  }
};

export const bootstrapOntology = async (
  connectionId: string
): Promise<ApiResponse<OntologyVersionPayload>> => {
  try {
    const response = await apiRequest<OntologyVersionPayload>(
      `/api/v1/backend/connections/${connectionId}/ontology/bootstrap`,
      { method: "POST" }
    );
    return { success: true, data: response };
  } catch (error: any) {
    return {
      success: false,
      error: { code: "BOOTSTRAP_ONTOLOGY_FAILED", message: error.message || "Failed to bootstrap ontology" },
    };
  }
};

export const getLatestOntology = async (
  connectionId: string
): Promise<ApiResponse<OntologyVersionPayload>> => {
  try {
    const response = await apiRequest<OntologyVersionPayload>(
      `/api/v1/backend/connections/${connectionId}/ontology/latest`,
      { method: "GET" }
    );
    return { success: true, data: response };
  } catch (error: any) {
    return {
      success: false,
      error: { code: "GET_LATEST_ONTOLOGY_FAILED", message: error.message || "Failed to fetch latest ontology" },
    };
  }
};

export const downloadLatestOntologyTTL = async (connectionId: string): Promise<ApiResponse<string>> => {
  try {
    const token = localStorage.getItem('vizai_access_token');
    const url = `${API_BASE_URL}/api/v1/backend/connections/${connectionId}/ontology/latest.ttl`;
    const response = await fetch(url, {
      method: "GET",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: "include",
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || "Failed to fetch ontology TTL");
    }
    const ttl = await response.text();
    return { success: true, data: ttl };
  } catch (error: any) {
    return {
      success: false,
      error: { code: "DOWNLOAD_ONTOLOGY_TTL_FAILED", message: error.message || "Failed to download ontology TTL" },
    };
  }
};

export const startOntologyEnrichment = async (
  connectionId: string
): Promise<ApiResponse<StartOntologyEnrichmentPayload>> => {
  try {
    const response = await apiRequest<StartOntologyEnrichmentPayload>(
      `/api/v1/backend/connections/${connectionId}/ontology/enrichment/start`,
      { method: "POST" }
    );
    return { success: true, data: response };
  } catch (error: any) {
    return {
      success: false,
      error: { code: "START_ONTOLOGY_ENRICHMENT_FAILED", message: error.message || "Failed to start ontology enrichment" },
    };
  }
};

export const applyOntologyEnrichment = async (
  connectionId: string,
  sessionId: string,
  answers: Array<{ question_id: string; answer: string | string[] }>
): Promise<ApiResponse<OntologyVersionPayload>> => {
  try {
    const response = await apiRequest<OntologyVersionPayload>(
      `/api/v1/backend/connections/${connectionId}/ontology/enrichment/${sessionId}/apply`,
      {
        method: "POST",
        body: JSON.stringify({ answers }),
      },
      120000 // 120 seconds — LLM enrichment + DB save can take up to 30s
    );
    return { success: true, data: response };
  } catch (error: any) {
    return {
      success: false,
      error: { code: "APPLY_ONTOLOGY_ENRICHMENT_FAILED", message: error.message || "Failed to apply ontology enrichment" },
    };
  }
};

export const sendOntologyEnrichmentChat = async (
  connectionId: string,
  sessionId: string,
  message: string
): Promise<ApiResponse<EnrichmentChatPayload>> => {
  try {
    const response = await apiRequest<EnrichmentChatPayload>(
      `/api/v1/backend/connections/${connectionId}/ontology/enrichment/${sessionId}/chat`,
      {
        method: "POST",
        body: JSON.stringify({ message }),
      }
    );
    return { success: true, data: response };
  } catch (error: any) {
    return {
      success: false,
      error: { code: "ONTOLOGY_ENRICHMENT_CHAT_FAILED", message: error.message || "Failed to send enrichment message" },
    };
  }
};

// ============================================================================
// AI / INSIGHTS
// ============================================================================

export interface NLQueryResponse {
  sql: string;
  explanation: string;
  confidence: number;
}

export interface Insight {
  type: 'trend' | 'anomaly' | 'correlation' | 'recommendation';
  title: string;
  description: string;
  confidence: number;
  actionable: boolean;
  recommendation?: string;
}

/**
 * Convert natural language to SQL
 */
export const naturalLanguageQuery = async (question: string, databaseId: string): Promise<ApiResponse<NLQueryResponse>> => {
  try {
    const response = await apiRequest<{
      sql: string;
      explanation?: string;
      confidence?: number;
    }>(`/api/v1/backend/nl2sql/generate/${databaseId}`, {
      method: 'POST',
      body: JSON.stringify({
        nl_query: question,
      }),
    });

    return {
      success: true,
      data: {
        sql: response.sql,
        explanation: response.explanation || 'Generated SQL query',
        confidence: response.confidence || 0.9,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'NL_QUERY_FAILED',
        message: error.message || 'Failed to generate query',
      },
    };
  }
};

/**
 * Generate insights from chart/data
 */
export const generateInsights = async (chartId: string, analysisType: string): Promise<ApiResponse<{ insights: Insight[] }>> => {
  try {
    // This endpoint doesn't exist in backend yet
    return {
      success: true,
      data: {
        insights: [],
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'GENERATE_INSIGHTS_FAILED',
        message: error.message || 'Failed to generate insights',
      },
    };
  }
};

/**
 * Business Insights Types
 */
export interface BusinessInsightsRequest {
  database_connection_id: string;
}

export interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  reasoning?: string;
}

export interface KeyMetricAnalysis {
  kpi_name: string;
  value_interpretation: string;
  business_impact: string;
  trend?: 'positive' | 'negative' | 'neutral';
  reasoning?: string;
}

export interface InsightPattern {
  insight: string;
  reasoning?: string;
}

export interface Concern {
  concern: string;
  reasoning?: string;
}

export interface BusinessInsights {
  executive_summary: string;
  reasoning?: string;
  key_metrics: KeyMetricAnalysis[];
  insights_and_patterns: InsightPattern[];
  recommendations: Recommendation[];
  areas_of_concern: Concern[];
}

export interface BusinessInsightsResponse {
  message: string;
  database_name: string;
  database_type?: string;
  kpis_analyzed: number;
  kpi_queries: Array<{
    kpi_title: string;
    description: string;
    sql_query: string;
  }>;
  query_results: Array<{
    kpi_title: string;
    description: string;
    query: string;
    success: boolean;
    data: any[];
    row_count: number;
    error?: string;
  }>;
  insights: BusinessInsights;
}

export interface DatabaseInsightSummary {
  database_id: string;
  database_name: string;
  database_type: string;
  status: 'success' | 'failed' | 'skipped';
  kpis_analyzed?: number;
  successful_queries?: number;
  insights?: BusinessInsights;
  error?: string;
}

export interface StrategicPriority {
  rank: number;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  reasoning?: string;
}

export interface RiskDetail {
  risk: string;
  reasoning?: string;
}

export interface RiskAssessment {
  critical_risks: RiskDetail[];
  moderate_risks: RiskDetail[];
}

export interface Opportunity {
  title: string;
  description: string;
  potential_impact: string;
  reasoning?: string;
}

export interface PatternDetail {
  pattern: string;
  reasoning?: string;
}

export interface ConsolidatedInsights {
  overall_health_score: string;
  health_assessment: string;
  reasoning?: string;
  cross_database_patterns: PatternDetail[];
  strategic_priorities: StrategicPriority[];
  risk_assessment: RiskAssessment;
  opportunities: Opportunity[];
}

export interface ProjectInsightsResponse {
  message: string;
  project_id: string;
  project_name: string;
  total_databases_analyzed: number;
  successful_analyses: number;
  database_insights: DatabaseInsightSummary[];
  consolidated_insights: ConsolidatedInsights;
}

/**
 * Generate business insights for a single database connection
 * Note: This can take 12-35 seconds, so we use a longer timeout
 */
export const generateBusinessInsights = async (
  databaseConnectionId: string
): Promise<ApiResponse<BusinessInsightsResponse>> => {
  try {
    const response = await apiRequest<BusinessInsightsResponse>(
      '/api/v1/backend/business-insights',
      {
        method: 'POST',
        body: JSON.stringify({
          database_connection_id: databaseConnectionId,
        }),
      },
      600000 // 600 seconds (10 minutes) timeout for single database insights
    );

    return {
      success: true,
      data: response,
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'GENERATE_BUSINESS_INSIGHTS_FAILED',
        message: error.message || 'Failed to generate business insights',
      },
    };
  }
};

/**
 * Generate project-wide business insights for all databases in a project
 * Note: This can take 30-120 seconds, so we use a much longer timeout
 */
export const generateProjectInsights = async (
  projectId: string
): Promise<ApiResponse<ProjectInsightsResponse>> => {
  try {
    const response = await apiRequest<ProjectInsightsResponse>(
      `/api/v1/backend/projects/${projectId}/business-insights`,
      {
        method: 'POST',
        body: JSON.stringify({}),
      },
      600000 // 600 seconds (10 minutes) timeout for project-wide insights
    );

    return {
      success: true,
      data: response,
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'GENERATE_PROJECT_INSIGHTS_FAILED',
        message: error.message || 'Failed to generate project insights',
      },
    };
  }
};

/**
 * Business Insight Record from backend
 * Note: Fields can be in different formats (object vs array) depending on storage
 */
export interface BusinessInsightRecord {
  id: string;
  project_id: string;
  user_id: string;
  executive_summary: string;
  key_metrics: any; // Can be array of metrics OR object with overall_health_score, total_databases_analyzed, etc.
  insights_and_patterns: any; // Array of { pattern: string, reasoning?: string } OR { insight: string, reasoning?: string }
  recommendations: any; // Array of { rank: number, title: string, description: string, impact: string, reasoning?: string }
  areas_of_concern: any; // Can be array OR object with { critical_risks: [], moderate_risks: [] }
  created_at: string;
}

export interface LatestBusinessInsightResponse {
  message: string;
  insight: BusinessInsightRecord;
}

/**
 * Get the latest business insight for a project
 */
export const getLatestBusinessInsight = async (
  projectId: string,
  userId?: string
): Promise<ApiResponse<LatestBusinessInsightResponse>> => {
  try {
    const queryParams = new URLSearchParams({
      project_id: projectId,
    });

    if (userId) {
      queryParams.append('user_id', userId);
    }

    const response = await apiRequest<LatestBusinessInsightResponse>(
      `/api/v1/backend/business-insights/latest?${queryParams.toString()}`
    );

    return {
      success: true,
      data: response,
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'GET_LATEST_BUSINESS_INSIGHT_FAILED',
        message: error.message || 'Failed to fetch latest business insight',
      },
    };
  }
};

/**
 * Generate charts from database
 */
export const generateCharts = async (
  projectId: string,
  datasourceConnectionId: string,
  options?: {
    db_type?: string;
    domain?: string;
    min_date?: string;
    max_date?: string;
    api_key?: string;
    role?: string;
  }
): Promise<ApiResponse<{
  generated_charts: Array<{
    id: string;
    title: string;
    query: string;
    chart_type: string;
    relevance: string;
    is_time_based: boolean;
    report: string;
  }>;
}>> => {
  try {
    const response = await apiRequest<{
      success?: boolean;
      generated_charts: Array<{
        id: string;
        title: string;
        query: string;
        chart_type: string;
        relevance: string;
        is_time_based: boolean;
        report: string;
      }>;
    }>(`/api/v1/backend/generate_charts/${projectId}/${datasourceConnectionId}`, {
      method: 'POST',
      body: JSON.stringify({
        db_type: options?.db_type || 'postgresql',
        domain: options?.domain || '',
        min_date: options?.min_date,
        max_date: options?.max_date,
        api_key: options?.api_key,
        role: options?.role || 'admin',
      }),
    });

    return {
      success: true,
      data: {
        generated_charts: response.generated_charts || [],
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'GENERATE_CHARTS_FAILED',
        message: error.message || 'Failed to generate charts',
      },
    };
  }
};

/**
 * Create dashboard from conversational prompt
 * @note This function still uses the deprecated createDashboard API call.
 * Consider migrating to WebSocket-based dashboard creation workflow if this is still in use.
 */
export const createDashboardFromPrompt = async (prompt: string, databaseId: string, projectId: string): Promise<ApiResponse<{ dashboardId: string; charts: Chart[] }>> => {
  try {
    // Use generateCharts to get charts
    const chartsResponse = await generateCharts(projectId, databaseId, {
      db_type: 'postgresql',
      domain: '',
      role: 'admin',
    });

    if (!chartsResponse.success || !chartsResponse.data) {
      throw new Error('Failed to generate charts');
    }

    // Create dashboard first
    // TODO: Migrate to WebSocket-based dashboard creation
    const dashboard = await createDashboard(projectId, {
      name: 'AI Generated Dashboard',
      description: `Generated from: ${prompt}`,
    });

    if (!dashboard.success || !dashboard.data) {
      throw new Error('Failed to create dashboard');
    }

    return {
      success: true,
      data: {
        dashboardId: dashboard.data.id,
        charts: chartsResponse.data.generated_charts.map((chart) => ({
          id: chart.id,
          name: chart.title,
          type: mapChartType(chart.chart_type),
          projectId,
          databaseId,
          query: chart.query,
          config: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })),
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'CREATE_DASHBOARD_FROM_PROMPT_FAILED',
        message: error.message || 'Failed to create dashboard from prompt',
      },
    };
  }
};

// ============================================================================
// USERS & TEAMS
// ============================================================================

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  joinedAt: string;
  lastActive: string;
}

/**
 * Get project members (all users in project)
 */
export const getTeamMembers = async (projectId: string): Promise<ApiResponse<TeamMember[]>> => {
  try {
    const response = await apiRequest<Array<{
      id: string;
      user_id: string;
      username: string;
      email: string;
      created_at: string;
      role_id?: string;
      role_name?: string;
    }> | {
      message: string;
      users: Array<{
        id: string;
        user_id: string;
        username: string;
        email: string;
        created_at: string;
        role_id?: string;
        role_name?: string;
      }>;
    }>(`/api/v1/backend/projects/${projectId}/users`);

    // Handle both response formats: array directly or object with users property
    const usersArray = Array.isArray(response)
      ? response
      : (response as any).users || [];

    return {
      success: true,
      data: usersArray.map((u: any) => ({
        id: u.user_id || u.id,
        name: u.username,
        email: u.email,
        role: u.role_name || 'Member', // Use role_name if available
        joinedAt: u.created_at,
        lastActive: new Date().toISOString(),
      })),
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'FETCH_TEAM_MEMBERS_FAILED',
        message: error.message || 'Failed to fetch team members',
      },
    };
  }
};

/**
 * Invite user to project (Create user project relationship)
 */
export const inviteUser = async (
  projectId: string,
  data: {
    username: string;
    email: string;
    password?: string;
    role_id: string; // Role ID (UUID)
  }
): Promise<ApiResponse<{ user_id: string; project_id: string }>> => {
  try {
    const requestBody: {
      username: string;
      email: string;
      password?: string;
      role_id: string;
    } = {
      username: data.username,
      email: data.email,
      role_id: data.role_id,
    };

    // Only include password if provided
    if (data.password) {
      requestBody.password = data.password;
    }

    const response = await apiRequest<{
      message: string;
      user_id: string;
      project_id: string;
    }>(`/api/v1/backend/projects/${projectId}/users`, {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    return {
      success: true,
      data: {
        user_id: response.user_id,
        project_id: response.project_id,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'INVITE_USER_FAILED',
        message: error.message || 'Failed to invite user',
      },
    };
  }
};

/**
 * Add users to dashboard
 */
export interface UserDashboardAssignment {
  id: string;
  user_id: string;
  dashboard_id: string;
  can_read: boolean;
  can_write: boolean;
  can_delete: boolean;
}

export const addUserToDashboard = async (
  projectId: string,
  data: {
    user_ids: string[]; // Array of user UUIDs
    dashboard_id: string; // Dashboard UUID
  }
): Promise<ApiResponse<{ message: string; user_dashboard: UserDashboardAssignment[] }>> => {
  try {
    const response = await apiRequest<{
      message: string;
      user_dashboard: Array<{
        id: string;
        user_id: string;
        dashboard_id: string;
        can_read: boolean;
        can_write: boolean;
        can_delete: boolean;
      }>;
    }>(`/api/v1/backend/projects/${projectId}/dashboard/user`, {
      method: 'POST',
      body: JSON.stringify({
        user_ids: data.user_ids,
        dashboard_id: data.dashboard_id,
      }),
    });

    return {
      success: true,
      data: {
        message: response.message,
        user_dashboard: response.user_dashboard,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'ADD_USER_DASHBOARD_FAILED',
        message: error.message || 'Failed to add users to dashboard',
      },
    };
  }
};

// ============================================================================
// ROLES & PERMISSIONS
// ============================================================================

export interface Role {
  id: string;
  name: string;
  isBuiltIn: boolean;
  permissions: {
    projects: string;
    team: string;
    databases: string;
    dashboards: string;
    insights: string;
  };
  databaseAccess?: {
    databases: string[];
    tables: { [database: string]: string[] };
  };
}

export interface Permission {
  id: string;
  type: string;
}

/**
 * Get all permissions
 */
export const getPermissions = async (): Promise<ApiResponse<Permission[]>> => {
  try {
    const response = await apiRequest<{
      message: string;
      permissions: Array<{
        id: string;
        type: string;
      }>;
    }>('/api/v1/backend/permissions');

    return {
      success: true,
      data: response.permissions.map((p) => ({
        id: p.id,
        type: p.type,
      })),
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'FETCH_PERMISSIONS_FAILED',
        message: error.message || 'Failed to fetch permissions',
      },
    };
  }
};

/**
 * Get roles for project
 */
export const getRoles = async (projectId: string): Promise<ApiResponse<Array<{
  id: string;
  name: string;
  description: string;
  permissions: string[]; // Array of permission types (strings)
  blacklist: Array<{
    table_name: string;
    table_id: string;
  }>;
  isBuiltIn?: boolean;
  databaseAccess?: {
    databases: string[];
    tables: { [database: string]: string[] };
  };
}>>> => {
  try {
    const response = await apiRequest<{
      message: string;
      roles: Array<{
        id: string;
        name: string;
        description: string;
        permissions: string[]; // Permission types (strings like "VIEW_DATASOURCE", etc.)
        blacklist: Array<{
          table_name: string;
          table_id: string;
        }>;
      }>;
    }>(`/api/v1/backend/projects/${projectId}/roles`);

    return {
      success: true,
      data: response.roles.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description || '',
        permissions: r.permissions, // Keep as array of permission type strings
        blacklist: r.blacklist || [],
        isBuiltIn: r.name.toLowerCase() === 'admin' || r.name.toLowerCase() === 'member',
        databaseAccess: {
          databases: [],
          tables: {},
        },
      })),
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'FETCH_ROLES_FAILED',
        message: error.message || 'Failed to fetch roles',
      },
    };
  }
};

/**
 * Create custom role
 */
export const createRole = async (
  projectId: string,
  data: {
    name: string;
    description: string;
    permissions: string[]; // Array of permission IDs
  }
): Promise<ApiResponse<Role>> => {
  try {
    const response = await apiRequest<{
      message: string;
      role: {
        id: string;
        name: string;
        description: string;
        project_id: string;
        permissions: string[];
      };
    }>(`/api/v1/backend/projects/${projectId}/roles`, {
      method: 'POST',
      body: JSON.stringify({
        name: data.name,
        description: data.description || '',
        permissions: data.permissions,
      }),
    });

    return {
      success: true,
      data: {
        id: response.role.id,
        name: response.role.name,
        isBuiltIn: false,
        permissions: {
          projects: 'read',
          team: 'read',
          databases: 'read',
          dashboards: 'read',
          insights: 'read',
        },
        databaseAccess: {
          databases: [],
          tables: {},
        },
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'CREATE_ROLE_FAILED',
        message: error.message || 'Failed to create role',
      },
    };
  }
};

// ============================================================================
// AUDIT LOGS
// ============================================================================

export interface AuditLog {
  id: string;
  action: string;
  userId: string;
  userName: string;
  timestamp: string;
  details: any;
}

/**
 * Get audit logs for project
 */
export const getAuditLogs = async (projectId: string): Promise<ApiResponse<{ data: AuditLog[]; pagination: any }>> => {
  try {
    // This endpoint doesn't exist in backend yet
    return {
      success: true,
      data: {
        data: [],
        pagination: {
          page: 1,
          pageSize: 20,
          total: 0,
          totalPages: 0,
        },
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'FETCH_AUDIT_LOGS_FAILED',
        message: error.message || 'Failed to fetch audit logs',
      },
    };
  }
};

// ============================================================================
// EXPORTS
// ============================================================================

const api = {
  // Auth
  login,
  register,
  logout,

  // Projects
  getProjects,
  createProject,
  getProject,
  updateProject,
  deleteProject,

  // Dashboards
  getDashboards,
  createDashboard,
  deleteDashboard,
  getDashboardCharts,
  generateDashboardKpiQueries,
  executeKpiQuery,
  getFavorites,

  // Charts
  getCharts,
  filterCharts,
  createChart,
  addChartToDashboard,
  getChartData,
  generateCharts,
  getFavoriteCharts,
  updateFavoriteChart,
  deleteChart,
  getUserDashboardCharts,

  // Databases
  getDatabases,
  createDatabase,
  testDatabaseConnection,
  getDatabaseSchema,
  updateConnection,

  // AI/Insights
  naturalLanguageQuery,
  generateInsights,
  createDashboardFromPrompt,

  // Users/Teams
  getTeamMembers,
  inviteUser,
  addUserToDashboard,

  // Roles
  getRoles,
  createRole,
  getPermissions,

  // Audit
  getAuditLogs,
};

export default api;

// ============================================================================
// HOME INSIGHTS
// ============================================================================

export interface HomeInsight {
  id: string;
  user_id: string;
  project_id: string;
  title: string;
  description: string;
  insight_type: 'positive' | 'negative' | 'opportunity';
  category: string;
  impact: 'High' | 'Medium' | 'Low';
  source?: string;
  created_at: string;
}

export interface SaveHomeInsightRequest {
  project_id: string;
  title: string;
  description: string;
  insight_type: 'positive' | 'negative' | 'opportunity';
  category: string;
  impact: 'High' | 'Medium' | 'Low';
  source?: string;
}

/**
 * Save an insight to the user's home page
 */
export const saveHomeInsight = async (data: SaveHomeInsightRequest): Promise<ApiResponse<HomeInsight>> => {
  try {
    const response = await apiRequest<{
      message: string;
      insight: {
        id: string;
        user_id: string;
        project_id: string;
        title: string;
        description: string;
        insight_type: string;
        category: string;
        impact: string;
        source?: string;
        created_at: string;
      };
    }>('/api/v1/backend/home-insights', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    return {
      success: true,
      data: {
        id: response.insight.id,
        user_id: response.insight.user_id,
        project_id: response.insight.project_id,
        title: response.insight.title,
        description: response.insight.description,
        insight_type: response.insight.insight_type as 'positive' | 'negative' | 'opportunity',
        category: response.insight.category,
        impact: response.insight.impact as 'High' | 'Medium' | 'Low',
        source: response.insight.source,
        created_at: response.insight.created_at,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'SAVE_HOME_INSIGHT_FAILED',
        message: error.message || 'Failed to save insight to home',
      },
    };
  }
};

/**
 * Get all home insights for the current user
 */
export const getHomeInsights = async (projectId?: string, limit: number = 10): Promise<ApiResponse<HomeInsight[]>> => {
  try {
    const queryParams = new URLSearchParams();
    if (projectId) {
      queryParams.append('project_id', projectId);
    }
    queryParams.append('limit', String(limit));

    const response = await apiRequest<{
      message: string;
      insights: Array<{
        id: string;
        user_id: string;
        project_id: string;
        title: string;
        description: string;
        insight_type: string;
        category: string;
        impact: string;
        source?: string;
        created_at: string;
      }>;
      total_count: number;
    }>(`/api/v1/backend/home-insights?${queryParams.toString()}`);

    return {
      success: true,
      data: response.insights.map(insight => ({
        id: insight.id,
        user_id: insight.user_id,
        project_id: insight.project_id,
        title: insight.title,
        description: insight.description,
        insight_type: insight.insight_type as 'positive' | 'negative' | 'opportunity',
        category: insight.category,
        impact: insight.impact as 'High' | 'Medium' | 'Low',
        source: insight.source,
        created_at: insight.created_at,
      })),
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'GET_HOME_INSIGHTS_FAILED',
        message: error.message || 'Failed to fetch home insights',
      },
    };
  }
};

/**
 * Delete a home insight
 */
export const deleteHomeInsight = async (insightId: string): Promise<ApiResponse<{ message: string }>> => {
  try {
    const response = await apiRequest<{
      message: string;
    }>(`/api/v1/backend/home-insights/${insightId}`, {
      method: 'DELETE',
    });

    return {
      success: true,
      data: {
        message: response.message || 'Insight removed from home successfully',
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'DELETE_HOME_INSIGHT_FAILED',
        message: error.message || 'Failed to delete home insight',
      },
    };
  }
};

// ============================================================================
// SHARE TOKEN / EMBED
// ============================================================================

export interface ShareTokenDetail {
  token_id: string;
  dashboard_id: string;
  embed_url: string;
  iframe_snippet: string;
  is_active: boolean;
  created_at: string;
  expires_at: string | null;
  access_count: number;
  allowed_domains_snapshot: string[] | null;
}

/**
 * Create or retrieve a share token for a dashboard
 */
export const createShareToken = async (
  dashboardId: string,
  expiresInDays: number | null = null
): Promise<ApiResponse<ShareTokenDetail>> => {
  try {
    const response = await apiRequest<{
      message: string;
      token: ShareTokenDetail;
    }>(`/api/v1/backend/dashboards/${dashboardId}/share-token`, {
      method: 'POST',
      body: JSON.stringify({ expires_in_days: expiresInDays }),
    });

    return {
      success: true,
      data: response.token,
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'CREATE_SHARE_TOKEN_FAILED',
        message: error.message || 'Failed to create share token',
      },
    };
  }
};

/**
 * Get the existing active share token for a dashboard
 */
export const getShareToken = async (
  dashboardId: string
): Promise<ApiResponse<ShareTokenDetail | null>> => {
  try {
    const response = await apiRequest<{
      message: string;
      token: ShareTokenDetail | null;
    }>(`/api/v1/backend/dashboards/${dashboardId}/share-token`);

    return {
      success: true,
      data: response.token,
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'GET_SHARE_TOKEN_FAILED',
        message: error.message || 'Failed to get share token',
      },
    };
  }
};

/**
 * Revoke the active share token for a dashboard
 */
export const revokeShareToken = async (
  dashboardId: string
): Promise<ApiResponse<{ message: string; dashboard_id: string }>> => {
  try {
    const response = await apiRequest<{
      message: string;
      dashboard_id: string;
    }>(`/api/v1/backend/dashboards/${dashboardId}/share-token`, {
      method: 'DELETE',
    });

    return {
      success: true,
      data: response,
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'REVOKE_SHARE_TOKEN_FAILED',
        message: error.message || 'Failed to revoke share token',
      },
    };
  }
};


// ============================================================================
// APP REGISTRATION
// ============================================================================

export interface AppDetail {
  app_id: string;
  company_name: string;
  domain_url: string;
  is_active: boolean;
  created_at: string;
}

/**
 * Create a new app registration
 */
export const createApp = async (
  companyName: string,
  domainUrl: string
): Promise<ApiResponse<AppDetail>> => {
  try {
    const response = await apiRequest<{
      message: string;
      app: AppDetail;
    }>('/api/v1/apps', {
      method: 'POST',
      body: JSON.stringify({
        company_name: companyName,
        domain_url: domainUrl,
      }),
    });

    return {
      success: true,
      data: response.app,
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'CREATE_APP_FAILED',
        message: error.message || 'Failed to create app',
      },
    };
  }
};

/**
 * List all active apps for the current user
 */
export const listApps = async (): Promise<ApiResponse<AppDetail[]>> => {
  try {
    const response = await apiRequest<{
      message: string;
      apps: AppDetail[];
    }>('/api/v1/apps');

    return {
      success: true,
      data: response.apps,
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'LIST_APPS_FAILED',
        message: error.message || 'Failed to list apps',
      },
    };
  }
};

/**
 * Soft-delete an app
 */
export const deleteApp = async (
  appId: string
): Promise<ApiResponse<{ message: string; app_id: string }>> => {
  try {
    const response = await apiRequest<{
      message: string;
      app_id: string;
    }>(`/api/v1/apps/${appId}`, {
      method: 'DELETE',
    });

    return {
      success: true,
      data: response,
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'DELETE_APP_FAILED',
        message: error.message || 'Failed to delete app',
      },
    };
  }
};


// ============================================================================
// DASHBOARD ALLOWED DOMAINS
// ============================================================================

export interface AllowedDomainDetail {
  app_id: string;
  company_name: string;
  domain_url: string;
  added_at: string;
}

/**
 * Set allowed domains for a dashboard (replaces existing)
 */
export const setAllowedDomains = async (
  dashboardId: string,
  appIds: string[]
): Promise<ApiResponse<AllowedDomainDetail[]>> => {
  try {
    const response = await apiRequest<{
      message: string;
      dashboard_id: string;
      allowed_domains: AllowedDomainDetail[];
    }>(`/api/v1/dashboards/${dashboardId}/allowed-domains`, {
      method: 'POST',
      body: JSON.stringify({ app_ids: appIds }),
    });

    return {
      success: true,
      data: response.allowed_domains,
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'SET_ALLOWED_DOMAINS_FAILED',
        message: error.message || 'Failed to set allowed domains',
      },
    };
  }
};

/**
 * Get allowed domains for a dashboard
 */
export const getAllowedDomains = async (
  dashboardId: string
): Promise<ApiResponse<AllowedDomainDetail[]>> => {
  try {
    const response = await apiRequest<{
      message: string;
      dashboard_id: string;
      allowed_domains: AllowedDomainDetail[];
    }>(`/api/v1/dashboards/${dashboardId}/allowed-domains`);

    return {
      success: true,
      data: response.allowed_domains,
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'GET_ALLOWED_DOMAINS_FAILED',
        message: error.message || 'Failed to get allowed domains',
      },
    };
  }
};

/**
 * Remove an allowed domain from a dashboard
 */
export const removeAllowedDomain = async (
  dashboardId: string,
  appId: string
): Promise<ApiResponse<{ message: string }>> => {
  try {
    const response = await apiRequest<{
      message: string;
      dashboard_id: string;
      app_id: string;
    }>(`/api/v1/dashboards/${dashboardId}/allowed-domains/${appId}`, {
      method: 'DELETE',
    });

    return {
      success: true,
      data: response,
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'REMOVE_ALLOWED_DOMAIN_FAILED',
        message: error.message || 'Failed to remove allowed domain',
      },
    };
  }
};


// ============================================================================
// OBSERVABILITY API
// ============================================================================

export interface LLMTrace {
  id: string;
  session_id: string | null;
  chart_id: string | null;
  project_id: string | null;
  user_id: string | null;
  ai_service: string;
  llm_provider: string | null;
  model_name: string | null;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated_cost_usd: number;
  latency_ms: number | null;
  sql_generated: string | null;
  sql_retries: number;
  schema_tables_used: string[] | null;
  agent_steps: any[] | null;
  status: 'success' | 'error' | 'timeout' | 'cancelled';
  error_message: string | null;
  created_at: string;
  // only present in detail view
  prompt_text?: string | null;
  completion_text?: string | null;
}

export interface TraceListResponse {
  total: number;
  page: number;
  page_size: number;
  items: LLMTrace[];
}

export interface UsageAnalytics {
  summary: {
    total_calls: number;
    total_tokens: number;
    total_prompt_tokens: number;
    total_completion_tokens: number;
    total_cost_usd: number;
    avg_latency_ms: number;
    error_count: number;
    error_rate: number;
  };
  daily_trend: Array<{
    day: string;
    ai_service: string;
    tokens: number;
    cost_usd: number;
    calls: number;
  }>;
  service_breakdown: Array<{
    ai_service: string;
    calls: number;
    tokens: number;
    cost_usd: number;
    avg_latency_ms: number;
    errors: number;
  }>;
  model_breakdown: Array<{
    model_name: string;
    llm_provider: string;
    calls: number;
    tokens: number;
    cost_usd: number;
  }>;
}

export const getTraces = async (params: {
  project_id?: string;
  ai_service?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
}): Promise<ApiResponse<TraceListResponse>> => {
  try {
    const query = new URLSearchParams();
    if (params.project_id) query.set('project_id', params.project_id);
    if (params.ai_service) query.set('ai_service', params.ai_service);
    if (params.status) query.set('status', params.status);
    if (params.date_from) query.set('date_from', params.date_from);
    if (params.date_to) query.set('date_to', params.date_to);
    if (params.page) query.set('page', String(params.page));
    if (params.page_size) query.set('page_size', String(params.page_size));
    const data = await apiRequest<TraceListResponse>(`/api/v1/observability/traces?${query}`);
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: { code: 'TRACES_FETCH_FAILED', message: error.message || 'Failed to fetch traces' } };
  }
};

export const getTraceDetail = async (traceId: string): Promise<ApiResponse<LLMTrace>> => {
  try {
    const data = await apiRequest<LLMTrace>(`/api/v1/observability/traces/${traceId}`);
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: { code: 'TRACE_DETAIL_FAILED', message: error.message || 'Failed to fetch trace' } };
  }
};

export const getUsageAnalytics = async (params: {
  project_id?: string;
  date_from?: string;
  date_to?: string;
}): Promise<ApiResponse<UsageAnalytics>> => {
  try {
    const query = new URLSearchParams();
    if (params.project_id) query.set('project_id', params.project_id);
    if (params.date_from) query.set('date_from', params.date_from);
    if (params.date_to) query.set('date_to', params.date_to);
    const data = await apiRequest<UsageAnalytics>(`/api/v1/observability/analytics?${query}`);
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: { code: 'ANALYTICS_FETCH_FAILED', message: error.message || 'Failed to fetch analytics' } };
  }
};
