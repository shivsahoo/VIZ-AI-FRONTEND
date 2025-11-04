# VizAI - Modern Analytics Portal

VizAI is a premium, AI-powered analytics platform that connects to SQL databases (PostgreSQL and MySQL), interprets data through AI, and enables users to visualize insights using charts, dashboards, and conversational queries.

## 🎯 Overview

VizAI combines luxury design aesthetics with enterprise-level usability, providing a modern interface for data exploration and visualization.

### Key Features

- **🔐 Authentication & Onboarding**: Streamlined 4-step onboarding flow with premium animations
- **📊 Dashboard Management**: Create and manage dashboards with conversational AI assistance
- **📈 Chart Visualization**: Multiple chart types (Line, Bar, Pie, Area) with Recharts integration
- **🗄️ Database Connections**: Full-screen wizard for PostgreSQL and MySQL connections
- **🤖 AI Assistant**: Conversational interface for data queries and insights
- **👥 User Management**: Comprehensive role-based access control (Admin, Member, Custom Roles)
- **🎨 Theme Support**: Light and dark mode with smooth transitions
- **📌 Pin Functionality**: Pin favorite charts for quick access
- **🔍 Insights**: AI-powered data insights and recommendations

## 🎨 Design System

### Color Palette

- **Primary Background**: Deep charcoal/navy (#0B0F19, #121C2E)
- **Secondary Background**: Off-white (#F8F9FB)
- **Accent Colors**: Vibrant teal/cyan (#00C2A8)
- **Gradients**: Premium gradient effects for CTAs and highlights

### Typography

- **Fonts**: Inter, Poppins, or Satoshi
- **Grid**: 12-column layout system
- **Spacing**: Generous whitespace for clean, minimal aesthetic
- **Border Radius**: 12-20px for rounded corners
- **Shadows**: Subtle card elevations with glassmorphism effects

## 📁 Project Structure

```
/
├── App.tsx                          # Main application entry point
├── components/
│   ├── AIAssistant.tsx             # AI chat assistant slider
│   ├── AskVizAIView.tsx            # Conversational query interface
│   ├── AuthView.tsx                # Authentication screen
│   ├── ChartCard.tsx               # Reusable chart card component
│   ├── ChartPreviewDialog.tsx      # Chart preview modal
│   ├── ChartsView.tsx              # Charts management page
│   ├── DashboardCard.tsx           # Reusable dashboard card component
│   ├── DashboardCreationBot.tsx    # Conversational dashboard creator
│   ├── DashboardDetailView.tsx     # Individual dashboard view
│   ├── DashboardsView.tsx          # Dashboards management page
│   ├── DatabaseConnectionFlow.tsx  # Database connection wizard
│   ├── DatabasesView.tsx           # Database management page
│   ├── HomeDashboardView.tsx       # Workspace home/overview
│   ├── InsightsView.tsx            # AI insights page
│   ├── OnboardingFlow.tsx          # 4-step onboarding wizard
│   ├── ProfileView.tsx             # User profile settings
│   ├── ProjectsView.tsx            # Projects selector/landing
│   ├── SettingsView.tsx            # Application settings
│   ├── TopBar.tsx                  # Main navigation bar
│   ├── UsersView.tsx               # Team & role management
│   ├── WorkspaceSidebar.tsx        # Workspace navigation sidebar
│   ├── WorkspaceView.tsx           # Main workspace container
│   └── ui/                         # ShadCN UI components
├── styles/
│   └── globals.css                 # Global styles and CSS variables
└── guidelines/
    └── Guidelines.md               # Development guidelines
```

## 🚀 Getting Started

### Prerequisites

- Node.js 16+ and npm/yarn
- Modern web browser with ES6+ support

### Installation

This is a React + TypeScript application built with Vite and Tailwind CSS.

```bash
# Install dependencies (if needed)
npm install

# Run development server
npm run dev
```

## 🔑 Core Screens

### 1. Landing/Project Selector (`ProjectsView.tsx`)
- View all projects
- Create new projects
- Search and filter projects
- Project cards with metadata

### 2. Workspace Dashboard (`HomeDashboardView.tsx`)
- Overview metrics and KPIs
- Recent activity feed
- Pinned charts quick access
- AI-generated insights

### 3. Database Connections (`DatabasesView.tsx`)
- Add PostgreSQL/MySQL connections
- Test connections
- Manage connection settings
- View table schemas

### 4. Dashboards Page (`DashboardsView.tsx`)
- Create dashboards via conversational AI
- Grid/list view of dashboards
- Filter and search
- Dashboard templates

### 5. Charts Detail (`ChartsView.tsx`)
- Create and edit charts
- Multiple visualization types
- Data source selection
- Export and sharing options

### 6. Ask VizAI (`AskVizAIView.tsx`)
- Conversational data queries
- Natural language to SQL
- AI-powered insights
- Query history

### 7. Insights Page (`InsightsView.tsx`)
- Auto-generated insights
- Trend analysis
- Anomaly detection
- Recommendations

### 8. User Management (`UsersView.tsx`)
- Invite team members
- Role assignment (Admin, Member, Custom)
- Database/table-level permissions
- Activity monitoring

### 9. Settings (`SettingsView.tsx`)
- Profile settings
- Workspace preferences
- Audit logs
- Integrations

## 👥 Role-Based Access Control

### Admin Role
- **Projects**: Read-only
- **Team**: Full CRUD access
- **Databases**: Full CRUD access
- **Dashboards & Charts**: Full CRUD access
- **Insights**: Full CRUD access

### Member Role
- **Projects**: Read-only
- **Team**: Read-only
- **Databases**: Create, Read, Update
- **Dashboards & Charts**: Create, Read, Update
- **Insights**: Create, Read, Update

### Custom Roles
- Create roles with specific permissions
- Assign database and table-level access
- Granular permission control
- Role templates

## 🎨 Key Features

### Glassmorphism UI
- Frosted glass effects
- Backdrop blur
- Subtle transparency
- Premium aesthetic

### Chart Types
- **Line Charts**: Trend visualization
- **Bar Charts**: Comparative analysis
- **Pie Charts**: Distribution analysis
- **Area Charts**: Cumulative trends

### AI Integration
- Conversational dashboard creation
- Natural language queries
- Auto-generated insights
- Smart recommendations

### Responsive Design
- Mobile-optimized layouts
- Tablet-friendly interfaces
- Desktop-first design
- Adaptive components

## 🔧 Technology Stack

- **Framework**: React 18+ with TypeScript
- **Styling**: Tailwind CSS v4.0
- **UI Components**: ShadCN/UI
- **Charts**: Recharts
- **Icons**: Lucide React
- **State Management**: React Context API
- **Notifications**: Sonner
- **Animations**: Framer Motion (Motion/React)

## 📝 Development Guidelines

- Follow component-based architecture
- Use TypeScript for type safety
- Implement proper error handling
- Add comprehensive comments
- Create reusable components
- Follow design system guidelines
- Maintain accessibility standards

## 🔐 Security

- Role-based access control (RBAC)
- Database credential encryption (planned)
- Audit logging
- Session management
- CORS and API security

## 📊 API Integration

VizAI uses a stub API architecture for development. See `API_REFERENCE.md` for detailed API documentation.

## 🤝 Contributing

1. Follow the code style guidelines
2. Add comprehensive comments
3. Create reusable components
4. Update documentation
5. Test thoroughly

## 📄 License

Proprietary - All rights reserved

## 📞 Support

For support and questions, please refer to the internal documentation or contact the development team.

---

**Version**: 1.0.0  
**Last Updated**: November 2024
