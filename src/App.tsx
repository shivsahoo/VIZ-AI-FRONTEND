import { useState, useEffect } from "react";
import { TopBar } from "./components/TopBar";
import { WorkspaceSidebar } from "./components/WorkspaceSidebar";
import { ProjectsView } from "./components/ProjectsView";
import { WorkspaceView } from "./components/WorkspaceView";
import { AuthView } from "./components/AuthView";
import { ProfileView } from "./components/ProfileView";
import { AIAssistant } from "./components/AIAssistant";
import { OnboardingFlow } from "./components/OnboardingFlow";
import { Toaster } from "./components/ui/sonner";
import { toast } from "sonner@2.0.3";
import { PinnedChartsProvider } from "./components/PinnedChartsContext";

const mockProjects = [
  { id: 1, name: "E-Commerce Analytics" },
  { id: 2, name: "Marketing Intelligence" },
  { id: 3, name: "Financial Reporting" },
  { id: 4, name: "Product Analytics" }
];

// Mock user ID for now
const MOCK_USER_ID = 1;

type UserRole = 'super_admin' | 'project_user';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ name: string; email: string; role: UserRole } | null>(null);
  const [currentView, setCurrentView] = useState('home');
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(false);
  const [workspaceTab, setWorkspaceTab] = useState('home');
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);
  const [chartCreatedTrigger, setChartCreatedTrigger] = useState(0);
  const [pendingChartFromAI, setPendingChartFromAI] = useState<{
    name: string;
    type: 'line' | 'bar' | 'pie' | 'area';
    dataSource: string;
    query: string;
    status: 'draft' | 'published';
    dashboardId?: number;
  } | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [editingChart, setEditingChart] = useState<{
    name: string;
    type: 'line' | 'bar' | 'pie' | 'area';
    description?: string;
  } | null>(null);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  const handleProjectSelect = (projectName: string) => {
    setSelectedProject(projectName);
    setCurrentView('workspace');
    setWorkspaceTab('home'); // Reset to home when entering a project
    // Store last visited project for project users
    if (currentUser?.role === 'project_user') {
      localStorage.setItem('vizai_last_project', projectName);
    }
  };

  const handleProjectChange = (projectName: string) => {
    setSelectedProject(projectName);
    setWorkspaceTab('home'); // Reset to home when switching projects
    // Store last visited project for project users
    if (currentUser?.role === 'project_user') {
      localStorage.setItem('vizai_last_project', projectName);
    }
  };

  const handleBackToHome = () => {
    setSelectedProject(null);
    setCurrentView('home');
  };

  const handleAuthenticated = (user: { name: string; email: string; role: UserRole }) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
    
    // Role-based navigation
    if (user.role === 'super_admin') {
      // Super admin always sees home page
      setCurrentView('home');
      setShowOnboarding(false);
      setHasCompletedOnboarding(true);
    } else {
      // Project users
      const hasCompletedOnboardingBefore = localStorage.getItem('vizai_onboarding_completed') === 'true';
      
      if (!hasCompletedOnboardingBefore) {
        // First-time user - show onboarding
        setShowOnboarding(true);
        setHasCompletedOnboarding(false);
      } else {
        // Returning user - navigate to last project or home
        const lastProject = localStorage.getItem('vizai_last_project');
        if (lastProject && mockProjects.some(p => p.name === lastProject)) {
          setSelectedProject(lastProject);
          setCurrentView('workspace');
          setWorkspaceTab('home');
        } else {
          setCurrentView('home');
        }
        setShowOnboarding(false);
        setHasCompletedOnboarding(true);
      }
    }
  };

  const handleOnboardingComplete = (projectData: {
    name: string;
    description: string;
    context: Record<string, string>;
    database: any;
  }) => {
    setShowOnboarding(false);
    setHasCompletedOnboarding(true);
    // Mark onboarding as completed in localStorage
    localStorage.setItem('vizai_onboarding_completed', 'true');
    // In production, you would save the project data to the backend here
    console.log("Project created:", projectData);
    
    // Show success message
    setTimeout(() => {
      toast.success("🎉 Project setup complete!", {
        description: `Welcome to ${projectData.name}! Your workspace is ready.`
      });
    }, 500);
    
    // Automatically select the newly created project
    setSelectedProject(projectData.name);
    setCurrentView('workspace');
    setWorkspaceTab('home');
    // Store as last visited project
    localStorage.setItem('vizai_last_project', projectData.name);
  };

  const handleOnboardingCancel = () => {
    setShowOnboarding(false);
    setHasCompletedOnboarding(true);
    // Mark onboarding as completed to prevent showing it again
    localStorage.setItem('vizai_onboarding_completed', 'true');
    setCurrentView('home');
    toast.info("Setup cancelled. You can create a project anytime from the home page.");
  };

  const handleSignOut = () => {
    setCurrentUser(null);
    setIsAuthenticated(false);
    setSelectedProject(null);
    setCurrentView('home');
    setWorkspaceTab('home');
  };

  const handleUpdateProfile = (user: { name: string; email: string }) => {
    setCurrentUser({ ...user, role: currentUser!.role });
  };

  const handleThemeToggle = () => {
    setIsDark(!isDark);
  };

  const handleChartCreatedFromAI = (chart: {
    name: string;
    type: 'line' | 'bar' | 'pie' | 'area';
    dataSource: string;
    query: string;
    status: 'draft' | 'published';
    dashboardId?: number;
  }) => {
    // Store the chart data to be passed to ChartsView
    setPendingChartFromAI(chart);
    // Trigger re-render in ChartsView
    setChartCreatedTrigger(prev => prev + 1);
    // Switch to charts tab to show the newly created chart
    setWorkspaceTab('charts');
  };

  const renderView = () => {
    if (currentView === 'workspace' && selectedProject) {
      const project = mockProjects.find(p => p.name === selectedProject);
      return (
        <WorkspaceView 
          projectName={selectedProject} 
          onBack={handleBackToHome}
          isDark={isDark}
          activeTab={workspaceTab}
          onTabChange={setWorkspaceTab}
          currentUser={currentUser ? { ...currentUser, id: MOCK_USER_ID } : undefined}
          projectId={project?.id}
          chartCreatedTrigger={chartCreatedTrigger}
          pendingChartFromAI={pendingChartFromAI}
          onChartFromAIProcessed={() => setPendingChartFromAI(null)}
          onOpenAIAssistant={() => setIsAIAssistantOpen(true)}
          onEditChart={(chart) => {
            setEditingChart(chart);
            setIsAIAssistantOpen(true);
          }}
        />
      );
    }

    switch (currentView) {
      case 'home':
        return <ProjectsView onProjectSelect={handleProjectSelect} />;
      case 'profile':
        return currentUser ? (
          <ProfileView user={currentUser} onUpdateProfile={handleUpdateProfile} />
        ) : null;
      default:
        return <ProjectsView onProjectSelect={handleProjectSelect} />;
    }
  };

  const isInWorkspace = currentView === 'workspace' && selectedProject;

  // Show auth view if not authenticated
  if (!isAuthenticated) {
    return (
      <>
        <AuthView onAuthenticated={handleAuthenticated} />
        <Toaster />
      </>
    );
  }

  // Show onboarding flow for new users
  if (showOnboarding && !hasCompletedOnboarding) {
    return (
      <>
        <OnboardingFlow 
          onComplete={handleOnboardingComplete} 
          onCancel={handleOnboardingCancel}
        />
        <Toaster />
      </>
    );
  }

  return (
    <PinnedChartsProvider>
      <div className="h-screen w-screen overflow-hidden bg-background transition-colors duration-200">
        <div className="flex flex-col h-full">
          {/* Top Bar - Always visible */}
          <TopBar
          currentView={currentView}
          onNavigate={setCurrentView}
          selectedProject={isInWorkspace ? selectedProject : null}
          workspaceTab={isInWorkspace ? workspaceTab : undefined}
          projects={mockProjects}
          onProjectChange={handleProjectChange}
          user={currentUser!}
          onSignOut={handleSignOut}
          isDark={isDark}
          onThemeToggle={handleThemeToggle}
        />
        
        {/* Main Content Area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Workspace Sidebar - Only visible when in a project */}
          {isInWorkspace && (
            <WorkspaceSidebar
              activeTab={workspaceTab}
              onTabChange={setWorkspaceTab}
              onOpenAIAssistant={() => setIsAIAssistantOpen(true)}
            />
          )}
          
          {/* Content */}
          <main className="flex-1 overflow-auto">
            {renderView()}
          </main>

          {/* AI Assistant Panel - Only visible when in workspace (except Databases and Team pages) */}
          {isInWorkspace && workspaceTab !== 'databases' && workspaceTab !== 'team' && (
            <AIAssistant 
              isOpen={isAIAssistantOpen}
              onOpenChange={(open) => {
                setIsAIAssistantOpen(open);
                if (!open) {
                  setEditingChart(null); // Clear editing chart when closing
                }
              }}
              onChartCreated={handleChartCreatedFromAI}
              editingChart={editingChart}
            />
          )}
        </div>
        </div>
        <Toaster />
      </div>
    </PinnedChartsProvider>
  );
}
