# VIZ-AI Frontend - Folder Structure Guide

This document provides a comprehensive overview of the project's folder structure, explaining what each directory contains and its purpose.

## 📁 Root Directory Structure

```
VIZ-AI-Frontend/
├── .git/                    # Git repository metadata
├── .vite/                   # Vite build cache (auto-generated)
├── node_modules/            # NPM/Yarn dependencies (auto-generated)
├── src/                     # Source code (main application code)
├── index.html               # HTML entry point
├── package.json             # Project dependencies and scripts
├── tsconfig.json            # TypeScript configuration for app
├── tsconfig.node.json       # TypeScript configuration for Node.js files
├── vite.config.ts           # Vite build tool configuration
├── yarn.lock                # Locked dependency versions
├── .gitignore               # Git ignore rules
├── README.md                # Project overview
└── API_INTEGRATION.md       # API integration documentation
```

---

## 📂 Source Directory (`src/`)

The main source code directory containing all application logic, components, and assets.

### Core Application Files

- **`App.tsx`** - Main application component, handles routing and state management
- **`main.tsx`** - Application entry point, renders App component
- **`index.css`** - Global CSS styles and Tailwind CSS imports
- **`vite-env.d.ts`** - Vite environment type definitions

---

## 📂 Pages (`src/pages/`)

**Purpose**: Full-page components that represent different views/screens in the application.

These are the main views that users navigate to:

| File | Purpose |
|------|---------|
| `AuthView.tsx` | Login/authentication page |
| `ProjectsView.tsx` | List of all projects |
| `WorkspaceView.tsx` | Main workspace container |
| `HomeDashboardView.tsx` | Home dashboard with overview |
| `ChartsView.tsx` | Charts management page |
| `DashboardsView.tsx` | Dashboards list page |
| `DashboardDetailView.tsx` | Individual dashboard detail page |
| `DatabasesView.tsx` | Database connections management |
| `AskVizAIView.tsx` | AI assistant interface |
| `InsightsView.tsx` | Insights and analytics page |
| `UsersView.tsx` | User management page |
| `SettingsView.tsx` | Application settings |
| `ProfileView.tsx` | User profile page |
| `OnboardingFlow.tsx` | First-time user onboarding |

**Usage**: These components are imported and rendered in `App.tsx` based on the current route/view state.

---

## 📂 Components (`src/components/`)

**Purpose**: Reusable React components organized by their purpose and scope.

### Layout Components (`components/layout/`)

Components that define the overall page structure:

- **`TopBar.tsx`** - Top navigation bar with user menu, theme toggle, notifications
- **`WorkspaceSidebar.tsx`** - Left sidebar navigation menu

### Feature Components (`components/features/`)

**Purpose**: Feature-specific components grouped by domain.

#### AI Features (`features/ai/`)
- **`AIAssistant.tsx`** - Main AI assistant chat interface
- **`ProjectContextBot.tsx`** - AI bot for project context gathering

#### Chart Features (`features/charts/`)
- **`ChartCard.tsx`** - Individual chart card component
- **`ChartPreviewDialog.tsx`** - Dialog for previewing charts
- **`ChartTooltip.tsx`** - Custom tooltip for chart interactions
- **`EditChartDialog.tsx`** - Dialog for editing chart properties

#### Dashboard Features (`features/dashboards/`)
- **`DashboardCard.tsx`** - Individual dashboard card component
- **`DashboardCreationBot.tsx`** - AI bot for creating dashboards

#### Database Features (`features/databases/`)
- **`DatabaseConnectionFlow.tsx`** - Multi-step database connection wizard
- **`DatabaseContextBot.tsx`** - AI bot for database context
- **`DatabaseSetupGuided.tsx`** - Guided database setup form
- **`TableSelectionView.tsx`** - Interface for selecting database tables

### Shared Components (`components/shared/`)

**Purpose**: Reusable components used across multiple features.

These are the workhorse components that eliminate code duplication:

- **`ActionButtonGroup.tsx`** - Group of hover-visible action buttons (edit, delete, pin)
- **`ConfirmDialog.tsx`** - Reusable confirmation dialog
- **`EmptyState.tsx`** - Empty state display (no data, no results)
- **`GradientButton.tsx`** - Button with gradient styling (primary actions)
- **`LoadingSpinner.tsx`** - Loading spinner component
- **`PageHeader.tsx`** - Consistent page header with title and actions
- **`SearchInput.tsx`** - Search input component with icon
- **`SkeletonCard.tsx`** - Loading skeleton placeholders (SkeletonCard & SkeletonGrid)
- **`StatCard.tsx`** - Statistics/metrics card component
- **`StatusBadge.tsx`** - Status indicator badge (published, draft, connected, etc.)
- **`ViewModeToggle.tsx`** - Toggle between grid/list view modes

**Usage**: Import these whenever you need their functionality instead of duplicating code.

### UI Components (`components/ui/`)

**Purpose**: Base UI components from ShadCN/UI library.

These are low-level, styled components that form the building blocks of the application. They are built on Radix UI primitives and styled with Tailwind CSS.

**Available Components** (50+ components):
- Form elements: `button.tsx`, `input.tsx`, `textarea.tsx`, `select.tsx`, `checkbox.tsx`, `radio-group.tsx`, `switch.tsx`, `form.tsx`
- Layout: `card.tsx`, `separator.tsx`, `scroll-area.tsx`, `resizable.tsx`, `sidebar.tsx`
- Overlays: `dialog.tsx`, `alert-dialog.tsx`, `popover.tsx`, `sheet.tsx`, `drawer.tsx`, `hover-card.tsx`
- Navigation: `breadcrumb.tsx`, `navigation-menu.tsx`, `menubar.tsx`, `tabs.tsx`, `pagination.tsx`
- Feedback: `alert.tsx`, `sonner.tsx` (toast notifications), `progress.tsx`, `skeleton.tsx`
- Data display: `table.tsx`, `badge.tsx`, `avatar.tsx`, `chart.tsx`
- Interactive: `accordion.tsx`, `collapsible.tsx`, `toggle.tsx`, `toggle-group.tsx`, `slider.tsx`
- Utilities: `utils.ts` (cn function for class merging), `use-mobile.ts` (responsive hook)

**Usage**: These are the foundation - import and use them directly in your components.

### Other Components

- **`ThemeToggle.tsx`** - Dark/light theme toggle button
- **`figma/ImageWithFallback.tsx`** - Image component with fallback handling

---

## 📂 Context (`src/context/`)

**Purpose**: React Context providers for global state management.

- **`PinnedChartsContext.tsx`** - Context for managing pinned charts across the application

**Usage**: Wrap components with context providers to share state globally.

---

## 📂 Services (`src/services/`)

**Purpose**: API and external service integrations.

- **`api.ts`** - Centralized API service layer with type-safe methods for all backend calls

**Usage**: Import and use API methods instead of direct fetch calls.

---

## 📂 Styles (`src/styles/`)

**Purpose**: Global CSS styles and design system variables.

- **`globals.css`** - CSS variables, design tokens, and global styles

---

## 📂 Empty Directories (Reserved for Future Use)

These directories are created but currently empty, reserved for future additions:

- **`constants/`** - Application constants and configuration values
- **`hooks/`** - Custom React hooks
- **`types/`** - TypeScript type definitions and interfaces
- **`utils/`** - Utility functions and helpers

**When to use**:
- `constants/` - For app-wide constants (API endpoints, default values, etc.)
- `hooks/` - For reusable stateful logic (e.g., `useAuth`, `useLocalStorage`)
- `types/` - For shared TypeScript types/interfaces
- `utils/` - For pure utility functions (formatting, validation, etc.)

---

## 📂 Documentation (`src/`)

**Purpose**: Project documentation files.

- **`README.md`** - Project overview and quick start
- **`ARCHITECTURE.md`** - System architecture documentation
- **`COMPONENTS.md`** - Component usage guide
- **`DEVELOPER_GUIDE.md`** - Developer onboarding and guidelines
- **`API_REFERENCE.md`** - API endpoint documentation
- **`IMPLEMENTATION_STATUS.md`** - Feature implementation status
- **`IMPROVEMENTS_SUMMARY.md`** - Summary of recent improvements
- **`QUICK_REFERENCE.md`** - Quick reference guide
- **`DOCUMENTATION_INDEX.md`** - Documentation index
- **`ONBOARDING_FLOW.md`** - Onboarding flow documentation
- **`Attributions.md`** - Third-party attributions

---

## 📂 Guidelines (`src/guidelines/`)

**Purpose**: Development guidelines and standards.

- **`Guidelines.md`** - Coding standards and best practices

---

## 🎯 Folder Organization Principles

### 1. **By Purpose, Not Type**
Components are organized by what they do (features, layout, shared) rather than by file type.

### 2. **Feature-Based Grouping**
Feature components are grouped by domain (ai, charts, dashboards, databases) for easy navigation.

### 3. **Reusability Hierarchy**
```
UI Components (base) 
  → Shared Components (reusable patterns)
    → Feature Components (domain-specific)
      → Pages (full views)
```

### 4. **Separation of Concerns**
- **Components** - UI and presentation
- **Services** - Business logic and API calls
- **Context** - Global state
- **Pages** - Route-level views

---

## 📊 Component Count Summary

- **Pages**: 14 components
- **Feature Components**: 13 components
- **Shared Components**: 12 components
- **Layout Components**: 2 components
- **UI Components**: 50+ components
- **Context Providers**: 1 component
- **Total**: ~90+ components

---

## 🔍 Quick Navigation Guide

### "Where do I find..."

**A page/screen component?**
→ `src/pages/`

**A feature-specific component (charts, dashboards)?**
→ `src/components/features/[feature-name]/`

**A reusable component used everywhere?**
→ `src/components/shared/`

**A base UI component (button, input, card)?**
→ `src/components/ui/`

**API integration code?**
→ `src/services/api.ts`

**Global state management?**
→ `src/context/`

**Global styles?**
→ `src/styles/globals.css`

**Project documentation?**
→ `src/*.md` files

---

## 🚀 Adding New Code

### Adding a New Page
1. Create file in `src/pages/YourPageView.tsx`
2. Import and add route in `src/App.tsx`

### Adding a New Feature Component
1. Determine feature domain (ai, charts, dashboards, databases)
2. Create file in `src/components/features/[domain]/YourComponent.tsx`

### Adding a New Shared Component
1. Create file in `src/components/shared/YourComponent.tsx`
2. Make it reusable with props
3. Document with JSDoc comments

### Adding a New UI Component
1. Usually from ShadCN/UI - copy to `src/components/ui/your-component.tsx`
2. Customize styling as needed

### Adding a Custom Hook
1. Create file in `src/hooks/useYourHook.ts`
2. Export the hook

### Adding Types
1. Create file in `src/types/your-types.ts`
2. Export interfaces/types

### Adding Utilities
1. Create file in `src/utils/your-util.ts`
2. Export pure functions

---

## 📝 Notes

- All components use TypeScript
- Styling uses Tailwind CSS with design system variables
- Components follow React best practices (composition, hooks)
- File naming: PascalCase for components, camelCase for utilities
- Import paths use relative imports (`../`) or alias imports (`@/`)

---

**Last Updated**: Based on current codebase structure  
**Version**: 1.0.0

