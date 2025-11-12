# WebSocket Integration Guide for VizAI Frontend

## Overview

This guide explains how to integrate the WebSocket API for conversational workflows in the VizAI frontend application.

## The 4 Main Workflow Events

1. **`project_info`** - Collect project metadata and generate enhanced description through conversational questions (up to 5 questions)
2. **`kpi_info`** - Collect KPIs through conversational questions (up to 5 questions)
3. **`dashboard_creation`** - Create a dashboard with name, optional description, and KPI-related questions
4. **`chart_creation`** - Generate chart specifications using QueryGenerator based on context

## WebSocket URL

The WebSocket service is configured to use:
```
wss://nonmyopic-diligently-madden.ngrok-free.dev/ws/vizai
```

Note: The service automatically converts `https://` to `wss://` for secure WebSocket connections.

---

## Step-by-Step Integration Guide

### Step 1: Update WebSocket Service

The WebSocket service is located at `src/services/websocket.ts`. It has been updated with:
- Correct WebSocket URL
- Helper methods for all 4 workflow events
- Proper TypeScript types
- Error handling and reconnection logic

### Step 2: Get User ID

The WebSocket requires a `user_id` for all events. You can get it from:
- `currentUser.id` (from authentication)
- Stored in App.tsx after login

Example:
```typescript
const userId = currentUser?.id; // From getCurrentUser() API response
```

### Step 3: Initialize WebSocket Connection

```typescript
import { VizAIWebSocket } from '../services/websocket';

// In your component
const [wsClient, setWsClient] = useState<VizAIWebSocket | null>(null);

useEffect(() => {
  if (userId) {
    const client = new VizAIWebSocket(userId);
    client.connect().then(() => {
      setWsClient(client);
    }).catch((error) => {
      console.error('Failed to connect WebSocket:', error);
    });
    
    // Cleanup on unmount
    return () => {
      client.disconnect();
    };
  }
}, [userId]);
```

### Step 4: Implement Event Handlers

#### 4.1 Project Info (`project_info`)

**Purpose**: Collect project metadata with conversational questions

**Initial Request**:
```typescript
wsClient?.projectInfo({
  name: "My Analytics Project",        // Optional
  description: "Project description",  // Optional
  domain: "data analytics"              // Optional
});
```

**Handle Responses**:
```typescript
wsClient?.on('project_info', (response) => {
  if (response.status === 'collecting') {
    // Show question to user
    const question = response.message;
    // Display question in UI and wait for user response
  } else if (response.status === 'completed') {
    // Get enhanced description
    const enhancedDescription = response.state?.enhanced_description;
    const projectName = response.state?.name;
    const domain = response.state?.domain;
    // Use this data to create project
  } else if (response.status === 'error') {
    // Handle error
    console.error(response.error);
  }
});
```

**Send User Response**:
```typescript
wsClient?.projectInfo({
  user_response: "Answer to the question"
});
```

#### 4.2 KPI Info (`kpi_info`)

**Purpose**: Collect KPIs through conversational questions

**Initial Request**:
```typescript
wsClient?.kpiInfo({
  project_name: "My Analytics Project",
  project_description: "Enhanced description from project_info",
  project_domain: "data analytics",
  product_description: "Enhanced description from project_info questions" // Optional, has priority
});
```

**Handle Responses**:
```typescript
wsClient?.on('kpi_info', (response) => {
  if (response.status === 'collecting') {
    // Show question to user
    const question = response.message;
  } else if (response.status === 'completed') {
    // Get KPIs
    const kpis = response.state?.kpis; // Array of KPI strings
    const kpisSummary = response.state?.kpis_summary; // Comma-separated string
    // Use KPIs for project/dashboard creation
  }
});
```

**Send User Response**:
```typescript
wsClient?.kpiInfo({
  user_response: "Revenue, User Growth, Conversion Rate"
});
```

#### 4.3 Dashboard Creation (`dashboard_creation`)

**Purpose**: Create dashboard with conversational flow

**Initial Request**:
```typescript
wsClient?.dashboardCreation({
  project_id: "project-uuid-789"  // Required
});
```

**Handle Responses**:
```typescript
wsClient?.on('dashboard_creation', (response) => {
  if (response.status === 'collecting') {
    // Show question to user
    const question = response.message;
    const missingFields = response.missing_fields; // e.g., ["name"]
  } else if (response.status === 'completed') {
    // Get dashboard info
    const dashboardName = response.state?.name;
    const description = response.state?.description;
    const enhancedDescription = response.state?.enhanced_description;
    const projectId = response.state?.project_id;
    // Create dashboard via API
  }
});
```

**Send User Response**:
```typescript
wsClient?.dashboardCreation({
  user_response: "User Analytics Dashboard"
});
```

#### 4.4 Chart Creation (`chart_creation`)

**Purpose**: Generate chart specifications from NLQ query

**Request**:
```typescript
wsClient?.chartCreation({
  nlq_query: "Show me user growth over time",
  data_connection_id: "connection-uuid-123",
  db_schema: JSON.stringify({
    tables: [
      {
        name: "users",
        columns: [
          { name: "id", type: "INTEGER" },
          { name: "created_at", type: "DATETIME" }
        ],
        primary_keys: ["id"],
        foreign_keys: []
      }
    ]
  }),
  db_type: "mysql", // "mysql", "postgres", or "sqlite"
  role: "Analyst",
  domain: "data analytics", // Optional
  kpi_info: "Revenue, User Growth", // Optional - Project-level KPIs
  dashboard_kpi_info: "Active Users", // Optional - Dashboard-level KPIs (has priority)
  product_info: "Product description", // Optional
  conversation_summary: "User wants to track metrics", // Optional
  min_max_dates: ["2024-01-01", "2024-12-31"], // Optional
  sample_data: "Sample data string" // Optional
});
```

**Handle Responses**:
```typescript
wsClient?.on('chart_creation', (response) => {
  if (response.status === 'completed') {
    // Get chart specifications
    const chartSpecs = response.state?.chart_specs; // Array of chart specs
    chartSpecs.forEach((spec) => {
      // spec.title
      // spec.query (may contain [MIN_DATE] and [MAX_DATE] placeholders)
      // spec.type ("time_series" | "aggregate")
      // spec.chart_type ("bar" | "line" | "area" | "pie" | "donut" | "scatter")
      // spec.relevance (0.0-1.0)
      // spec.is_time_based
      // spec.data_connection_id
    });
    // Create charts via API (addChartToDashboard)
  } else if (response.status === 'error') {
    console.error(response.error);
  }
});
```

---

## Complete Integration Example

### Example: Project Creation with Conversational Flow

```typescript
import { useState, useEffect } from 'react';
import { VizAIWebSocket, WebSocketResponse } from '../services/websocket';
import { getCurrentUser } from '../services/api';

function ProjectCreationFlow() {
  const [wsClient, setWsClient] = useState<VizAIWebSocket | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<string | null>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [projectData, setProjectData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const initWebSocket = async () => {
      // Get user ID
      const userResponse = await getCurrentUser();
      if (!userResponse.success || !userResponse.data) return;
      
      const userId = userResponse.data.id;
      const client = new VizAIWebSocket(userId);
      
      // Handle project_info responses
      client.on('project_info', (response: WebSocketResponse) => {
        if (response.status === 'collecting') {
          setCurrentQuestion(response.message);
          setIsLoading(false);
        } else if (response.status === 'completed') {
          setProjectData(response.state);
          setCurrentQuestion(null);
          // Now you can create the project with enhanced description
        } else if (response.status === 'error') {
          console.error('Error:', response.error);
          setIsLoading(false);
        }
      });
      
      await client.connect();
      setWsClient(client);
      
      return () => client.disconnect();
    };
    
    initWebSocket();
  }, []);

  const startProjectInfo = () => {
    setIsLoading(true);
    wsClient?.projectInfo({
      name: "My New Project",
      domain: "data analytics"
    });
  };

  const submitAnswer = () => {
    if (!userAnswer.trim()) return;
    setIsLoading(true);
    wsClient?.projectInfo({
      user_response: userAnswer
    });
    setUserAnswer('');
  };

  return (
    <div>
      {!currentQuestion && !projectData && (
        <button onClick={startProjectInfo}>Start Project Creation</button>
      )}
      
      {currentQuestion && (
        <div>
          <p>{currentQuestion}</p>
          <input
            value={userAnswer}
            onChange={(e) => setUserAnswer(e.target.value)}
            placeholder="Your answer..."
          />
          <button onClick={submitAnswer} disabled={isLoading}>
            Submit
          </button>
        </div>
      )}
      
      {projectData && (
        <div>
          <h3>Project Ready!</h3>
          <p>Name: {projectData.name}</p>
          <p>Enhanced Description: {projectData.enhanced_description}</p>
        </div>
      )}
    </div>
  );
}
```

### Example: Chart Creation

```typescript
import { VizAIWebSocket } from '../services/websocket';
import { addChartToDashboard } from '../services/api';

async function createChartsFromNLQ(
  wsClient: VizAIWebSocket,
  nlqQuery: string,
  dataConnectionId: string,
  dbSchema: any,
  dbType: string,
  dashboardId: string,
  kpiInfo?: string,
  dashboardKpiInfo?: string
) {
  return new Promise((resolve, reject) => {
    wsClient.on('chart_creation', async (response) => {
      if (response.status === 'completed') {
        const chartSpecs = response.state?.chart_specs || [];
        
        // Create charts via API
        const createdCharts = [];
        for (const spec of chartSpecs) {
          // Replace date placeholders if needed
          let query = spec.query;
          if (spec.is_time_based) {
            query = query.replace('[MIN_DATE]', '2024-01-01');
            query = query.replace('[MAX_DATE]', '2024-12-31');
          }
          
          const result = await addChartToDashboard({
            title: spec.title,
            query: query,
            chart_type: spec.chart_type,
            dashboard_id: dashboardId,
            data_connection_id: spec.data_connection_id,
            report: spec.report,
            type: spec.type,
            relevance: String(spec.relevance),
            is_time_based: spec.is_time_based
          });
          
          if (result.success) {
            createdCharts.push(result.data);
          }
        }
        
        resolve(createdCharts);
      } else if (response.status === 'error') {
        reject(new Error(response.error || 'Chart creation failed'));
      }
    });
    
    // Send chart creation request
    wsClient.chartCreation({
      nlq_query: nlqQuery,
      data_connection_id: dataConnectionId,
      db_schema: JSON.stringify(dbSchema),
      db_type: dbType,
      role: "Analyst",
      kpi_info: kpiInfo,
      dashboard_kpi_info: dashboardKpiInfo
    });
  });
}
```

---

## Integration Points in Existing Code

### 1. Project Creation (`ProjectsView.tsx`)

Replace the simple project creation with conversational flow:

```typescript
// Instead of directly calling createProject
// 1. Initialize WebSocket
// 2. Call projectInfo() with initial data
// 3. Handle questions and collect answers
// 4. When completed, call createProject with enhanced_description
// 5. Then call kpiInfo() to collect KPIs
```

### 2. Dashboard Creation (`WorkspaceView.tsx`)

Replace simple dashboard creation:

```typescript
// Instead of directly calling createDashboard
// 1. Call dashboardCreation() with project_id
// 2. Handle questions (name, description, KPIs)
// 3. When completed, call createDashboard with collected data
```

### 3. Chart Creation (`AIAssistant.tsx` or `ChartsView.tsx`)

Enhance chart creation with WebSocket:

```typescript
// When user asks for charts via NLQ
// 1. Call chartCreation() with NLQ query and context
// 2. Handle chart_specs in response
// 3. Create charts via addChartToDashboard API
```

---

## Important Notes

1. **Session Management**: The WebSocket maintains a session per user. Call `startSession()` on connect and `endSession()` on disconnect.

2. **Keepalive Messages**: The server may send keepalive messages (`{ type: "keepalive" }`). These are automatically filtered by the WebSocket service.

3. **Error Handling**: Always handle error status in responses. The WebSocket service includes reconnection logic for connection errors.

4. **Date Placeholders**: Chart queries may contain `[MIN_DATE]` and `[MAX_DATE]` placeholders that need to be replaced with actual dates.

5. **Priority**: Dashboard KPIs have priority over project KPIs when both are provided in chart_creation.

6. **Max Questions**: 
   - `project_info`: 5 questions max
   - `kpi_info`: 5 questions max
   - `dashboard_creation`: 5 KPI-related questions (after name/description)

7. **Chart Limits**: Chart creation generates 1-7 charts based on context, capped at 7 maximum.

---

## Testing

1. Test WebSocket connection on component mount
2. Test each workflow event separately
3. Test error handling (disconnect, invalid data)
4. Test reconnection logic
5. Test with actual user interactions in UI

---

## Troubleshooting

### Connection Issues
- Check if WebSocket URL is correct
- Verify ngrok tunnel is running
- Check browser console for connection errors
- Verify CORS settings on backend

### Message Not Received
- Check if event handler is registered before sending message
- Verify message format matches API contract
- Check browser console for parsing errors

### Session Issues
- Ensure `startSession()` is called after connection
- Verify `user_id` is valid
- Check session timeout on backend

---

## Next Steps

1. Integrate `project_info` in project creation flow
2. Integrate `kpi_info` after project creation
3. Integrate `dashboard_creation` in dashboard creation flow
4. Integrate `chart_creation` in AI assistant/chart creation flow
5. Add UI components for conversational questions
6. Add loading states and error handling
7. Test end-to-end workflows

