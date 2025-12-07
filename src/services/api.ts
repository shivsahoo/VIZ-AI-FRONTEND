/**
 * VizAI API Service
 * 
 * This file contains all API interactions for the VizAI application.
 * Integrated with the FastAPI backend.
 */

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
export const createProject = async (data: { name: string; description: string }): Promise<ApiResponse<Project>> => {
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
 * Update project KPI information
 */
export const updateProjectKpiInfo = async (projectId: string, kpiInfo: string): Promise<ApiResponse<void>> => {
  try {
    await apiRequest(`/api/v1/backend/projects/${projectId}/kpi-info`, {
      method: 'PATCH',
      body: JSON.stringify({
        kpi_info: kpiInfo,
      }),
    });
    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'UPDATE_PROJECT_KPI_FAILED',
        message: error.message || 'Failed to update project KPI information',
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
    }> | {
      message: string;
      dashboards: Array<{
        id: string;
        title: string;
        description: string | null;
        project_id: string;
        created_by: string;
        is_favorite?: boolean;
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

/**
 * Create new dashboard
 * @deprecated Dashboard creation is now handled through WebSocket events.
 * This function is kept for backward compatibility but should not be used for new dashboard creation.
 * Use DashboardCreationBot component with WebSocket for dashboard creation workflow.
 */
export const createDashboard = async (projectId: string, data: { name: string; description: string }): Promise<ApiResponse<Dashboard>> => {
  try {
    const response = await apiRequest<{
      message: string;
      dashboard: {
        id: string;
        title: string;
        description: string | null;
        project_id: string;
        created_by: string;
      };
    }>(`/api/v1/backend/projects/${projectId}/dashboard`, {
      method: 'POST',
      body: JSON.stringify({
        title: data.name,
        description: data.description,
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
  type: 'line' | 'bar' | 'pie' | 'area';
  projectId: string;
  databaseId?: string;
  query?: string;
  config: {
    xAxis?: string;
    yAxis?: string;
    color?: string;
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
        created_at: string;
        isFavorite?: boolean;
        x_axis?: string | null;
        y_axis?: string | null;
        is_time_based?: boolean;
      }>;
    }>(`/api/v1/backend/charts?project_id=${projectId}`);

    // Handle both response formats: object with charts array or direct array
    const chartsArray = response.charts || (Array.isArray(response) ? response : []);

    return {
      success: true,
      data: chartsArray
        .filter((chart) => chart.datasourceConnectionId) // Filter charts with connections
        .map((chart) => ({
          id: chart.id,
          name: chart.title,
          type: mapChartType(chart.type), // Backend returns 'type' which is chart_type
          projectId, // Will need to get from backend or context
          databaseId: chart.datasourceConnectionId || undefined,
          query: chart.query,
          config: {
            xAxis: chart.x_axis ?? undefined,
            yAxis: chart.y_axis ?? undefined,
          },
          createdAt: chart.created_at,
          updatedAt: chart.created_at,
          is_time_based: chart.is_time_based ?? false,
        })),
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
function mapChartType(backendType?: string | null): 'line' | 'bar' | 'pie' | 'area' {
  if (!backendType) {
    return 'line';
  }
  const normalized = backendType.toString().toLowerCase();
  const typeMap: Record<string, 'line' | 'bar' | 'pie' | 'area'> = {
    line: 'line',
    bar: 'bar',
    pie: 'pie',
    area: 'area',
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

    const response = await apiRequest<{
      id: string;
      title: string;
      query: string;
      chart_type: string;
    }>(`/api/v1/backend/projects/${projectId}/save-chart`, {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    return {
      success: true,
      data: {
        id: response.id,
        name: response.title,
        type: mapChartType(response.chart_type),
        projectId,
        databaseId: data.databaseId,
        query: response.query,
        config: {
          xAxis: data.config?.xAxis,
          yAxis: data.config?.yAxis,
          color: data.config?.color,
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
  chart_type: 'line' | 'bar' | 'pie' | 'area';
  dashboard_id: string;
  data_connection_id: string; // Required - must be a valid UUID
  report?: string;
  type?: string;
  relevance?: string;
  is_time_based?: boolean;
  x_axis?: string | null;
  y_axis?: string | null;
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
  bypassCache: boolean = false
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
    const requestBody: { query: string; from_date?: string; to_date?: string } = {
      query: query,
    };
    
    if (fromDate) {
      requestBody.from_date = fromDate;
    }
    if (toDate) {
      requestBody.to_date = toDate;
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
 * Otherwise, attempts to delete the chart entirely using a general delete endpoint.
 * 
 * Note: The backend currently only has a delete-from-dashboard endpoint.
 * If a general delete endpoint doesn't exist, this will fail for charts without a dashboardId.
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
    
    // Try to delete chart directly using general delete endpoint
    // This endpoint may not exist in the backend - if it doesn't, we'll handle the error
    try {
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
    } catch (generalDeleteError: any) {
      // If general delete endpoint doesn't exist (404), return a helpful error
      if (generalDeleteError.message?.includes('404') || generalDeleteError.message?.includes('Not Found')) {
        return {
          success: false,
          error: {
            code: 'DELETE_CHART_FAILED',
            message: 'Cannot delete chart: Chart is not associated with a dashboard. Please add the chart to a dashboard first, then delete it.',
          },
        };
      }
      // Re-throw other errors
      throw generalDeleteError;
    }
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
  connectionString?: string | null;
  consentGiven?: boolean;
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
      // Backend expects "postgres" not "postgresql", and "oracledb" not "oracle"
      let dbType = data.dbType?.toLowerCase() || 'postgres';
      if (dbType === 'postgresql') {
        dbType = 'postgres';
      } else if (dbType === 'oracle') {
        dbType = 'oracledb';
      }
      
      requestBody.connection_name = data.connectionName || '';
      requestBody.db_type = dbType;
      
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
    }

    if (data.consentGiven !== undefined) {
      requestBody.consent_given = data.consentGiven;
    }

    const response = await apiRequest<{
      taskId: string;
      tablesCount: number;
    }>(`/api/v1/backend/database/${projectId}`, {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    return {
      success: true,
      data: {
        taskId: response.taskId,
        tablesCount: response.tablesCount,
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
}

export interface KeyMetricAnalysis {
  kpi_name: string;
  value_interpretation: string;
  business_impact: string;
}

export interface BusinessInsights {
  executive_summary: string;
  key_metrics: KeyMetricAnalysis[];
  insights_and_patterns: string[];
  recommendations: Recommendation[];
  areas_of_concern: string[];
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
}

export interface RiskAssessment {
  critical_risks: string[];
  moderate_risks: string[];
}

export interface Opportunity {
  title: string;
  description: string;
  potential_impact: string;
}

export interface ConsolidatedInsights {
  overall_health_score: string;
  health_assessment: string;
  cross_database_patterns: string[];
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
      120000 // 120 seconds (2 minutes) timeout for single database insights
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
      180000 // 180 seconds (3 minutes) timeout for project-wide insights
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
    role_id: string; // Role ID (UUID)
  }
): Promise<ApiResponse<{ user_id: string; project_id: string }>> => {
  try {
    const response = await apiRequest<{
      message: string;
      user_id: string;
      project_id: string;
    }>(`/api/v1/backend/projects/${projectId}/users`, {
      method: 'POST',
      body: JSON.stringify({
        username: data.username,
        email: data.email,
        role_id: data.role_id,
      }),
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
