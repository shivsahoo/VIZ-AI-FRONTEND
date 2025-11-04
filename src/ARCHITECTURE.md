# VizAI Architecture Documentation

## System Overview

VizAI is built as a single-page application (SPA) using React with TypeScript. The application follows a component-based architecture with clear separation of concerns.

## Architecture Layers

### 1. Presentation Layer (Components)

#### Core Layout Components
- **`App.tsx`**: Root application component, manages routing and global state
- **`TopBar.tsx`**: Global navigation bar with project selector and user menu
- **`WorkspaceSidebar.tsx`**: Workspace navigation with contextual menu items
- **`WorkspaceView.tsx`**: Container for workspace-specific views

#### Feature Components
- **Authentication**: `AuthView.tsx`
- **Onboarding**: `OnboardingFlow.tsx`
- **Projects**: `ProjectsView.tsx`
- **Dashboards**: `DashboardsView.tsx`, `DashboardDetailView.tsx`, `DashboardCreationBot.tsx`
- **Charts**: `ChartsView.tsx`, `ChartCard.tsx`, `EditChartDialog.tsx`
- **Databases**: `DatabasesView.tsx`, `DatabaseConnectionFlow.tsx`
- **AI Features**: `AskVizAIView.tsx`, `AIAssistant.tsx`
- **Insights**: `InsightsView.tsx`
- **Team**: `UsersView.tsx`
- **Settings**: `SettingsView.tsx`, `ProfileView.tsx`

#### Shared UI Components
Located in `/components/ui/` - ShadCN components for consistent UI patterns

### 2. State Management

#### Context Providers
- **`PinnedChartsContext.tsx`**: Manages pinned charts across the application
  - Global state for user's pinned charts
  - Persistence to localStorage
  - Add/remove pin operations

#### Local State
- Component-level state using `useState` hook
- Form state management
- UI interaction state

#### Data Flow
```
User Action → Component Event Handler → State Update → UI Re-render
                                     ↓
                              Context/Props Update
```

### 3. Data Layer

#### Mock Data Structure
Currently using in-memory mock data for development:
- **Projects**: Array of project objects with metadata
- **Dashboards**: Dashboard configurations and layouts
- **Charts**: Chart definitions with data and settings
- **Databases**: Connection configurations
- **Users**: User profiles and role assignments

#### API Integration Points (Planned)
- REST API endpoints (see API_REFERENCE.md)
- Authentication service
- Database query service
- AI/ML service for insights

## Component Architecture Patterns

### 1. Container/Presentational Pattern

**Container Components** (Smart Components):
- Manage state and business logic
- Handle data fetching
- Connect to contexts
- Example: `ChartsView.tsx`, `DashboardsView.tsx`

**Presentational Components** (Dumb Components):
- Receive data via props
- Focus on UI rendering
- Reusable across the app
- Example: `ChartCard.tsx`, `DashboardCard.tsx`

### 2. Composition Pattern

Components are composed together to build complex UIs:

```tsx
<WorkspaceView>
  <TopBar />
  <div>
    <WorkspaceSidebar />
    <MainContent>
      {/* Feature components */}
    </MainContent>
  </div>
</WorkspaceView>
```

### 3. Render Props & Children Pattern

Used for flexible component composition:
- Dialog wrappers
- Tooltip containers
- Layout components

## Routing Structure

```
/                          → Landing/Authentication
  /onboarding             → 4-step onboarding flow
  /projects               → Project selector
  /workspace/:project     → Main workspace
    /home                 → Dashboard overview
    /charts               → Charts management
    /dashboards           → Dashboards management
    /databases            → Database connections
    /ask-vizai            → AI query interface
    /insights             → AI insights
    /team                 → User management
    /settings             → Settings & preferences
  /profile                → User profile
```

## State Management Architecture

### Global State (Context)
```
PinnedChartsContext
├── pinnedCharts: PinnedChartData[]
├── addPinnedChart(chart: PinnedChartData)
├── removePinnedChart(chartId: string)
└── isPinned(chartId: string): boolean
```

### Component State Examples

#### App.tsx State
```typescript
- currentView: string              // Active view/route
- selectedProject: string | null   // Current project
- workspaceTab: string            // Active workspace tab
- projects: Project[]             // List of projects
- user: User                      // Current user
- isDark: boolean                 // Theme preference
```

## Permission System Architecture

### Role Definitions

```typescript
interface Role {
  name: string;
  permissions: {
    projects: Permission;
    team: Permission;
    databases: Permission;
    dashboards: Permission;
    insights: Permission;
  };
  databaseAccess?: {
    databases: string[];
    tables: { [database: string]: string[] };
  };
}

type Permission = 'none' | 'read' | 'create' | 'update' | 'delete' | 'all';
```

### Permission Hierarchy
```
all > delete > update > create > read > none
```

### Custom Roles
- Inherit from base templates
- Override specific permissions
- Assign database/table access
- Supports principle of least privilege

## Data Flow Patterns

### 1. Props Drilling
Parent → Child → Grandchild (limited depth)

### 2. Context API
Global state accessible by any component in the tree

### 3. Event Bubbling
Child component events bubble up to parent handlers

```tsx
<ChartCard
  chart={chart}
  onPin={() => handlePin(chart.id)}
  onEdit={() => handleEdit(chart.id)}
/>
```

## UI/UX Architecture

### Design Token System
Defined in `styles/globals.css`:
- CSS custom properties for colors
- Consistent spacing scale
- Typography hierarchy
- Animation timings

### Responsive Breakpoints
```css
sm: 640px   /* Mobile landscape */
md: 768px   /* Tablet portrait */
lg: 1024px  /* Tablet landscape */
xl: 1280px  /* Desktop */
2xl: 1536px /* Large desktop */
```

### Theme System
- CSS variables for color theming
- Dark/light mode toggle
- Persisted to localStorage
- Smooth transitions between themes

## Performance Considerations

### Code Splitting
- Lazy loading for route-based components (planned)
- Dynamic imports for heavy features

### Optimization Strategies
- React.memo for expensive components
- useMemo for computed values
- useCallback for event handlers
- Debouncing for search inputs

### Rendering Optimization
- Virtual scrolling for long lists (planned)
- Pagination for large datasets
- Skeleton loaders for better perceived performance

## Error Handling Architecture

### Error Boundaries
- Top-level error boundary (planned)
- Feature-specific error boundaries
- Graceful degradation

### User Feedback
- Toast notifications (Sonner)
- Inline validation messages
- Error states in components

## Security Architecture

### Authentication Flow
```
Login → Validate Credentials → Generate Session → Store User Data
                                                 ↓
                                          Redirect to Workspace
```

### Authorization
- Role-based access control (RBAC)
- Permission checks before rendering
- API-level permission enforcement (planned)

### Data Security
- No sensitive data in localStorage
- Secure API communication (planned: HTTPS only)
- Input validation and sanitization

## Testing Strategy (Planned)

### Unit Tests
- Component testing with React Testing Library
- Utility function tests
- Custom hook tests

### Integration Tests
- User flow testing
- Component integration tests
- API integration tests

### E2E Tests
- Critical user journeys
- Cross-browser testing
- Accessibility testing

## Build & Deployment

### Build Process
```
TypeScript Compilation → Bundling (Vite) → Minification → Optimization
```

### Environment Configuration
- Development: Hot module replacement, source maps
- Production: Minified, optimized, tree-shaken

## Scalability Considerations

### Frontend Scalability
- Component-based architecture for easy feature additions
- Modular design for independent development
- Reusable component library

### Data Scalability
- Pagination for large datasets
- Virtual scrolling for performance
- Efficient state updates

### Team Scalability
- Clear component boundaries
- Documentation standards
- Consistent code patterns

## Future Enhancements

### Planned Features
1. Real-time collaboration
2. Advanced chart customization
3. Export/import capabilities
4. Mobile app version
5. Plugin system for extensions

### Technical Debt
1. Implement proper API integration
2. Add comprehensive error boundaries
3. Optimize bundle size
4. Add comprehensive testing
5. Implement proper caching strategies

## Dependencies

### Core Dependencies
- `react`: ^18.0.0 - UI library
- `react-dom`: ^18.0.0 - DOM rendering
- `typescript`: ^5.0.0 - Type safety

### UI Dependencies
- `tailwindcss`: ^4.0.0 - Styling
- `lucide-react`: Icons
- `recharts`: Charts library
- `sonner`: Toast notifications
- `motion/react`: Animations

### Utility Dependencies
- ShadCN UI components - Pre-built accessible components

## Code Organization Principles

1. **Single Responsibility**: Each component has one clear purpose
2. **DRY (Don't Repeat Yourself)**: Reusable components and utilities
3. **KISS (Keep It Simple)**: Simple, readable code over clever solutions
4. **Separation of Concerns**: UI, logic, and data layers are separate
5. **Composition over Inheritance**: Build complex UIs from simple components

---

**Last Updated**: November 2024  
**Version**: 1.0.0
