# VizAI Components Documentation

This document provides detailed documentation for all components in the VizAI application.

## Table of Contents

- [Shared Components](#shared-components)
- [Feature Components](#feature-components)
- [UI Components](#ui-components)
- [Component Patterns](#component-patterns)

---

## Shared Components

Reusable components used across multiple features.

### EmptyState

**Location**: `/components/shared/EmptyState.tsx`

Displays empty states with icon, title, description, and optional action button.

**Props:**
- `icon` (ReactNode): Icon to display
- `title` (string): Main heading text
- `description` (string): Descriptive text
- `action` (ReactNode, optional): Action button or element
- `className` (string, optional): Additional CSS classes

**Example:**
```tsx
<EmptyState
  icon={<Database className="w-12 h-12" />}
  title="No databases connected"
  description="Connect your first database to start analyzing data"
  action={<Button onClick={handleConnect}>Connect Database</Button>}
/>
```

---

### LoadingSpinner

**Location**: `/components/shared/LoadingSpinner.tsx`

Animated loading spinner with multiple size variants.

**Props:**
- `size` ('sm' | 'md' | 'lg' | 'xl', optional): Size variant (default: 'md')
- `text` (string, optional): Loading text to display below spinner
- `className` (string, optional): Additional CSS classes

**Example:**
```tsx
<LoadingSpinner size="lg" text="Loading data..." />
```

---

### StatCard

**Location**: `/components/shared/StatCard.tsx`

Card component for displaying statistics and metrics with trend indicators.

**Props:**
- `title` (string): Card title/label
- `value` (string | number): Main value to display
- `change` (string, optional): Change percentage or text
- `trend` ('up' | 'down' | 'neutral', optional): Trend direction
- `icon` (ReactNode, optional): Icon to display
- `description` (string, optional): Description text
- `onClick` (function, optional): Click handler
- `className` (string, optional): Additional CSS classes

**Example:**
```tsx
<StatCard
  title="Total Revenue"
  value="$124,590"
  change="+12.5%"
  trend="up"
  icon={<DollarSign className="w-5 h-5" />}
/>
```

---

### PageHeader

**Location**: `/components/shared/PageHeader.tsx`

Consistent page header with title, description, and action buttons.

**Props:**
- `title` (string): Page title
- `description` (string, optional): Page description
- `action` (ReactNode, optional): Action buttons or elements
- `breadcrumb` (ReactNode, optional): Breadcrumb navigation
- `className` (string, optional): Additional CSS classes

**Example:**
```tsx
<PageHeader
  title="Dashboards"
  description="Create and manage your data visualization dashboards"
  action={<Button onClick={handleCreate}>Create Dashboard</Button>}
/>
```

---

### SearchInput

**Location**: `/components/shared/SearchInput.tsx`

Search input with icon, clear functionality, and optional debouncing.

**Props:**
- `placeholder` (string, optional): Placeholder text
- `value` (string): Current search value
- `onChange` (function): Change handler
- `debounce` (number, optional): Debounce delay in ms
- `className` (string, optional): Additional CSS classes

**Example:**
```tsx
<SearchInput
  placeholder="Search charts..."
  value={searchQuery}
  onChange={setSearchQuery}
  debounce={300}
/>
```

---

### ConfirmDialog

**Location**: `/components/shared/ConfirmDialog.tsx`

Confirmation dialog for destructive actions.

**Props:**
- `open` (boolean): Whether dialog is open
- `onOpenChange` (function): Callback when open state changes
- `title` (string): Dialog title
- `description` (string): Dialog description/message
- `onConfirm` (function): Confirm button handler
- `confirmText` (string, optional): Confirm button text
- `cancelText` (string, optional): Cancel button text
- `variant` ('default' | 'destructive', optional): Button variant

**Example:**
```tsx
<ConfirmDialog
  open={isOpen}
  onOpenChange={setIsOpen}
  title="Delete Chart"
  description="Are you sure you want to delete this chart? This action cannot be undone."
  onConfirm={handleDelete}
  confirmText="Delete"
  variant="destructive"
/>
```

---

## Feature Components

### TopBar

**Location**: `/components/TopBar.tsx`

Main navigation bar with project selector, theme toggle, and user menu.

**Features:**
- Logo and branding
- Project selector dropdown (in workspace)
- Current workspace tab breadcrumb
- Theme toggle button
- User profile menu

**Props:**
- `currentView` (string): Active view/route
- `onNavigate` (function): Navigation handler
- `selectedProject` (string | null): Current project
- `workspaceTab` (string): Active workspace tab
- `projects` (Project[]): List of projects
- `onProjectChange` (function): Project change handler
- `user` (User): Current user object
- `onSignOut` (function): Sign out handler
- `isDark` (boolean): Dark mode state
- `onThemeToggle` (function): Theme toggle handler

---

### WorkspaceSidebar

**Location**: `/components/WorkspaceSidebar.tsx`

Workspace navigation sidebar with contextual menu items.

**Features:**
- Workspace navigation menu
- Active tab highlighting
- Icon-based menu items
- Responsive design

**Props:**
- `activeTab` (string): Currently active tab
- `onTabChange` (function): Tab change handler

**Navigation Items:**
- Home: Dashboard overview
- Charts: Chart management
- Dashboards: Dashboard management
- Databases: Database connections
- Ask VizAI: AI query interface
- Insights: AI insights
- Team: User management

---

### ChartCard

**Location**: `/components/ChartCard.tsx`

Reusable card component for displaying chart previews.

**Features:**
- Chart preview visualization
- Pin/unpin functionality
- Edit and delete actions
- Hover effects and animations

**Props:**
- `chart` (Chart): Chart data object
- `onEdit` (function): Edit handler
- `onDelete` (function): Delete handler
- `onPin` (function): Pin handler
- `isPinned` (boolean): Pin state

---

### DashboardCard

**Location**: `/components/DashboardCard.tsx`

Reusable card component for displaying dashboard previews.

**Features:**
- Dashboard metadata display
- Chart count indicator
- Last updated timestamp
- Click to open dashboard

**Props:**
- `dashboard` (Dashboard): Dashboard data object
- `onClick` (function): Click handler

---

### AIAssistant

**Location**: `/components/AIAssistant.tsx`

Slide-out AI chat assistant panel.

**Features:**
- Conversational interface
- Message history
- Typing indicators
- Smooth slide-in animation

**Props:**
- `isOpen` (boolean): Whether panel is open
- `onClose` (function): Close handler

---

## Feature Views

### AuthView

**Location**: `/components/AuthView.tsx`

Authentication screen with login/signup forms.

**Features:**
- Login form with email/password
- Sign up form with organization setup
- Form validation
- Loading states

---

### OnboardingFlow

**Location**: `/components/OnboardingFlow.tsx`

4-step onboarding wizard for new users.

**Steps:**
1. Welcome & account setup
2. Project creation
3. Database connection
4. Dashboard setup

**Features:**
- Step progress indicator
- Form validation
- Smooth transitions
- Skip functionality

---

### ProjectsView

**Location**: `/components/ProjectsView.tsx`

Project selector and management page.

**Features:**
- Grid view of projects
- Search and filter
- Create new project
- Project metadata cards

---

### HomeDashboardView

**Location**: `/components/HomeDashboardView.tsx`

Workspace home page with overview metrics.

**Features:**
- KPI stat cards
- Recent activity feed
- Pinned charts quick access
- Chart visualizations with Recharts

---

### ChartsView

**Location**: `/components/ChartsView.tsx`

Chart management page with grid/list view.

**Features:**
- Create new charts
- Search and filter charts
- Grid/list view toggle
- Chart cards with actions
- AI Assistant integration

---

### DashboardsView

**Location**: `/components/DashboardsView.tsx`

Dashboard management page.

**Features:**
- Create dashboard with AI bot
- Dashboard grid view
- Search and filter
- Dashboard cards

---

### DatabasesView

**Location**: `/components/DatabasesView.tsx`

Database connection management page.

**Features:**
- Add PostgreSQL/MySQL connections
- Connection status indicators
- Test connections
- View table schemas

---

### AskVizAIView

**Location**: `/components/AskVizAIView.tsx`

Conversational AI query interface.

**Features:**
- Natural language input
- Query suggestions
- SQL generation
- Query history
- Result visualization

---

### InsightsView

**Location**: `/components/InsightsView.tsx`

AI-generated insights and recommendations.

**Features:**
- Auto-generated insights
- Trend analysis cards
- Anomaly detection
- Actionable recommendations

---

### UsersView

**Location**: `/components/UsersView.tsx`

Team and role management page.

**Features:**
- Invite team members
- Role assignment (Admin, Member, Custom)
- Database/table-level permissions
- User list with status

---

### SettingsView

**Location**: `/components/SettingsView.tsx`

Application settings and preferences.

**Features:**
- Profile settings
- Workspace preferences
- Audit logs viewer
- Integration settings

---

## Context Providers

### PinnedChartsContext

**Location**: `/components/PinnedChartsContext.tsx`

Global state management for pinned charts.

**API:**
- `pinnedCharts`: Array of pinned chart data
- `addPinnedChart(chart)`: Add chart to pins
- `removePinnedChart(chartId)`: Remove chart from pins
- `isPinned(chartId)`: Check if chart is pinned

**Storage:** Persists to localStorage

---

## Component Patterns

### Container/Presentational Pattern

**Container Components:**
- Manage state and business logic
- Handle data fetching
- Connect to contexts
- Examples: ChartsView, DashboardsView

**Presentational Components:**
- Receive data via props
- Focus on UI rendering
- Reusable across app
- Examples: ChartCard, DashboardCard

### Composition Pattern

Build complex UIs from simple components:

```tsx
<WorkspaceView>
  <TopBar />
  <div className="flex">
    <WorkspaceSidebar />
    <main>
      <PageHeader />
      <StatCard />
      <ChartCard />
    </main>
  </div>
</WorkspaceView>
```

### Prop Drilling vs Context

**Use Props for:**
- Component-specific data
- Simple parent-child relationships
- Type-safe data flow

**Use Context for:**
- Global state (theme, user, etc.)
- Deeply nested components
- Cross-cutting concerns

---

## Best Practices

### Component Creation

1. **Single Responsibility**: Each component has one clear purpose
2. **Props Interface**: Always define TypeScript interface for props
3. **JSDoc Comments**: Document component purpose and usage
4. **Default Props**: Provide sensible defaults where appropriate
5. **Error Handling**: Handle edge cases gracefully

### State Management

1. **Local State**: Use `useState` for component-specific state
2. **Context**: Use Context API for global/shared state
3. **Derived State**: Use `useMemo` for computed values
4. **Side Effects**: Use `useEffect` for data fetching and subscriptions

### Performance

1. **React.memo**: Memoize expensive components
2. **useCallback**: Memoize event handlers passed as props
3. **useMemo**: Memoize expensive computations
4. **Lazy Loading**: Code-split large components
5. **Virtual Scrolling**: For long lists (planned)

### Accessibility

1. **Semantic HTML**: Use appropriate HTML elements
2. **ARIA Labels**: Add labels for screen readers
3. **Keyboard Navigation**: Support keyboard interactions
4. **Focus Management**: Manage focus for dialogs/modals
5. **Color Contrast**: Ensure sufficient contrast ratios

### Testing (Planned)

1. **Unit Tests**: Test component logic and rendering
2. **Integration Tests**: Test component interactions
3. **Accessibility Tests**: Test with screen readers
4. **Visual Regression**: Test UI consistency

---

## Component Lifecycle

### Mounting

```tsx
useEffect(() => {
  // Component mounted
  // Fetch data, add event listeners, etc.
  
  return () => {
    // Component unmounting
    // Cleanup: remove listeners, cancel requests
  };
}, []); // Empty deps = mount/unmount only
```

### Updating

```tsx
useEffect(() => {
  // Runs when dependencies change
}, [dep1, dep2]);
```

### Cleanup

Always cleanup in useEffect return function:
- Remove event listeners
- Cancel network requests
- Clear timers
- Unsubscribe from observables

---

## Styling Guidelines

### Tailwind Classes

1. **Avoid font sizing classes** unless specifically requested
2. **Use design tokens** from globals.css
3. **Consistent spacing** using scale (p-4, m-6, gap-3)
4. **Responsive design** with breakpoint prefixes

### CSS Variables

Defined in `styles/globals.css`:
- `--background`: Main background color
- `--foreground`: Main text color
- `--primary`: Primary brand color
- `--border`: Border color
- `--muted`: Muted backgrounds

### Custom Animations

```css
@keyframes pulse-glow {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
```

---

## File Organization

```
/components/
├── shared/              # Reusable shared components
│   ├── EmptyState.tsx
│   ├── LoadingSpinner.tsx
│   ├── StatCard.tsx
│   ├── PageHeader.tsx
│   ├── SearchInput.tsx
│   └── ConfirmDialog.tsx
├── ui/                  # ShadCN UI components
│   ├── button.tsx
│   ├── card.tsx
│   └── ...
├── TopBar.tsx           # Layout components
├── WorkspaceSidebar.tsx
├── ChartCard.tsx        # Feature-specific components
├── DashboardCard.tsx
├── ChartsView.tsx       # Page/view components
├── DashboardsView.tsx
└── ...
```

---

**Last Updated**: November 2024  
**Version**: 1.0.0
