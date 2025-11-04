# VizAI Quick Reference

**One-page reference for common tasks and patterns**

---

## 📁 File Structure

```
vizai/
├── components/
│   ├── shared/              ← Reusable components
│   │   ├── EmptyState.tsx
│   │   ├── LoadingSpinner.tsx
│   │   ├── StatCard.tsx
│   │   ├── PageHeader.tsx
│   │   ├── SearchInput.tsx
│   │   └── ConfirmDialog.tsx
│   ├── ui/                  ← ShadCN components
│   └── [Feature]View.tsx    ← Page components
├── services/
│   └── api.ts              ← Centralized API
├── styles/
│   └── globals.css         ← Design tokens
└── [DOCS].md               ← Documentation
```

---

## 🎯 Common Patterns

### Create a New Page Component

```tsx
import { PageHeader } from './shared/PageHeader';
import { EmptyState } from './shared/EmptyState';
import { Button } from './ui/button';

export function MyView() {
  return (
    <div className="p-8">
      <PageHeader
        title="Page Title"
        description="Page description"
        action={<Button>Action</Button>}
      />
      
      {/* Content */}
    </div>
  );
}
```

---

### Fetch Data from API

```tsx
import api from '../services/api';
import { LoadingSpinner } from './shared/LoadingSpinner';
import { EmptyState } from './shared/EmptyState';

function MyComponent() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const res = await api.getProjects();
        if (res.success) setData(res.data);
        else setError(res.error.message);
      } catch (err) {
        setError('Failed to fetch');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) return <LoadingSpinner />;
  if (error) return <div>Error: {error}</div>;
  if (!data.length) return <EmptyState {...} />;
  
  return <div>{/* Render data */}</div>;
}
```

---

### Use Shared Components

```tsx
// Empty State
<EmptyState
  icon={<Icon className="w-12 h-12" />}
  title="No items"
  description="Add your first item"
  action={<Button>Add</Button>}
/>

// Loading
<LoadingSpinner size="lg" text="Loading..." />

// Stat Card
<StatCard
  title="Revenue"
  value="$124K"
  change="+12%"
  trend="up"
  icon={<DollarSign />}
/>

// Search
<SearchInput
  placeholder="Search..."
  value={query}
  onChange={setQuery}
  debounce={300}
/>

// Confirm Dialog
<ConfirmDialog
  open={open}
  onOpenChange={setOpen}
  title="Delete?"
  description="Cannot be undone"
  onConfirm={handleDelete}
  variant="destructive"
/>
```

---

## 🎨 Design Tokens

### Colors (use CSS variables)

```tsx
// ✅ Good
className="bg-card text-foreground border-border"
style={{ color: 'hsl(var(--primary))' }}

// ❌ Avoid
className="bg-white text-black"
style={{ color: '#000000' }}
```

### Common Classes

```tsx
// Cards
"bg-card border border-border rounded-lg p-6"

// Buttons (use Button component)
<Button variant="default">Click</Button>
<Button variant="destructive">Delete</Button>
<Button variant="outline">Cancel</Button>

// Spacing
"p-4 m-2 gap-3"  // padding, margin, gap

// Layout
"flex items-center justify-between"
"grid grid-cols-3 gap-4"
```

---

## 🔌 API Quick Reference

```tsx
import api from '../services/api';

// Projects
await api.getProjects()
await api.createProject({ name, description })
await api.getProject(id)
await api.updateProject(id, data)
await api.deleteProject(id)

// Dashboards
await api.getDashboards(projectId)
await api.createDashboard(projectId, data)

// Charts
await api.getCharts(projectId)
await api.createChart(projectId, data)
await api.getChartData(chartId)

// Databases
await api.getDatabases(projectId)
await api.createDatabase(projectId, data)
await api.testDatabaseConnection(config)
await api.getDatabaseSchema(databaseId)

// AI
await api.naturalLanguageQuery(question, dbId)
await api.generateInsights(chartId, type)
await api.createDashboardFromPrompt(prompt, dbId)

// Users
await api.getTeamMembers(projectId)
await api.inviteUser(projectId, { email, role })

// Roles
await api.getRoles(projectId)
await api.createRole(projectId, data)

// Audit
await api.getAuditLogs(projectId)
```

---

## 🎭 Component Props Cheatsheet

### Button
```tsx
<Button
  variant="default|destructive|outline|ghost"
  size="default|sm|lg|icon"
  onClick={handler}
>
  Text
</Button>
```

### Card
```tsx
<Card className="p-6">
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>{/* Content */}</CardContent>
</Card>
```

### Dialog
```tsx
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Title</DialogTitle>
      <DialogDescription>Description</DialogDescription>
    </DialogHeader>
    {/* Content */}
  </DialogContent>
</Dialog>
```

---

## 🎨 Styling Quick Tips

```tsx
// ✅ Good - Use design system
<div className="bg-background text-foreground border-border">

// ✅ Good - Responsive
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">

// ✅ Good - States
<button className="hover:bg-muted active:scale-95 transition-all">

// ❌ Avoid - Font classes (use default typography)
<h1 className="text-4xl font-bold">  // Don't do this
<h1>Title</h1>  // Do this instead
```

---

## 🪝 Hooks Quick Reference

### State
```tsx
const [value, setValue] = useState(initial);
```

### Effect
```tsx
useEffect(() => {
  // Side effect
  return () => {
    // Cleanup
  };
}, [deps]);
```

### Memoization
```tsx
const value = useMemo(() => compute(data), [data]);
const callback = useCallback(() => handle(), [deps]);
```

### Context
```tsx
const { state, actions } = usePinnedCharts();
```

---

## 🔧 Common Commands

```bash
# Development
npm run dev              # Start dev server
npm run build           # Build for production
npm run preview         # Preview build

# Git
git checkout -b feature/name  # New branch
git add .                     # Stage changes
git commit -m "message"       # Commit
git push                      # Push to remote
```

---

## 📚 Documentation Quick Links

- **Overview**: [README.md](./README.md)
- **Setup**: [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md)
- **Components**: [COMPONENTS.md](./COMPONENTS.md)
- **API**: [API_REFERENCE.md](./API_REFERENCE.md)
- **Architecture**: [ARCHITECTURE.md](./ARCHITECTURE.md)
- **Status**: [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md)
- **Index**: [DOCUMENTATION_INDEX.md](./DOCUMENTATION_INDEX.md)

---

## 🐛 Quick Debugging

### Component not rendering?
1. Check console for errors
2. Verify imports
3. Check component is exported
4. Verify props are correct

### Styles not working?
1. Check class names are valid
2. Verify no conflicting styles
3. Clear cache: `rm -rf node_modules/.vite`

### TypeScript errors?
1. Run `npx tsc --noEmit`
2. Check interface definitions
3. Verify all props typed

### Context errors?
1. Check component is in provider
2. Verify hook usage
3. Check provider is high enough in tree

---

## ✅ Pre-Commit Checklist

- [ ] Code follows style guidelines
- [ ] TypeScript types defined
- [ ] No console.logs
- [ ] Tested manually
- [ ] No TypeScript errors
- [ ] Components documented
- [ ] Responsive checked
- [ ] Dark mode works

---

## 🎯 Most Used Patterns

### 1. Page Layout
```tsx
<div className="p-8">
  <PageHeader title="..." description="..." />
  {/* Content */}
</div>
```

### 2. Card Grid
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {items.map(item => <Card key={item.id} />)}
</div>
```

### 3. Loading State
```tsx
if (loading) return <LoadingSpinner />;
if (error) return <div>Error</div>;
if (!data.length) return <EmptyState />;
return <div>{/* Data */}</div>;
```

### 4. Form with Dialog
```tsx
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent>
    <form onSubmit={handleSubmit}>
      <Input />
      <Button type="submit">Save</Button>
    </form>
  </DialogContent>
</Dialog>
```

---

## 🎨 Color Palette

```
Primary (Teal): #00C2A8
Dark: #0B0F19, #121C2E
Light: #F8F9FB
Accent: Teal/Cyan variants
```

Use via CSS variables:
- `--primary`
- `--background`
- `--foreground`
- `--card`
- `--border`
- `--muted`

---

**Keep this handy for quick reference!**

---

**Last Updated**: November 3, 2024
