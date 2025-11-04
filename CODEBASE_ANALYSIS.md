# Codebase Analysis & Refactoring Recommendations

## Executive Summary

This analysis identifies duplicate UI patterns, redundant components, inline styles, and folder structure issues that can be addressed to improve code maintainability, reduce bundle size, and enhance developer experience.

---

## 1. Duplicate UI Patterns

### 1.1 Page Header Pattern
**Pattern:** Repeated header structure with title, description, and action buttons

**Locations:**
- `ChartsView.tsx` (lines 664-682)
- `DashboardsView.tsx` (lines 123-140)
- `DatabasesView.tsx` (lines 162-174)
- `ProjectsView.tsx` (lines 126-138)
- `InsightsView.tsx` (header pattern)
- `UsersView.tsx` (header pattern)
- `SettingsView.tsx` (header pattern)

**Current Implementation:**
```tsx
<div className="flex items-center justify-between">
  <div>
    <h1 className="text-foreground">Page Title</h1>
    <p className="text-muted-foreground mt-0.5">Description text</p>
  </div>
  <Button>Action</Button>
</div>
```

**Recommendation:** ✅ Already exists! Use `<PageHeader>` from `@/components/shared/PageHeader` - but it's not being used consistently across views.

---

### 1.2 Empty State Pattern
**Pattern:** Empty state with icon, title, description, and optional action

**Locations:**
- `ChartsView.tsx` (lines 808-822)
- `DashboardsView.tsx` (lines 144-166)
- `DatabasesView.tsx` (could benefit)
- `InsightsView.tsx` (line 215)

**Current Implementation:**
```tsx
<Card className="border-border p-12">
  <div className="flex flex-col items-center text-center gap-4">
    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
      <Icon className="w-8 h-8 text-muted-foreground" />
    </div>
    <div>
      <h3 className="text-foreground mb-2">No items found</h3>
      <p className="text-sm text-muted-foreground">Description</p>
    </div>
    {action && <Button>Action</Button>}
  </div>
</Card>
```

**Recommendation:** ✅ Already exists! Use `<EmptyState>` from `@/components/shared/EmptyState` - but it's not being used consistently.

---

### 1.3 Loading Skeleton Pattern
**Pattern:** Loading states with skeleton cards

**Locations:**
- `ChartsView.tsx` (lines 623-658)
- `DashboardsView.tsx` (lines 74-116)
- Could be used in other views

**Current Implementation:**
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {[1, 2, 3, 4, 5, 6].map((i) => (
    <Card key={i} className="p-6 border-2 border-border">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-muted/50 animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-muted/50 rounded animate-pulse w-3/4" />
            <div className="h-3 bg-muted/30 rounded animate-pulse w-1/2" />
          </div>
        </div>
        <div className="h-64 bg-muted/30 rounded-lg animate-pulse" />
      </div>
    </Card>
  ))}
</div>
```

**Recommendation:** Create reusable skeleton components:
- `<SkeletonCard />` - Generic card skeleton
- `<SkeletonGrid />` - Grid of skeleton cards
- `<SkeletonList />` - List skeleton variant

---

### 1.4 Search + Filter Bar Pattern
**Pattern:** Search input with filter button/popover

**Locations:**
- `ChartsView.tsx` (lines 706-803)
- `DashboardsView.tsx` (lines 172-197, 218-244)
- Could be used in other list views

**Current Implementation:**
```tsx
<div className="flex gap-2">
  <div className="relative flex-1 sm:flex-initial sm:w-[280px]">
    <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
    <Input
      placeholder="Search..."
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
      className="pl-8 h-9 border-border text-sm"
    />
  </div>
  <Popover>
    <PopoverTrigger asChild>
      <Button variant="outline" size="icon" className="h-9 w-9">
        <Filter className="w-4 h-4" />
      </Button>
    </PopoverTrigger>
    {/* Filter content */}
  </Popover>
</div>
```

**Recommendation:** Create `<SearchFilterBar />` component:
- Accepts search value, onChange, placeholder
- Optional filter config
- Optional view mode toggle (grid/list)

---

### 1.5 Stats Card Pattern
**Pattern:** Statistics cards with icon, value, and label

**Locations:**
- `ProjectsView.tsx` (lines 103-120)
- `DatabasesView.tsx` (lines 176-212)
- `HomeDashboardView.tsx` (stats cards)

**Current Implementation:**
```tsx
<Card className="p-4 border border-border bg-card">
  <div className="flex items-center gap-3">
    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
      <Icon className="w-5 h-5 text-primary" />
    </div>
    <div>
      <p className="text-2xl text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  </div>
</Card>
```

**Recommendation:** ✅ Already exists! Use `<StatCard>` from `@/components/shared/StatCard` - but needs to be adopted more widely.

---

### 1.6 Gradient Button Pattern
**Pattern:** Primary action buttons with gradient

**Locations:** Found in 32+ files

**Current Implementation:**
```tsx
<Button className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white">
  <Icon className="w-4 h-4 mr-2" />
  Action
</Button>
```

**Recommendation:** 
- Create `<GradientButton>` component OR
- Add `variant="gradient"` to existing Button component OR
- Extract to CSS class: `.btn-gradient`

---

### 1.7 Status Badge Pattern
**Pattern:** Status badges with conditional styling

**Locations:**
- `ChartsView.tsx` (lines 607-617)
- `DatabasesView.tsx` (lines 245-258)
- Multiple views

**Current Implementation:**
```tsx
<Badge 
  className={
    status === 'connected' 
      ? 'bg-success/10 text-success border-success/20' 
      : 'bg-destructive/10 text-destructive border-destructive/20'
  }
>
  {status === 'connected' ? <Check /> : <X />}
  {status}
</Badge>
```

**Recommendation:** Create `<StatusBadge>` component:
- Accepts status type
- Handles icon mapping
- Consistent styling

---

### 1.8 View Mode Toggle (Grid/List)
**Pattern:** Toggle between grid and list view modes

**Locations:**
- `DashboardsView.tsx` (lines 182-196, 228-243)

**Current Implementation:**
```tsx
<Button
  variant={viewMode === 'grid' ? 'default' : 'outline'}
  size="icon"
  onClick={() => setViewMode('grid')}
  className={`h-9 w-9 ${viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'border-border'}`}
>
  <Grid3x3 className="w-4 h-4" />
</Button>
```

**Recommendation:** Create `<ViewModeToggle>` component:
- Grid/List toggle
- Optional other view modes
- Consistent styling

---

### 1.9 Chart Preview Mini Chart
**Pattern:** Mini chart previews in cards

**Locations:**
- `DashboardCard.tsx` (lines 18-59, `MiniChartPreview`)
- `ChartsView.tsx` (lines 378-494, `renderChartPreview`)
- `HomeDashboardView.tsx` (chart previews)

**Current Implementation:**
- Multiple similar implementations with inline chart rendering
- Duplicate chart type logic

**Recommendation:** Create `<MiniChartPreview>` component:
- Accepts chart type and data
- Handles all chart types
- Consistent sizing and styling

---

### 1.10 Action Button Group (Hover Actions)
**Pattern:** Action buttons that appear on hover

**Locations:**
- `ChartsView.tsx` (lines 533-595)
- `DashboardCard.tsx` (delete button)
- Card components

**Current Implementation:**
```tsx
<div className="flex items-center gap-0.5 flex-shrink-0">
  <Button
    variant="ghost"
    size="icon"
    className="h-7 w-7 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
  >
    <Icon className="w-3.5 h-3.5" />
  </Button>
</div>
```

**Recommendation:** Create `<ActionButtonGroup>` component:
- Accepts array of actions
- Handles hover visibility
- Consistent spacing and sizing

---

## 2. Duplicate Component Files

### 2.1 Components in Both Root and Features Directory

**Duplicated Files:**
1. `components/ChartCard.tsx` ↔ `components/features/ChartCard.tsx`
2. `components/DashboardCard.tsx` ↔ `components/features/DashboardCard.tsx`
3. `components/AIAssistant.tsx` ↔ `components/features/AIAssistant.tsx`
4. `components/DashboardCreationBot.tsx` ↔ `components/features/DashboardCreationBot.tsx`
5. `components/DatabaseContextBot.tsx` ↔ `components/features/DatabaseContextBot.tsx`
6. `components/DatabaseConnectionFlow.tsx` ↔ `components/features/DatabaseConnectionFlow.tsx`
7. `components/DatabaseSetupGuided.tsx` ↔ `components/features/DatabaseSetupGuided.tsx`
8. `components/EditChartDialog.tsx` ↔ `components/features/EditChartDialog.tsx`
9. `components/ChartPreviewDialog.tsx` ↔ `components/features/ChartPreviewDialog.tsx`
10. `components/ProjectContextBot.tsx` ↔ `components/features/ProjectContextBot.tsx`
11. `components/TableSelectionView.tsx` ↔ `components/features/TableSelectionView.tsx`

**Recommendation:**
- Keep only the versions in `components/features/`
- Remove duplicates from `components/` root
- Update all imports to use `@/components/features/`

---

### 2.2 Components in Wrong Locations

**Issues:**
1. `components/TopBar.tsx` ↔ `components/layout/TopBar.tsx` (duplicate)
2. `components/WorkspaceSidebar.tsx` ↔ `components/layout/WorkspaceSidebar.tsx` (duplicate)
3. `components/OnboardingFlow.tsx` ↔ `pages/OnboardingFlow.tsx` (duplicate)
4. `components/PinnedChartsContext.tsx` should be in `context/` (already moved, but old file may exist)

**Recommendation:**
- Remove duplicates
- Keep only in correct locations:
  - Layout components → `components/layout/`
  - Page components → `pages/`
  - Context providers → `context/`

---

### 2.3 View Components in Wrong Directory

**Components that should be in `pages/`:**
- `components/ChartsView.tsx` → `pages/ChartsView.tsx`
- `components/DashboardsView.tsx` → `pages/DashboardsView.tsx`
- `components/DashboardDetailView.tsx` → `pages/DashboardDetailView.tsx`
- `components/DatabasesView.tsx` → `pages/DatabasesView.tsx`
- `components/HomeDashboardView.tsx` → `pages/HomeDashboardView.tsx`
- `components/InsightsView.tsx` → `pages/InsightsView.tsx`
- `components/UsersView.tsx` → `pages/UsersView.tsx`
- `components/SettingsView.tsx` → `pages/SettingsView.tsx`
- `components/ProfileView.tsx` → `pages/ProfileView.tsx`
- `components/AuthView.tsx` → `pages/AuthView.tsx`
- `components/ProjectsView.tsx` → `pages/ProjectsView.tsx`
- `components/WorkspaceView.tsx` → `pages/WorkspaceView.tsx`
- `components/AskVizAIView.tsx` → `pages/AskVizAIView.tsx`

**Recommendation:**
- Move all `*View.tsx` components to `pages/`
- Update imports in `App.tsx` and other files

---

## 3. Redundant Inline Styles

### 3.1 Animation Delays

**Locations:**
- `components/features/AIAssistant.tsx` (lines 470-471)
- `components/features/DashboardCreationBot.tsx` (lines 356-358)
- `components/features/DatabaseContextBot.tsx` (lines 294-296)
- `components/features/ProjectContextBot.tsx` (lines 260-262)
- `components/AIAssistant.tsx` (duplicate)
- `components/DashboardCreationBot.tsx` (duplicate)
- `components/DatabaseContextBot.tsx` (duplicate)
- `components/ProjectContextBot.tsx` (duplicate)

**Current Implementation:**
```tsx
<span style={{ animationDelay: "0ms" }}></span>
<span style={{ animationDelay: "150ms" }}></span>
<span style={{ animationDelay: "300ms" }}></span>
```

**Recommendation:**
- Create CSS classes: `.delay-0`, `.delay-150`, `.delay-300`
- Or create `<LoadingDots>` component with built-in delays

---

### 3.2 Hardcoded Tooltip Styles

**Locations:**
- `ChartsView.tsx` (lines 406-412, 433-439, 454-460, 480-486)

**Current Implementation:**
```tsx
<Tooltip 
  contentStyle={{
    backgroundColor: '#1F2937',
    border: '2px solid #374151',
    borderRadius: '8px',
    fontSize: '12px',
    color: '#F9FAFB'
  }}
/>
```

**Recommendation:**
- Extract to CSS variables or theme
- Create custom tooltip component with consistent styling
- Or add to `CustomChartTooltip` component

---

### 3.3 Image Style Prop

**Location:**
- `components/figma/ImageWithFallback.tsx` (line 25)

**Current Implementation:**
```tsx
<img src={src} alt={alt} className={className} style={style} {...rest} />
```

**Recommendation:**
- Acceptable if style prop is necessary for dynamic styling
- Otherwise, prefer className approach

---

## 4. Nested Div Simplification

### 4.1 Excessive Wrapper Divs

**Common Pattern:**
```tsx
<div className="h-full overflow-auto bg-background">
  <div className="max-w-[1600px] mx-auto p-10 space-y-10">
    <div className="flex items-center justify-between">
      <div>
        <h1>Title</h1>
        <p>Description</p>
      </div>
    </div>
  </div>
</div>
```

**Recommendation:**
- Create `<PageContainer>` component:
  ```tsx
  <PageContainer>
    <PageHeader title="..." description="..." />
    {/* Content */}
  </PageContainer>
  ```

---

### 4.2 Repeated Card Grid Patterns

**Locations:**
- Multiple views with similar grid layouts

**Current Implementation:**
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {items.map(item => <Card>...</Card>)}
</div>
```

**Recommendation:**
- Create `<CardGrid>` component:
  - Handles responsive grid
  - Consistent spacing
  - Optional loading/empty states

---

## 5. Suggested Reusable Components

### 5.1 High Priority (Frequently Repeated)

1. **`<PageContainer>`**
   - Wrapper for page content
   - Handles max-width, padding, spacing
   - Consistent across all pages

2. **`<SearchFilterBar>`**
   - Search input with filter popover
   - Optional view mode toggle
   - Used in list/grid views

3. **`<SkeletonCard>` / `<SkeletonGrid>`**
   - Loading states
   - Consistent skeleton patterns

4. **`<StatusBadge>`**
   - Status indicators
   - Icon + text
   - Consistent colors

5. **`<ViewModeToggle>`**
   - Grid/List toggle
   - Consistent styling

6. **`<GradientButton>` or Button variant**
   - Primary action buttons
   - Used in 32+ files

7. **`<ActionButtonGroup>`**
   - Hover-revealed action buttons
   - Used in cards

8. **`<MiniChartPreview>`**
   - Mini chart visualization
   - Used in cards and previews

---

### 5.2 Medium Priority

9. **`<LoadingDots>`**
   - Animated loading dots
   - Replace inline style delays

10. **`<CardGrid>`**
    - Responsive grid layout
    - Handles empty/loading states

11. **`<StatsGrid>`**
    - Grid of stat cards
    - Consistent spacing

12. **`<FilterPopover>`**
    - Reusable filter UI
    - Multiple filter types

---

### 5.3 Low Priority (Nice to Have)

13. **`<ConfirmDeleteDialog>`**
    - Reusable delete confirmation
    - Currently implemented inline

14. **`<IconBadge>`**
    - Icon + badge combination
    - Used in various places

15. **`<TimeAgo>`**
    - Relative time display
    - Currently using "2 hours ago" strings

---

## 6. Suggested Folder Structure

### 6.1 Current Issues

1. **View components in wrong location**
   - All `*View.tsx` should be in `pages/`

2. **Duplicate files**
   - Components exist in both root and features/

3. **Inconsistent organization**
   - Some components in root, some in subdirectories

---

### 6.2 Recommended Structure

```
src/
├── components/
│   ├── features/          # Feature-specific components
│   │   ├── charts/
│   │   │   ├── ChartCard.tsx
│   │   │   ├── ChartPreviewDialog.tsx
│   │   │   ├── EditChartDialog.tsx
│   │   │   └── ChartTooltip.tsx
│   │   ├── dashboards/
│   │   │   ├── DashboardCard.tsx
│   │   │   ├── DashboardCreationBot.tsx
│   │   │   └── DashboardDetailView.tsx
│   │   ├── databases/
│   │   │   ├── DatabaseConnectionFlow.tsx
│   │   │   ├── DatabaseContextBot.tsx
│   │   │   ├── DatabaseSetupGuided.tsx
│   │   │   └── TableSelectionView.tsx
│   │   ├── ai/
│   │   │   ├── AIAssistant.tsx
│   │   │   └── ProjectContextBot.tsx
│   │   └── index.ts
│   ├── layout/            # Layout components
│   │   ├── TopBar.tsx
│   │   ├── WorkspaceSidebar.tsx
│   │   └── index.ts
│   ├── shared/            # Shared reusable components
│   │   ├── PageHeader.tsx         ✅ Exists
│   │   ├── EmptyState.tsx         ✅ Exists
│   │   ├── StatCard.tsx           ✅ Exists
│   │   ├── LoadingSpinner.tsx     ✅ Exists
│   │   ├── SearchInput.tsx        ✅ Exists
│   │   ├── ConfirmDialog.tsx      ✅ Exists
│   │   ├── PageContainer.tsx      ⚠️ Create
│   │   ├── SearchFilterBar.tsx    ⚠️ Create
│   │   ├── SkeletonCard.tsx      ⚠️ Create
│   │   ├── StatusBadge.tsx       ⚠️ Create
│   │   ├── ViewModeToggle.tsx    ⚠️ Create
│   │   ├── ActionButtonGroup.tsx ⚠️ Create
│   │   ├── MiniChartPreview.tsx  ⚠️ Create
│   │   └── index.ts
│   └── ui/                # ShadCN UI components
│       └── [existing shadcn components]
├── pages/                 # Page/screen components
│   ├── AuthView.tsx
│   ├── ProjectsView.tsx
│   ├── WorkspaceView.tsx
│   ├── ChartsView.tsx
│   ├── DashboardsView.tsx
│   ├── DashboardDetailView.tsx
│   ├── DatabasesView.tsx
│   ├── HomeDashboardView.tsx
│   ├── InsightsView.tsx
│   ├── UsersView.tsx
│   ├── SettingsView.tsx
│   ├── ProfileView.tsx
│   ├── AskVizAIView.tsx
│   ├── OnboardingFlow.tsx
│   └── index.ts
├── context/               # React Context providers
│   ├── PinnedChartsContext.tsx
│   └── index.ts
├── hooks/                 # Custom hooks
│   └── index.ts
├── types/                 # TypeScript types
│   └── index.ts
├── utils/                 # Utility functions
│   └── index.ts
├── constants/             # Constants
│   └── index.ts
└── services/              # API services
    └── api.ts
```

---

### 6.3 Migration Steps

1. **Remove duplicate files**
   - Keep only versions in `features/`
   - Update all imports

2. **Move View components**
   - Move all `*View.tsx` from `components/` to `pages/`
   - Update imports in `App.tsx`

3. **Reorganize features/**
   - Group by feature domain (charts, dashboards, databases, ai)

4. **Create missing shared components**
   - Implement components listed in Section 5

5. **Update imports**
   - Use absolute paths (`@/...`)
   - Update index files

---

## 7. Summary Statistics

### Duplicate Patterns Found:
- **Page Headers:** 7+ instances
- **Empty States:** 3+ instances
- **Loading Skeletons:** 2+ instances
- **Search + Filter:** 2+ instances
- **Stats Cards:** 3+ instances
- **Gradient Buttons:** 32+ files
- **Status Badges:** Multiple instances
- **View Mode Toggles:** 1 instance (but pattern could be reused)

### Duplicate Files:
- **11 component pairs** duplicated between root and features/
- **4 layout/context** components in wrong locations
- **13 View components** should be in pages/

### Inline Styles:
- **8 instances** of animation delays
- **4 instances** of hardcoded tooltip styles
- **1 instance** of image style prop (acceptable)

---

## 8. Priority Recommendations

### Immediate Actions (High Impact)
1. ✅ **Use existing shared components** (`PageHeader`, `EmptyState`, `StatCard`)
2. 🗑️ **Remove duplicate files** from `components/` root
3. 📦 **Move View components** to `pages/` directory
4. 🎨 **Create `<PageContainer>`** component

### Short-term (Medium Impact)
5. 🎨 **Create `<SearchFilterBar>`** component
6. 🎨 **Create `<SkeletonCard>`** components
7. 🎨 **Create `<StatusBadge>`** component
8. 🎨 **Create `<ViewModeToggle>`** component
9. 🎨 **Add gradient button variant** or component

### Long-term (Polish)
10. 🎨 **Create `<MiniChartPreview>`** component
11. 🎨 **Create `<ActionButtonGroup>`** component
12. 🗂️ **Reorganize features/** by domain
13. 🧹 **Remove inline animation delays** (use CSS classes)

---

## 9. Benefits of Refactoring

### Code Quality
- ✅ Reduced duplication
- ✅ Improved maintainability
- ✅ Consistent UI patterns
- ✅ Better type safety

### Performance
- ✅ Smaller bundle size (removed duplicates)
- ✅ Better tree-shaking
- ✅ Faster development

### Developer Experience
- ✅ Easier to find components
- ✅ Clearer folder structure
- ✅ Consistent patterns
- ✅ Better IDE support

---

**Last Updated:** Generated from codebase analysis
**Next Steps:** Review and prioritize recommendations based on team needs

