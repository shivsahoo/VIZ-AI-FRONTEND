# VizAI Onboarding Flow

## Overview
The VizAI onboarding experience is a fully conversational, storyline-driven journey that guides users through two essential steps: conversational project setup and database connection.

## The Flow

### 1️⃣ **After Login**
When a user logs in, the system checks if they have completed onboarding before:
- **First-Time Users**: Automatically shown the onboarding flow
- **Returning Users**: Taken to the Projects View with their existing projects

The system uses `localStorage` to track onboarding completion.

### 2️⃣ **Step 1: Conversational Project Setup**
An AI assistant guides the user through project creation via natural conversation, asking:

1. **Project Name**: "What would you like to call your analytics project?"
2. **Project Description**: "Can you describe what this project is about?"
3. **Industry/Domain**: "What industry or domain is this project focused on?"
4. **Primary Goal**: "What's your primary goal with this analytics project?"
5. **Team Size**: "How many people will be using this workspace?"
6. **Data Sources**: "What types of data sources will you be connecting?"

**Features**:
- Natural conversational interface with contextual placeholders
- Real-time typing indicators and smooth message animations
- Progress tracking (Question X of 6)
- All answers are stored for future AI interactions

### 3️⃣ **Step 2: Database Connection** (Mandatory)
The user must connect their first database to complete setup:
- **Two Connection Methods**:
  - Form-based: Step-by-step form with all fields
  - Connection String: Quick setup with a connection URL
- **Supported Databases**: PostgreSQL and MySQL
- **Validation**: Connection is tested before proceeding

### 4️⃣ **Completion**
After both steps are complete:
- Success message is shown with confetti effect
- User is automatically taken to their new workspace
- The project is selected and ready to use
- Database is connected and available
- Onboarding is marked as completed in localStorage

## User Journeys

### First-Time User Journey
```
Login → Conversational Bot (6 questions) → Database Setup → Workspace
```

### Returning User Journey
```
Login → Projects View → [Select Project] → Workspace
```

### Creating Additional Projects
```
Projects View → [New Project Button] → Conversational Bot → Database Setup → Workspace
```

## Components

### `OnboardingFlow.tsx`
Main orchestrator component that manages the 2-step flow with visual progress indicator and smooth step transitions.

### `ProjectContextBot.tsx`
Fully conversational AI interface that gathers project name, description, and context through a chat-like experience. Now includes 6 questions total, starting with project basics.

### `DatabaseSetupGuided.tsx`
Guided database connection setup with both form-based and connection string methods.

## Key Features

✨ **Fully Conversational**: Everything happens through natural chat  
🤖 **AI-Powered**: Engaging chatbot collects all project information  
🔗 **Database-First**: Ensures every project has at least one data source  
🎨 **Beautiful UI**: Smooth animations and transitions between steps  
📊 **Progress Tracking**: Clear visual progress indicator shows current step  
💾 **Persistent State**: Uses localStorage to remember onboarding completion  
🎯 **Smart Placeholders**: Context-aware input placeholders for better UX

## Technical Implementation

- Uses `motion/react` (Framer Motion) for smooth transitions
- Progress indicator with 2-step visualization
- State management in App.tsx with localStorage persistence
- Automatic workspace navigation after completion
- Toast notifications for success feedback
- Responsive design for mobile and desktop

## Testing the Flow

To test the onboarding flow again after completing it once, open the browser console and run:
```javascript
localStorage.removeItem('vizai_onboarding_completed');
```
Then refresh the page and log in again.

## Future Enhancements

- Voice input for conversational bot
- Multiple database connections during setup
- Template selection for different industries
- Sample data import option
- Video tutorials during each step
- Invite team members during onboarding
- Skip functionality for experienced users
- Onboarding progress save/resume
