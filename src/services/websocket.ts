/**
 * VizAI WebSocket Service
 * 
 * Handles WebSocket connections for conversational workflows:
 * - project_info: Collect project metadata
 * - kpi_info: Collect KPIs
 * - dashboard_creation: Create dashboard with conversational flow
 * - chart_creation: Generate chart specifications
 */

// WebSocket URL - convert HTTPS to WSS
const getWebSocketUrl = (): string => {
  // Try to get from environment variable, otherwise use ngrok URL
  const env = typeof import.meta !== 'undefined' ? import.meta.env : undefined;
  const baseUrl = env?.VITE_WEBSOCKET_URL || 'https://mounted-chance-vigilantly.ngrok-free.dev';
  
  // Convert https:// to wss:// and remove trailing slash if present
  let wsUrl = baseUrl.trim().replace(/\/$/, ''); // Remove trailing slash
  wsUrl = wsUrl.replace('https://', 'wss://').replace('http://', 'ws://');
  const fullUrl = `${wsUrl}/ws/vizai`;
  
  console.log('[WebSocket] Base URL:', baseUrl);
  console.log('[WebSocket] Connecting to:', fullUrl);
  return fullUrl;
};

/**
 * Get stored access token from localStorage
 */
const getAccessToken = (): string | null => {
  return localStorage.getItem('vizai_access_token');
};

// Message Types
export interface WebSocketMessage {
  event_type: string;
  user_id: string;
  payload: Record<string, any>;
  session_id?: string;
}

export interface WebSocketResponse {
  event_type: string;
  status: "collecting" | "completed" | "error";
  message: string;
  missing_fields?: string[];
  state?: Record<string, any>;
  error?: string;
  session_id?: string;
}

// Chart Spec Type
export interface ChartSpec {
  title: string;
  query: string;
  type: "time_series" | "aggregate";
  chart_type: "bar" | "line" | "area" | "pie" | "donut" | "scatter";
  report?: string;
  relevance: number;
  is_time_based: boolean;
  data_connection_id: string;
}

// Event Handlers
export type MessageHandler = (response: WebSocketResponse) => void;
export type ErrorHandler = (error: Error) => void;
export type ConnectionHandler = () => void;

export class VizAIWebSocket {
  private ws: WebSocket | null = null;
  private userId: string;
  private sessionId: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isManualClose = false;
  private messageHandlers: Map<string, MessageHandler[]> = new Map();
  private errorHandlers: ErrorHandler[] = [];
  private connectionHandlers: { onOpen: ConnectionHandler[]; onClose: ConnectionHandler[] } = {
    onOpen: [],
    onClose: [],
  };

  constructor(userId: string) {
    this.userId = userId;
  }

  /**
   * Connect to WebSocket server
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      try {
        const url = getWebSocketUrl();
        this.ws = new WebSocket(url);
        this.isManualClose = false;

        this.ws.onopen = () => {
          console.log('[WebSocket] Connected');
          this.reconnectAttempts = 0;
          this.connectionHandlers.onOpen.forEach(handler => handler());
          this.startSession();
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            // Ignore keepalive messages
            if (data.type === 'keepalive' || data.type === 'ping') {
              return;
            }

            this.handleMessage(data as WebSocketResponse);
          } catch (error) {
            console.error('[WebSocket] Error parsing message:', error);
            this.errorHandlers.forEach(handler => handler(error as Error));
          }
        };

        this.ws.onerror = (error) => {
          console.error('[WebSocket] Connection Error:', error);
          console.error('[WebSocket] URL attempted:', getWebSocketUrl());
          this.errorHandlers.forEach(handler => handler(new Error('WebSocket connection error')));
          reject(new Error('WebSocket connection error'));
        };

        this.ws.onclose = (event) => {
          console.log('[WebSocket] Closed:', {
            code: event.code,
            reason: event.reason || 'No reason provided',
            wasClean: event.wasClean,
          });
          
          // Error code 1006 means abnormal closure (connection failed)
          if (event.code === 1006) {
            console.error('[WebSocket] Abnormal closure detected. Possible causes:');
            console.error('  1. WebSocket server is not running');
            console.error('  2. ngrok tunnel is not properly configured for WebSocket');
            console.error('  3. CORS or network issues');
            console.error('  4. Incorrect WebSocket endpoint path');
          }
          
          this.connectionHandlers.onClose.forEach(handler => handler());
          
          // Auto-reconnect if not manual close and not exceeded max attempts
          if (!this.isManualClose && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
            console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            setTimeout(() => this.connect(), delay);
          } else if (!this.isManualClose) {
            console.error('[WebSocket] Max reconnection attempts reached. Please check:');
            console.error('  1. Is the WebSocket server running?');
            console.error('  2. Is ngrok properly forwarding WebSocket traffic?');
            console.error('  3. Is the WebSocket URL correct?');
          }
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.isManualClose = true;
    if (this.ws) {
      this.endSession();
      // Give time for end_session to be sent
      setTimeout(() => {
        if (this.ws) {
          this.ws.close();
          this.ws = null;
        }
      }, 100);
    }
  }

  /**
   * Start a new session
   */
  startSession(): void {
    this.send({
      event_type: 'start_session',
      user_id: this.userId,
      payload: {},
    });
  }

  /**
   * End the current session
   */
  endSession(): void {
    this.send({
      event_type: 'end_session',
      user_id: this.userId,
      payload: {},
    });
  }

  /**
   * Send a message to the server
   */
  send(message: WebSocketMessage, includeAuthToken: boolean = true): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('[WebSocket] Cannot send message: WebSocket not connected');
      return;
    }

    // Prepare payload with auth token inside payload
    const payload: Record<string, any> = { ...message.payload, domain: 'admin' };
    
    // Include auth token in payload (default behavior)
    if (includeAuthToken) {
      const token = getAccessToken();
      if (token) {
        payload.auth_token = token;
      } else {
        console.warn('[WebSocket] Auth token not found in localStorage');
      }
    }

    // Prepare message to send
    const messageToSend: WebSocketMessage = {
      event_type: message.event_type,
      user_id: message.user_id,
      payload: payload,
      session_id: this.sessionId || message.session_id || undefined,
    };

    this.ws.send(JSON.stringify(messageToSend));
    console.log('[WebSocket] Sent:', messageToSend);
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(response: WebSocketResponse): void {
    console.log('[WebSocket] Received:', response);

    // Store session_id if provided
    if (response.session_id) {
      this.sessionId = response.session_id;
    }

    // Call handlers for this event type
    const handlers = this.messageHandlers.get(response.event_type) || [];
    handlers.forEach(handler => handler(response));

    // Also call handlers for 'all' events
    const allHandlers = this.messageHandlers.get('all') || [];
    allHandlers.forEach(handler => handler(response));
  }

  /**
   * Register a message handler for a specific event type
   */
  on(eventType: string, handler: MessageHandler): void {
    if (!this.messageHandlers.has(eventType)) {
      this.messageHandlers.set(eventType, []);
    }
    this.messageHandlers.get(eventType)!.push(handler);
  }

  /**
   * Unregister a message handler
   */
  off(eventType: string, handler: MessageHandler): void {
    const handlers = this.messageHandlers.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Register an error handler
   */
  onError(handler: ErrorHandler): void {
    this.errorHandlers.push(handler);
  }

  /**
   * Register a connection handler
   */
  onOpen(handler: ConnectionHandler): void {
    this.connectionHandlers.onOpen.push(handler);
  }

  /**
   * Register a disconnection handler
   */
  onClose(handler: ConnectionHandler): void {
    this.connectionHandlers.onClose.push(handler);
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Get current session ID
   */
  getSessionId(): string | null {
    return this.sessionId;
  }

  // ============================================================================
  // WORKFLOW EVENT METHODS
  // ============================================================================

  /**
   * 1. Project Info - Collect project metadata through conversational questions
   * 
   * @param payload - Initial project data or user response
   *   - Initial: { name?, description?, domain? }
   *   - Follow-up: { user_response: string }
   */
  projectInfo(payload: {
    name?: string;
    description?: string;
    domain?: string;
    user_response?: string;
  }): void {
    this.send({
      event_type: 'project_info',
      user_id: this.userId,
      payload,
    });
  }

  /**
   * 2. KPI Info - Collect KPIs through conversational questions
   * 
   * @param payload - Initial KPI data or user response
   *   - Initial: { project_name?, project_description?, project_domain?, product_description? }
   *   - Follow-up: { user_response: string }
   */
  kpiInfo(payload: {
    project_name?: string;
    project_description?: string;
    project_domain?: string;
    product_description?: string;
    data_connection_id?: string;
    user_response?: string;
  }): void {
    this.send({
      event_type: 'kpi_info',
      user_id: this.userId,
      payload,
    });
  }

  /**
   * 3. Dashboard Creation - Create dashboard with conversational flow
   * 
   * @param payload - Initial dashboard data or user response
   *   - Initial: { project_id: string } (required)
   *   - Follow-up: { user_response: string }
   */
  dashboardCreation(payload: {
    project_id: string;
    user_response?: string;
  }): void {
    this.send({
      event_type: 'dashboard_creation',
      user_id: this.userId,
      payload,
    });
  }

  /**
   * 4. Chart Creation - Generate chart specifications from NLQ query
   * 
   * @param payload - Chart creation parameters
   */
  chartCreation(payload: {
    nlq_query: string;
    data_connection_id: string;
    db_schema: string; // JSON string of database schema
    db_type: "mysql" | "postgres" | "sqlite";
    role: string;
    domain?: string;
    kpi_info?: string; // Project-level KPIs
    dashboard_kpi_info?: string; // Dashboard-level KPIs (has priority)
    product_info?: string;
    conversation_summary?: string;
    min_max_dates?: [string, string]; // [min_date, max_date]
    sample_data?: string;
    user_response?: string;
    existing_state?: Record<string, any>;
    continue_workflow?: boolean;
  }): void {
    // Convert min_max_dates array to format expected by backend
    const formattedPayload: any = { ...payload };
    if (payload.min_max_dates) {
      formattedPayload.min_max_dates = payload.min_max_dates;
    }

    this.send({
      event_type: 'chart_creation',
      user_id: this.userId,
      payload: formattedPayload,
    });
  }
}
