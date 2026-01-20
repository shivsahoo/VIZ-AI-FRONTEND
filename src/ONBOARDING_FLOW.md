# VizAI Onboarding Flow

## Overview
The VizAI onboarding experience is a streamlined 3-step journey that guides users through project creation, database connection, and data understanding. The first step uses a simple form for quick setup, while the remaining steps leverage AI assistance for deeper insights.

## The Flow

### 1️⃣ **After Login**
When a user logs in, the system checks if they have completed onboarding before:
- **First-Time Users**: Automatically shown the onboarding flow
- **Returning Users**: Taken to the Projects View with their existing projects

The system uses `localStorage` to track onboarding completion.

### 2️⃣ **Step 1: Form-Based Project Creation**
A simple, straightforward form for creating your project:

**Required Fields**:
1. **Project Name**: Enter a descriptive name for your analytics project (3-100 characters)

**Optional Fields**:
2. **Project Description**: Provide details about what this project is about (up to 2000 characters)

**Features**:
- Quick and efficient - no LLM/WebSocket dependency
- Real-time validation with helpful error messages
- Character count indicator for description field
- Clean, modern UI with clear call-to-action
- Project is created immediately via REST API
- Returns project ID for subsequent steps

**Technical Flow**:
- Form submission calls `/api/v1/backend/create-project` endpoint
- Backend creates project and assigns user as super admin
- Project ID is returned and passed to Step 2

### 3️⃣ **Step 2: Database Connection** (Mandatory)
The user must connect their first database to complete setup:
- **Two Connection Methods**:
  - Form-based: Step-by-step form with all fields
  - Connection String: Quick setup with a connection URL
- **Supported Databases**: PostgreSQL and MySQL
- **Validation**: Connection is tested before proceeding

### 4️⃣ **Step 3: Database Context Understanding** (AI-Powered)
An AI assistant asks questions about your database to understand your data:
- **KPI Collection**: What metrics matter most to your business?
- **Analysis Goals**: What insights are you looking to generate?
- **Data Relationships**: How do your tables relate to each other?

**Features**:
- Conversational AI interface
- Natural language processing for understanding context
- Generates intelligent dashboard suggestions
- Collects and stores KPI information

### 5️⃣ **Completion**
After all three steps are complete:
- Success message is shown with confetti effect
- User is automatically taken to their new workspace
- The project is selected and ready to use
- Database is connected and available
- KPI information is saved
- Onboarding is marked as completed in localStorage

## User Journeys

### First-Time User Journey
```
Login → Project Form → Database Setup → AI Context Collection → Workspace
```

### Returning User Journey
```
Login → Projects View → [Select Project] → Workspace
```

### Creating Additional Projects
```
Projects View → [New Project Button] → Project Form → Database Setup → AI Context Collection → Workspace
```

## Components

### `OnboardingFlow.tsx`
Main orchestrator component that manages the 3-step flow with visual progress indicator and smooth step transitions.

### `ProjectCreationForm.tsx`
Simple, form-based interface for creating projects with validation:
- Two fields: Project Name (required) and Description (optional)
- Real-time validation and error handling
- Direct API integration with backend
- Returns project ID for subsequent steps
- **No LLM/WebSocket dependency** - fast and reliable

### `DatabaseSetupGuided.tsx`
Guided database connection setup with both form-based and connection string methods. Uses the project ID from Step 1.

### `DatabaseContextBot.tsx`
AI-powered conversational interface that understands your database and collects KPI information for intelligent dashboard generation.

## Key Features

⚡ **Fast & Simple**: Form-based project creation - no waiting for AI  
🔗 **Database-First**: Ensures every project has at least one data source  
🤖 **AI-Enhanced**: Smart database understanding in Step 3  
🎨 **Beautiful UI**: Smooth animations and transitions between steps  
📊 **Progress Tracking**: Clear visual progress indicator shows current step  
💾 **Persistent State**: Uses localStorage to remember onboarding completion  
✅ **Validation**: Real-time form validation with helpful error messages  
🎯 **Reliable**: REST API-based - no WebSocket connection required for project creation

## Technical Implementation

- Uses `motion/react` (Framer Motion) for smooth transitions
- Progress indicator with 3-step visualization
- State management in App.tsx with localStorage persistence
- REST API for project creation (no WebSocket needed)
- Project ID is passed from Step 1 to Step 2 for database connection
- Automatic workspace navigation after completion
- Toast notifications for success feedback
- Responsive design for mobile and desktop
- Form validation with real-time error messages

## Testing the Flow

To test the onboarding flow again after completing it once, open the browser console and run:
```javascript
localStorage.removeItem('vizai_onboarding_completed');
```
Then refresh the page and log in again.

## Architecture Benefits

### Why Form-Based Project Creation?
1. **Faster Setup**: No waiting for WebSocket connection or LLM processing
2. **More Reliable**: REST API is simpler and has fewer failure points
3. **Better UX**: Users can quickly enter basic info and move forward
4. **Clearer Requirements**: Form clearly shows what's required vs optional
5. **Cost Effective**: No LLM tokens used for basic data collection
6. **Offline Friendly**: Works even if LLM service is down

### When AI Is Used
AI assistance is strategically used where it adds value:
- **Step 3**: Database context understanding and KPI collection
- **Later Features**: Chart generation, insights, and recommendations

## Future Enhancements

- Multiple database connections during setup
- Template selection for different industries
- Sample data import option
- Video tutorials during each step
- Invite team members during onboarding
- Skip functionality for experienced users
- Onboarding progress save/resume
- Project templates with pre-configured settings
