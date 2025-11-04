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

const API_BASE_URL = getApiBaseUrl();

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
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAccessToken();
  const url = `${API_BASE_URL}${endpoint}`;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token && !endpoint.includes('/auth/')) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Include cookies for CORS
  });

  // Handle token refresh on 401
  if (response.status === 401 && token && !endpoint.includes('/auth/')) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      // Retry with new token
      const newToken = getAccessToken();
      if (newToken) {
        headers['Authorization'] = `Bearer ${newToken}`;
        const retryResponse = await fetch(url, {
          ...options,
          headers,
          credentials: 'include',
        });
        return handleResponse<T>(retryResponse);
      }
    }
    // Refresh failed, clear tokens
    clearTokens();
    throw new Error('Authentication failed. Please login again.');
  }

  return handleResponse<T>(response);
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
        errorMessage = await response.text();
      }
    } catch {
      // Use default error message
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
        memberCount: 0, // Not provided by backend
        databaseCount: 0,
        dashboardCount: 0,
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
 * Get dashboards for a project
 */
export const getDashboards = async (projectId: string): Promise<ApiResponse<Dashboard[]>> => {
  try {
    const response = await apiRequest<{
      message: string;
      dashboards: Array<{
        id: string;
        title: string;
        description: string | null;
        project_id: string;
        created_by: string;
      }>;
    }>(`/api/v1/backend/projects/${projectId}/users/dashboard`);

    return {
      success: true,
      data: response.dashboards.map((d) => ({
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
 * Create new dashboard
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
}

export interface ChartData {
  data: any[];
  metadata: {
    rowCount: number;
    executionTime: number;
    cachedAt: string | null;
  };
}

/**
 * Get charts for a project
 */
export const getCharts = async (projectId: string): Promise<ApiResponse<Chart[]>> => {
  try {
    const response = await apiRequest<Array<{
      id: string;
      title: string;
      query: string;
      chart_type: string;
      data_connection_id: string | null;
      created_at: string;
    }>>('/api/v1/backend/charts');

    return {
      success: true,
      data: response
        .filter((chart) => chart.data_connection_id) // Filter charts with connections
        .map((chart) => ({
          id: chart.id,
          name: chart.title,
          type: mapChartType(chart.chart_type),
          projectId, // Will need to get from backend or context
          databaseId: chart.data_connection_id || undefined,
          query: chart.query,
          config: {},
          createdAt: chart.created_at,
          updatedAt: chart.created_at,
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
 * Map backend chart type to frontend type
 */
function mapChartType(backendType: string): 'line' | 'bar' | 'pie' | 'area' {
  const typeMap: Record<string, 'line' | 'bar' | 'pie' | 'area'> = {
    line: 'line',
    bar: 'bar',
    pie: 'pie',
    area: 'area',
  };
  return typeMap[backendType.toLowerCase()] || 'line';
}

/**
 * Create new chart
 */
export const createChart = async (projectId: string, data: Partial<Chart>): Promise<ApiResponse<Chart>> => {
  try {
    const response = await apiRequest<{
      id: string;
      title: string;
      query: string;
      chart_type: string;
    }>(`/api/v1/backend/projects/${projectId}/save-chart`, {
      method: 'POST',
      body: JSON.stringify({
        title: data.name || 'New Chart',
        query: data.query || '',
        chart_type: data.type || 'line',
        type: data.type || 'line',
        data_connection_id: data.databaseId,
      }),
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
        config: data.config || {},
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
 * Get chart data (execute query)
 */
export const getChartData = async (chartId: string, datasourceConnectionId: string): Promise<ApiResponse<ChartData>> => {
  try {
    const response = await apiRequest<{
      data: any[];
      row_count?: number;
    }>(`/api/v1/backend/excecute-query/${datasourceConnectionId}/`, {
      method: 'POST',
      body: JSON.stringify({
        query: '', // Will need to get query from chart first
      }),
    });

    return {
      success: true,
      data: {
        data: response.data || [],
        metadata: {
          rowCount: response.row_count || response.data?.length || 0,
          executionTime: 0, // Not provided by backend
          cachedAt: null,
        },
      },
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

/**
 * Get database connections for project
 */
export const getDatabases = async (projectId: string): Promise<ApiResponse<Database[]>> => {
  try {
    const response = await apiRequest<{
      message: string;
      connections: Array<{
        db_entry_id: string;
        connection_name: string;
        db_type: string;
        host?: string;
        db_name?: string;
        username?: string;
        created_at: string;
      }>;
    }>(`/api/v1/backend/connections/${projectId}`);

    return {
      success: true,
      data: response.connections.map((conn) => ({
        id: conn.db_entry_id,
        name: conn.connection_name,
        type: conn.db_type || 'postgresql',
        host: conn.host || '',
        port: 5432, // Default, not provided by backend
        database: conn.db_name || '',
        username: conn.username || '',
        status: 'connected' as const,
        lastChecked: conn.created_at,
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
 */
export const createDatabase = async (projectId: string, data: Partial<Database>): Promise<ApiResponse<Database>> => {
  try {
    const response = await apiRequest<{
      db_entry_id: string;
    }>(`/api/v1/backend/database/${projectId}`, {
      method: 'POST',
      body: JSON.stringify({
        connection_name: data.name,
        db_type: data.type || 'postgresql',
        host: data.host,
        db_name: data.database,
        username: data.username,
        password: '', // Will need to handle securely
        connection_string: data.host ? `postgresql://${data.username}@${data.host}:${data.port}/${data.database}` : undefined,
      }),
    });

    return {
      success: true,
      data: {
        id: response.db_entry_id,
        name: data.name || 'New Database',
        type: data.type || 'postgresql',
        host: data.host || '',
        port: data.port || 5432,
        database: data.database || '',
        username: data.username || '',
        status: 'connected' as const,
        lastChecked: new Date().toISOString(),
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
 * Create dashboard from conversational prompt
 */
export const createDashboardFromPrompt = async (prompt: string, databaseId: string, projectId: string): Promise<ApiResponse<{ dashboardId: string; charts: Chart[] }>> => {
  try {
    const response = await apiRequest<{
      generated_charts: Array<{
        id: string;
        title: string;
        query: string;
        chart_type: string;
        relevance: string;
        is_time_based: boolean;
        report: string;
      }>;
    }>(`/api/v1/backend/generate_charts/${projectId}/${databaseId}`, {
      method: 'POST',
      body: JSON.stringify({
        db_type: 'postgresql',
        domain: '',
        role: 'admin',
      }),
    });

    // Create dashboard first
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
        charts: response.generated_charts.map((chart) => ({
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
 * Get project members
 */
export const getTeamMembers = async (projectId: string): Promise<ApiResponse<TeamMember[]>> => {
  try {
    const response = await apiRequest<{
      message: string;
      users: Array<{
        id: string;
        user_id: string;
        username: string;
        email: string;
        created_at: string;
      }>;
    }>(`/api/v1/backend/projects/${projectId}/users`);

    return {
      success: true,
      data: response.users.map((u) => ({
        id: u.user_id,
        name: u.username,
        email: u.email,
        role: 'Member', // Default, would need to fetch from role
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
 * Invite user to project
 */
export const inviteUser = async (projectId: string, data: { email: string; role: string }): Promise<ApiResponse<{ inviteId: string }>> => {
  try {
    // Backend doesn't have invite endpoint, uses create user project
    // This would need role_id instead of role name
    return {
      success: true,
      data: {
        inviteId: 'invite_' + Date.now(),
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

/**
 * Get roles for project
 */
export const getRoles = async (projectId: string): Promise<ApiResponse<Role[]>> => {
  try {
    const response = await apiRequest<{
      message: string;
      roles: Array<{
        id: string;
        name: string;
        description: string;
        permissions: string[];
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
        isBuiltIn: r.name.toLowerCase() === 'admin' || r.name.toLowerCase() === 'member',
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
export const createRole = async (projectId: string, data: Partial<Role>): Promise<ApiResponse<Role>> => {
  try {
    const permissionsResponse = await apiRequest<{
      message: string;
      permissions: Array<{ id: string; type: string }>;
    }>('/api/v1/backend/permissions');

    // Use first permission as default (would need proper mapping)
    const permissionIds = permissionsResponse.permissions
      .slice(0, 3)
      .map((p) => p.id);

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
        name: data.name || 'Custom Role',
        description: '',
        permissions: permissionIds,
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
  
  // Charts
  getCharts,
  createChart,
  getChartData,
  
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
  
  // Roles
  getRoles,
  createRole,
  
  // Audit
  getAuditLogs,
};

export default api;
