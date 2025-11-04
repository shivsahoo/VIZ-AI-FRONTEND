# VizAI Developer Guide

A comprehensive guide for developers working on the VizAI project.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Project Structure](#project-structure)
3. [Development Workflow](#development-workflow)
4. [Code Standards](#code-standards)
5. [Component Development](#component-development)
6. [State Management](#state-management)
7. [API Integration](#api-integration)
8. [Testing](#testing)
9. [Common Tasks](#common-tasks)
10. [Troubleshooting](#troubleshooting)

---

## Getting Started

### Prerequisites

- Node.js 16+ and npm/yarn
- VS Code (recommended) or your preferred IDE
- Git
- Basic knowledge of React, TypeScript, and Tailwind CSS

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd vizai

# Install dependencies
npm install

# Start development server
npm run dev

# Open in browser
# Navigate to http://localhost:5173 (or port shown in terminal)
```

### Recommended VS Code Extensions

- ES7+ React/Redux/React-Native snippets
- Tailwind CSS IntelliSense
- TypeScript Vue Plugin (Volar)
- ESLint
- Prettier

---

## Project Structure

```
/
├── components/              # React components
│   ├── shared/             # Reusable shared components
│   ├── ui/                 # ShadCN UI components
│   └── [Feature]View.tsx   # Page/feature components
├── services/               # API services and utilities
│   └── api.ts             # Centralized API service
├── styles/                # Global styles
│   └── globals.css        # CSS variables and global styles
├── guidelines/            # Development guidelines
└── [docs].md             # Documentation files
```

### File Naming Conventions

- **Components**: PascalCase (e.g., `ChartCard.tsx`)
- **Utilities**: camelCase (e.g., `api.ts`)
- **Styles**: kebab-case (e.g., `globals.css`)
- **Documentation**: UPPERCASE (e.g., `README.md`)

---

## Development Workflow

### Starting Development

```bash
# Start dev server with hot reload
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Branch Strategy

```bash
# Feature branch
git checkout -b feature/chart-export

# Bug fix branch
git checkout -b fix/dashboard-loading

# Documentation branch
git checkout -b docs/api-reference
```

### Commit Messages

Follow conventional commits:

```bash
# Features
git commit -m "feat: add chart export functionality"

# Bug fixes
git commit -m "fix: resolve dashboard loading issue"

# Documentation
git commit -m "docs: update API reference"

# Refactoring
git commit -m "refactor: optimize chart rendering"

# Tests
git commit -m "test: add tests for ChartCard component"
```

---

## Code Standards

### TypeScript

Always use TypeScript with proper types:

```tsx
// ✅ Good
interface ChartProps {
  title: string;
  data: DataPoint[];
  onUpdate?: (data: DataPoint[]) => void;
}

export function Chart({ title, data, onUpdate }: ChartProps) {
  // ...
}

// ❌ Avoid
export function Chart({ title, data, onUpdate }: any) {
  // ...
}
```

### Component Structure

```tsx
/**
 * Component documentation
 * Explain what the component does
 */

import { useState } from 'react';
// ... other imports

/**
 * Props interface with JSDoc comments
 */
interface MyComponentProps {
  /** Prop description */
  title: string;
  /** Optional prop description */
  onClose?: () => void;
}

/**
 * Main component function
 */
export function MyComponent({ title, onClose }: MyComponentProps) {
  // State declarations
  const [isOpen, setIsOpen] = useState(false);
  
  // Event handlers
  const handleClick = () => {
    setIsOpen(true);
  };
  
  // Render
  return (
    <div>
      {/* JSX */}
    </div>
  );
}
```

### Tailwind CSS

```tsx
// ✅ Good - Use design system classes
<div className="p-6 bg-card rounded-lg border border-border">

// ❌ Avoid - Don't use arbitrary values unnecessarily
<div className="p-[24px] bg-[#ffffff] rounded-[8px]">

// ⚠️ Exception - OK for font sizes (don't use text-* classes)
// The app has custom typography in globals.css
<h1>Title</h1> // Uses default h1 styling
<p>Body text</p> // Uses default p styling
```

### CSS Variables

Use CSS variables from the design system:

```tsx
// ✅ Good
<div style={{ color: 'hsl(var(--foreground))' }}>

// ❌ Avoid
<div style={{ color: '#000000' }}>
```

---

## Component Development

### Creating a New Component

1. **Determine Component Type**
   - Shared component → `/components/shared/`
   - Page component → `/components/[Name]View.tsx`
   - Feature component → `/components/[Name].tsx`

2. **Create Component File**

```tsx
/**
 * ComponentName
 * 
 * Description of what this component does
 * 
 * @example
 * ```tsx
 * <ComponentName title="Example" />
 * ```
 */

import { useState } from 'react';

interface ComponentNameProps {
  /** Prop description */
  title: string;
}

export function ComponentName({ title }: ComponentNameProps) {
  return (
    <div>
      <h2>{title}</h2>
    </div>
  );
}
```

3. **Add to Exports (if shared)**

```tsx
// In a central export file (if needed)
export { ComponentName } from './ComponentName';
```

### Using Shared Components

```tsx
import { EmptyState } from './shared/EmptyState';
import { LoadingSpinner } from './shared/LoadingSpinner';
import { StatCard } from './shared/StatCard';
import { PageHeader } from './shared/PageHeader';

// Use in your component
<PageHeader
  title="My Page"
  description="Page description"
  action={<Button>Action</Button>}
/>

<EmptyState
  icon={<Icon />}
  title="No data"
  description="Description"
/>
```

### Using ShadCN Components

```tsx
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Dialog, DialogContent, DialogHeader } from './ui/dialog';

// Use directly in components
<Card className="p-6">
  <Button variant="default">Click me</Button>
</Card>
```

---

## State Management

### Local State (useState)

For component-specific state:

```tsx
function MyComponent() {
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState<Data[]>([]);
  
  return <div>{/* ... */}</div>;
}
```

### Context API

For global/shared state:

```tsx
// 1. Create context
import { createContext, useContext, useState } from 'react';

const MyContext = createContext<MyContextType | undefined>(undefined);

export function MyProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(initialState);
  
  return (
    <MyContext.Provider value={{ state, setState }}>
      {children}
    </MyContext.Provider>
  );
}

// 2. Create hook
export function useMyContext() {
  const context = useContext(MyContext);
  if (!context) throw new Error('Must use within MyProvider');
  return context;
}

// 3. Use in components
function MyComponent() {
  const { state, setState } = useMyContext();
  return <div>{/* ... */}</div>;
}
```

### Existing Contexts

```tsx
// Pinned charts
import { usePinnedCharts } from './PinnedChartsContext';

const { pinnedCharts, togglePin, isPinned } = usePinnedCharts();
```

---

## API Integration

### Using the API Service

```tsx
import api from '../services/api';

function MyComponent() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      
      try {
        const response = await api.getProjects();
        if (response.success && response.data) {
          setData(response.data);
        } else {
          setError(response.error?.message || 'Failed to fetch');
        }
      } catch (err) {
        setError('Network error');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) return <LoadingSpinner />;
  if (error) return <div>Error: {error}</div>;
  
  return <div>{/* render data */}</div>;
}
```

### Available API Methods

See `/services/api.ts` for all available methods:

```tsx
// Projects
api.getProjects()
api.createProject({ name, description })
api.getProject(id)
api.updateProject(id, data)
api.deleteProject(id)

// Dashboards
api.getDashboards(projectId)
api.createDashboard(projectId, data)

// Charts
api.getCharts(projectId)
api.createChart(projectId, data)
api.getChartData(chartId)

// And more... see api.ts for full list
```

---

## Testing

### Unit Tests (Planned)

```tsx
import { render, screen } from '@testing-library/react';
import { ChartCard } from './ChartCard';

describe('ChartCard', () => {
  it('renders chart title', () => {
    render(<ChartCard type="line" data={mockData} />);
    expect(screen.getByText('Chart Title')).toBeInTheDocument();
  });
});
```

### Integration Tests (Planned)

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

describe('ChartsView', () => {
  it('creates new chart', async () => {
    render(<ChartsView />);
    
    await userEvent.click(screen.getByText('Create Chart'));
    // ... test flow
  });
});
```

---

## Common Tasks

### Adding a New Page

1. Create component file:

```tsx
// /components/MyNewView.tsx
export function MyNewView() {
  return (
    <div className="p-8">
      <PageHeader
        title="My New Page"
        description="Description"
      />
      {/* Content */}
    </div>
  );
}
```

2. Add to routing in `App.tsx`:

```tsx
// In App.tsx
{currentView === 'my-new-page' && <MyNewView />}
```

3. Add navigation in sidebar:

```tsx
// In WorkspaceSidebar.tsx
const navItems = [
  // ... existing items
  { id: 'my-new-page', label: 'My New Page', icon: IconName }
];
```

### Creating a New Chart Type

1. Add type to ChartCard:

```tsx
type ChartType = 'line' | 'bar' | 'pie' | 'area' | 'scatter'; // Add new type

// Add case in switch statement
case 'scatter':
  return <ScatterChart>{/* ... */}</ScatterChart>;
```

### Adding a New Permission

1. Update role interface:

```tsx
// In UsersView.tsx or types file
interface Role {
  permissions: {
    // ... existing
    newFeature: Permission;
  };
}
```

2. Update UI:

```tsx
// Add to permission matrix
<PermissionRow feature="newFeature" />
```

### Customizing Theme

Edit `/styles/globals.css`:

```css
:root {
  --primary: 175 100% 35%; /* Teal color */
  --background: 0 0% 100%; /* White */
  /* ... more variables */
}

.dark {
  --primary: 175 100% 40%;
  --background: 222 47% 11%; /* Dark blue */
  /* ... more variables */
}
```

---

## Troubleshooting

### Common Issues

#### 1. Component Not Rendering

**Problem**: Component shows blank or doesn't update

**Solutions**:
- Check console for errors
- Verify all imports are correct
- Ensure component is exported correctly
- Check if component is wrapped in required providers

```tsx
// ✅ Correct export
export function MyComponent() { }

// ❌ Missing export
function MyComponent() { }
```

#### 2. Styles Not Applying

**Problem**: Tailwind classes not working

**Solutions**:
- Ensure class names are correct
- Check if conflicting styles exist
- Verify Tailwind config is correct
- Clear cache and rebuild

```bash
# Clear cache
rm -rf node_modules/.vite
npm run dev
```

#### 3. TypeScript Errors

**Problem**: Type errors in IDE

**Solutions**:
- Run TypeScript compiler to see all errors: `npx tsc --noEmit`
- Check interface definitions
- Ensure all props are properly typed
- Update types when API changes

#### 4. Context Errors

**Problem**: "Cannot read property of undefined" when using context

**Solutions**:
- Ensure component is wrapped in provider
- Check provider is high enough in tree
- Verify hook is used correctly

```tsx
// ✅ Correct usage
<MyProvider>
  <App />
</MyProvider>

// ❌ Hook used outside provider
<App /> // useMyContext() will fail
<MyProvider>...</MyProvider>
```

### Debug Mode

Enable React DevTools:
- Install React DevTools browser extension
- Inspect component hierarchy
- View props and state
- Profile performance

### Performance Issues

If app feels slow:

1. Check for unnecessary re-renders:
```tsx
// Use React.memo for expensive components
export const ExpensiveComponent = React.memo(({ data }) => {
  // ...
});
```

2. Optimize expensive computations:
```tsx
// Use useMemo
const expensiveValue = useMemo(() => {
  return computeExpensiveValue(data);
}, [data]);
```

3. Memoize callbacks:
```tsx
// Use useCallback
const handleClick = useCallback(() => {
  doSomething(data);
}, [data]);
```

---

## Best Practices

### Do's ✅

1. **Always use TypeScript types**
2. **Document components with JSDoc**
3. **Use shared components when possible**
4. **Follow the established file structure**
5. **Test your changes manually**
6. **Keep components small and focused**
7. **Use meaningful variable names**
8. **Handle loading and error states**
9. **Use CSS variables from design system**
10. **Clean up effects properly**

### Don'ts ❌

1. **Don't use `any` type**
2. **Don't create duplicate components**
3. **Don't hardcode colors/styles**
4. **Don't ignore TypeScript errors**
5. **Don't commit console.logs**
6. **Don't use inline styles (except dynamic values)**
7. **Don't create global variables**
8. **Don't skip error handling**
9. **Don't use font-size Tailwind classes**
10. **Don't forget to cleanup in useEffect**

---

## Useful Commands

```bash
# Development
npm run dev              # Start dev server
npm run build           # Build for production
npm run preview         # Preview production build

# Code Quality
npm run lint            # Run ESLint (if configured)
npm run type-check      # Check TypeScript errors

# Git
git status              # Check status
git add .               # Stage all changes
git commit -m "message" # Commit changes
git push                # Push to remote

# Dependencies
npm install package-name    # Add dependency
npm install -D package-name # Add dev dependency
npm update                  # Update dependencies
```

---

## Resources

### Documentation
- [React Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [ShadCN UI](https://ui.shadcn.com/)
- [Recharts](https://recharts.org/)

### Internal Docs
- [README.md](./README.md) - Project overview
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture
- [API_REFERENCE.md](./API_REFERENCE.md) - API documentation
- [COMPONENTS.md](./COMPONENTS.md) - Component reference
- [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) - Feature status

---

## Getting Help

1. **Check documentation** - Most answers are in the docs
2. **Search existing issues** - Someone may have had the same problem
3. **Ask the team** - Don't hesitate to ask questions
4. **Read the code** - The codebase is well-commented

---

## Contributing

### Code Review Checklist

Before submitting code:

- [ ] Code follows style guidelines
- [ ] TypeScript types are properly defined
- [ ] Components are documented
- [ ] No console.logs or debuggers
- [ ] Tested manually
- [ ] No TypeScript errors
- [ ] Responsive design checked
- [ ] Dark mode tested (if applicable)

---

**Happy Coding! 🚀**

For questions or issues, please reach out to the development team.

---

**Last Updated**: November 2024  
**Version**: 1.0.0
