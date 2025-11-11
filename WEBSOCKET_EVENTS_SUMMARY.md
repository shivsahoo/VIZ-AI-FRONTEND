# WebSocket API - 4 Main Workflow Events

## Overview

The VizAI WebSocket API supports 4 main conversational workflow events for creating projects, collecting KPIs, creating dashboards, and generating charts.

## WebSocket URL

```
wss://nonmyopic-diligently-madden.ngrok-free.dev/ws/vizai
```

---

## The 4 Main Workflow Events

### 1. `project_info`

**Purpose**: Collect project metadata and generate enhanced description through conversational questions.

**Flow**:
- Send initial project data (name, description, domain) - all optional
- Server asks up to 5 conversational questions
- User answers each question
- Server generates enhanced description when complete

**Key Fields**:
- `name` (optional) - Project name
- `description` (optional) - Basic project description
- `domain` (optional) - Project domain (e.g., "data analytics")
- `user_response` (for follow-ups) - Answer to the question

**Response**:
- `status: "collecting"` - More questions to ask
- `status: "completed"` - Enhanced description generated
- `state.enhanced_description` - Final enhanced description
- `state.conversation_history` - Full conversation history

---

### 2. `kpi_info`

**Purpose**: Collect KPIs through conversational questions (up to 5 questions).

**Flow**:
- Send project context (name, description, domain, enhanced description)
- Server asks up to 5 questions about KPIs
- User answers each question
- Server extracts and validates KPIs

**Key Fields**:
- `project_name` (optional) - Project name
- `project_description` (optional) - Basic project description
- `project_domain` (optional) - Project domain
- `product_description` (optional) - Enhanced description from project_info (has priority)
- `user_response` (for follow-ups) - Answer to the question

**Response**:
- `status: "collecting"` - More questions to ask
- `status: "completed"` - KPIs collected
- `state.kpis` - Array of KPI strings
- `state.kpis_summary` - Comma-separated KPI string

---

### 3. `dashboard_creation`

**Purpose**: Create a dashboard with name, optional description, and KPI-related questions.

**Flow**:
- Send project_id (required)
- Server asks for dashboard name (required)
- Server optionally asks for description
- Server asks up to 5 KPI-related questions
- Server provides enhanced description when complete

**Key Fields**:
- `project_id` (required) - Project UUID
- `user_response` (for follow-ups) - Answer to the question

**Response**:
- `status: "collecting"` - More questions to ask
- `status: "completed"` - Dashboard info collected
- `state.name` - Dashboard name
- `state.description` - Dashboard description
- `state.enhanced_description` - Enhanced description after KPI questions
- `state.project_id` - Project ID

---

### 4. `chart_creation`

**Purpose**: Generate chart specifications using QueryGenerator based on context.

**Flow**:
- Send NLQ query and database context
- Server generates 1-7 chart specifications
- Returns chart specs with SQL queries, chart types, and metadata

**Key Fields**:
- `nlq_query` (required) - Natural language query
- `data_connection_id` (required) - Database connection UUID
- `db_schema` (required) - JSON string of database schema
- `db_type` (required) - "mysql", "postgres", or "sqlite"
- `role` (required) - User role for query generation
- `domain` (optional) - Project domain
- `kpi_info` (optional) - Project-level KPIs
- `dashboard_kpi_info` (optional) - Dashboard-level KPIs (has priority)
- `product_info` (optional) - Product/context description
- `conversation_summary` (optional) - Conversation summary
- `min_max_dates` (optional) - [min_date, max_date] for time-based queries
- `sample_data` (optional) - Sample data to enhance generation

**Response**:
- `status: "completed"` - Chart specs generated
- `state.chart_specs` - Array of chart specifications (1-7 charts)
- Each chart spec contains:
  - `title` - Chart title
  - `query` - SQL query (may contain [MIN_DATE] and [MAX_DATE] placeholders)
  - `type` - "time_series" or "aggregate"
  - `chart_type` - "bar", "line", "area", "pie", "donut", or "scatter"
  - `relevance` - Relevance score (0.0-1.0)
  - `is_time_based` - Whether query uses time-based data
  - `data_connection_id` - Database connection ID

---

## Usage Example

```typescript
import { VizAIWebSocket } from './services/websocket';

// Initialize WebSocket
const userId = "user-uuid-123";
const wsClient = new VizAIWebSocket(userId);
await wsClient.connect();

// 1. Project Info
wsClient.on('project_info', (response) => {
  if (response.status === 'completed') {
    const enhancedDescription = response.state?.enhanced_description;
    // Use enhanced description to create project
  }
});
wsClient.projectInfo({ name: "My Project", domain: "data analytics" });

// 2. KPI Info
wsClient.on('kpi_info', (response) => {
  if (response.status === 'completed') {
    const kpis = response.state?.kpis; // Array of KPIs
    // Use KPIs for project/dashboard
  }
});
wsClient.kpiInfo({ 
  project_name: "My Project",
  product_description: enhancedDescription 
});

// 3. Dashboard Creation
wsClient.on('dashboard_creation', (response) => {
  if (response.status === 'completed') {
    const dashboardName = response.state?.name;
    const enhancedDescription = response.state?.enhanced_description;
    // Create dashboard with collected info
  }
});
wsClient.dashboardCreation({ project_id: "project-uuid-789" });

// 4. Chart Creation
wsClient.on('chart_creation', (response) => {
  if (response.status === 'completed') {
    const chartSpecs = response.state?.chart_specs;
    // Create charts from specs
    chartSpecs.forEach(spec => {
      // Create chart via API
    });
  }
});
wsClient.chartCreation({
  nlq_query: "Show me user growth over time",
  data_connection_id: "connection-uuid-123",
  db_schema: JSON.stringify({ tables: [...] }),
  db_type: "mysql",
  role: "Analyst",
  kpi_info: "Revenue, User Growth",
  dashboard_kpi_info: "Active Users"
});
```

---

## Important Notes

1. **Session Management**: Always call `startSession()` on connect (automatically called) and `endSession()` on disconnect.

2. **Question Flow**: Events 1, 2, and 3 are conversational - you'll receive multiple responses with `status: "collecting"` until `status: "completed"`.

3. **Chart Generation**: Event 4 (`chart_creation`) is not conversational - it returns chart specs immediately.

4. **Date Placeholders**: Chart queries may contain `[MIN_DATE]` and `[MAX_DATE]` placeholders that need to be replaced.

5. **Priority**: Dashboard KPIs have priority over project KPIs in chart_creation.

6. **Max Questions**: 
   - `project_info`: 5 questions max
   - `kpi_info`: 5 questions max
   - `dashboard_creation`: 5 KPI-related questions (after name/description)

7. **Chart Limits**: Chart creation generates 1-7 charts based on context, capped at 7 maximum.

---

## Next Steps

See `WEBSOCKET_INTEGRATION_GUIDE.md` for detailed integration instructions.

