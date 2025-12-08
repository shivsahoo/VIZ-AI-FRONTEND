import { useState, useEffect, useRef } from "react";
import { TopBar } from "./components/layout/TopBar";
import { WorkspaceSidebar } from "./components/layout/WorkspaceSidebar";
import { ProjectsView } from "./pages/ProjectsView";
import { WorkspaceView } from "./pages/WorkspaceView";
import { AuthView } from "./pages/AuthView";
import { ProfileView } from "./pages/ProfileView";
import { AIAssistant } from "./components/features/ai/AIAssistant";
import { OnboardingFlow } from "./pages/OnboardingFlow";
import { Toaster } from "./components/ui/sonner";
import { toast } from "sonner";
import { PinnedChartsProvider } from "./context/PinnedChartsContext";
import { getProjects, getCurrentUser } from "./services/api";

// Mock user ID for now
const MOCK_USER_ID = 1;

type UserRole = 'super_admin' | 'project_user';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true); // Add loading state for auth check
  const [currentUser, setCurrentUser] = useState<{ name: string; email: string; role: UserRole } | null>(null);
  // Initialize state from localStorage if available
  const [currentView, setCurrentView] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('vizai_current_view') || 'home';
    }
    return 'home';
  });
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [isDark, setIsDark] = useState(false);
  const [workspaceTab, setWorkspaceTab] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('vizai_workspace_tab') || 'home';
    }
    return 'home';
  });
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);
  const [chartCreatedTrigger, setChartCreatedTrigger] = useState(0);
  const [dashboardRefreshTrigger, setDashboardRefreshTrigger] = useState(0);
  const [pendingChartFromAI, setPendingChartFromAI] = useState<{
    id?: string;
    name: string;
    type: 'line' | 'bar' | 'pie' | 'area';
    dataSource: string;
    query: string;
    status: 'draft' | 'published';
    dashboardId?: number | string;
  } | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [editingChart, setEditingChart] = useState<{
    name: string;
    type: 'line' | 'bar' | 'pie' | 'area';
    description?: string;
  } | null>(null);
  const prevWorkspaceTabRef = useRef<string>(workspaceTab);

  const isInWorkspace = currentView === 'workspace' && Boolean(selectedProject);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  // Check for existing session on app mount
  useEffect(() => {
    const checkAuth = async () => {
      setIsCheckingAuth(true);
      
      // Check if tokens exist in localStorage
      const accessToken = localStorage.getItem('vizai_access_token');
      const refreshToken = localStorage.getItem('vizai_refresh_token');
      
      if (!accessToken || !refreshToken) {
        // No tokens, ensure user is logged out
        setIsAuthenticated(false);
        setCurrentUser(null);
        setSelectedProject(null);
        setSelectedProjectId(null);
        setIsCheckingAuth(false);
        return; // No tokens, user needs to login
      }
      
      // Try to get current user info (this will auto-refresh token if needed)
      try {
        const response = await getCurrentUser();
        if (response.success && response.data) {
          // Restore session
          setCurrentUser({
            name: response.data.name || response.data.username,
            email: response.data.email,
            role: response.data.role === 'admin' ? 'super_admin' : 'project_user', // Map role
          });
          setIsAuthenticated(true);
          
          // Check onboarding status
          const hasCompletedOnboardingBefore = localStorage.getItem('vizai_onboarding_completed') === 'true';
          setHasCompletedOnboarding(hasCompletedOnboardingBefore);
          setShowOnboarding(false);
          
          // Note: Project restoration will happen after projects are fetched
          // to ensure the project still exists
        } else {
          // Token invalid, clear tokens and logout
          localStorage.removeItem('vizai_access_token');
          localStorage.removeItem('vizai_refresh_token');
          setIsAuthenticated(false);
          setCurrentUser(null);
          setSelectedProject(null);
          setSelectedProjectId(null);
        }
      } catch (error) {
        // Token invalid or expired, clear tokens and logout
        localStorage.removeItem('vizai_access_token');
        localStorage.removeItem('vizai_refresh_token');
        setIsAuthenticated(false);
        setCurrentUser(null);
        setSelectedProject(null);
        setSelectedProjectId(null);
      } finally {
        setIsCheckingAuth(false);
      }
    };
    
    checkAuth();
  }, []); // Run only on mount

  // Listen for storage changes (logout in other tabs)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      // Check if tokens were removed
      if (e.key === 'vizai_access_token' || e.key === 'vizai_refresh_token') {
        const accessToken = localStorage.getItem('vizai_access_token');
        const refreshToken = localStorage.getItem('vizai_refresh_token');
        
        // If tokens are missing, logout this tab immediately
        if (!accessToken || !refreshToken) {
          setIsAuthenticated(false);
          setCurrentUser(null);
          setSelectedProject(null);
          setSelectedProjectId(null);
          setCurrentView('home');
          setWorkspaceTab('home');
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Fetch projects on mount to have project IDs available
  useEffect(() => {
    if (isAuthenticated) {
      fetchProjects();
    }
  }, [isAuthenticated]);

  // Save currentView to localStorage whenever it changes
  useEffect(() => {
    if (isAuthenticated && typeof window !== 'undefined') {
      localStorage.setItem('vizai_current_view', currentView);
    }
  }, [currentView, isAuthenticated]);

  // Save workspaceTab to localStorage whenever it changes
  useEffect(() => {
    if (isAuthenticated && typeof window !== 'undefined') {
      localStorage.setItem('vizai_workspace_tab', workspaceTab);
    }
  }, [workspaceTab, isAuthenticated]);

  // Restore last selected project and view after projects are loaded
  useEffect(() => {
    if (isAuthenticated && projects.length > 0 && !selectedProject) {
      const lastProject = localStorage.getItem('vizai_last_project');
      const lastProjectId = localStorage.getItem('vizai_last_project_id');
      const savedView = localStorage.getItem('vizai_current_view');
      const savedTab = localStorage.getItem('vizai_workspace_tab');
      
      if (lastProject) {
        // Verify the project still exists in the projects list
        const projectExists = projects.find(p => p.name === lastProject || p.id === lastProjectId);
        
        if (projectExists) {
          // Restore the project
          setSelectedProject(lastProject);
          setSelectedProjectId(projectExists.id);
          
          // Restore view and tab if they were in workspace
          if (savedView === 'workspace') {
            setCurrentView('workspace');
            if (savedTab) {
              setWorkspaceTab(savedTab);
            }
          }
        } else {
          // Project no longer exists, clear from localStorage
          localStorage.removeItem('vizai_last_project');
          localStorage.removeItem('vizai_last_project_id');
          // If view was workspace but project doesn't exist, go to home
          if (savedView === 'workspace') {
            setCurrentView('home');
            localStorage.setItem('vizai_current_view', 'home');
          }
        }
      } else {
        // No project saved, but restore view if it's not workspace
        if (savedView && savedView !== 'workspace') {
          setCurrentView(savedView);
        }
      }
    } else if (isAuthenticated && !selectedProject) {
      // Authenticated but no project - restore non-workspace views
      const savedView = localStorage.getItem('vizai_current_view');
      if (savedView && savedView !== 'workspace') {
        setCurrentView(savedView);
      }
    }
  }, [isAuthenticated, projects, selectedProject]);

  const fetchProjects = async () => {
    try {
      const response = await getProjects();
      if (response.success && response.data) {
        setProjects(response.data.map(p => ({ id: p.id, name: p.name })));
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    }
  };

  const handleProjectSelect = (projectName: string, projectId?: string) => {
    setSelectedProject(projectName);
    
    // Find project ID if not provided
    let finalProjectId: string | null = null;
    if (projectId) {
      finalProjectId = projectId;
    } else {
      const project = projects.find(p => p.name === projectName);
      finalProjectId = project?.id || null;
    }
    setSelectedProjectId(finalProjectId);
    
    setCurrentView('workspace');
    setWorkspaceTab('home'); // Reset to home when entering a project
    
    // Store last visited project for ALL users (not just project_user)
    localStorage.setItem('vizai_last_project', projectName);
    if (finalProjectId) {
      localStorage.setItem('vizai_last_project_id', finalProjectId);
    }
  };

  const handleProjectChange = (projectName: string) => {
    const project = projects.find(p => p.name === projectName);
    setSelectedProject(projectName);
    setSelectedProjectId(project?.id || null);
    setWorkspaceTab('home'); // Reset to home when switching projects
    
    // Store last visited project for ALL users (not just project_user)
    localStorage.setItem('vizai_last_project', projectName);
    if (project?.id) {
      localStorage.setItem('vizai_last_project_id', project.id);
    }
  };

  const handleBackToHome = () => {
    setSelectedProject(null);
    setCurrentView('home');
  };

  const handleAuthenticated = (user: { name: string; email: string; role: UserRole }) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
    
    setCurrentView('home');
    setShowOnboarding(false);
    setHasCompletedOnboarding(true);
    
    setSelectedProject(null);
    setSelectedProjectId(null);
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
    // Clear authentication state
    setCurrentUser(null);
    setIsAuthenticated(false);
    setSelectedProject(null);
    setSelectedProjectId(null);
    setCurrentView('home');
    setWorkspaceTab('home');
    
    // Clear local storage tokens
    localStorage.removeItem('vizai_access_token');
    localStorage.removeItem('vizai_refresh_token');
    localStorage.removeItem('vizai_last_project');
    localStorage.removeItem('vizai_last_project_id');
    localStorage.removeItem('vizai_current_view');
    localStorage.removeItem('vizai_workspace_tab');
  };

  const handleUpdateProfile = (user: { name: string; email: string }) => {
    if (currentUser) {
      setCurrentUser({ ...user, role: currentUser.role });
    }
  };

  const handleLogout = () => {
    // Clear authentication state
    setIsAuthenticated(false);
    setCurrentUser(null);
    setSelectedProject(null);
    setSelectedProjectId(null);
    setCurrentView('home');
    setWorkspaceTab('home');
    
    // Clear local storage
    localStorage.removeItem('vizai_access_token');
    localStorage.removeItem('vizai_refresh_token');
    localStorage.removeItem('vizai_last_project');
    localStorage.removeItem('vizai_last_project_id');
    localStorage.removeItem('vizai_current_view');
    localStorage.removeItem('vizai_workspace_tab');
  };

  const handleThemeToggle = () => {
    setIsDark(!isDark);
  };

  const handleChartCreatedFromAI = (chart: {
    id?: string;
    name: string;
    type: 'line' | 'bar' | 'pie' | 'area';
    dataSource: string;
    query: string;
    status: 'draft' | 'published';
    dashboardId?: number | string;
  }) => {
    // If chart was added to a dashboard, stay on current page and keep AI Assistant open
    // Check if dashboardId exists (can be number or string UUID)
    const hasDashboardId = chart.dashboardId !== undefined && 
                           chart.dashboardId !== null && 
                           (typeof chart.dashboardId === 'number' ? chart.dashboardId !== 0 : chart.dashboardId !== '');
    
    if (hasDashboardId) {
      // Store the chart data (might be used for refresh)
      setPendingChartFromAI(chart);
      // Trigger re-render in ChartsView (in case user navigates there later)
      setChartCreatedTrigger(prev => prev + 1);
      // Trigger dashboard refresh to show the newly added chart
      setDashboardRefreshTrigger(prev => prev + 1);
      // Keep AI Assistant open so user can continue generating charts
      if (!isAIAssistantOpen) {
        setIsAIAssistantOpen(true);
      }
      // Don't navigate - stay on current page (dashboard)
      return;
    }

    // For charts not added to dashboard, navigate to charts page
    // Store the chart data to be passed to ChartsView (used to trigger creation/refetch)
    setPendingChartFromAI(chart);
    // Trigger re-render in ChartsView
    setChartCreatedTrigger(prev => prev + 1);
    // Switch to charts tab to show the newly created chart
    setWorkspaceTab('charts');
    // Ensure AI assistant (and any modal it spawns) closes so the charts page stays interactive
    if (isAIAssistantOpen) {
      setIsAIAssistantOpen(false);
      setEditingChart(null);
    }
  };

  const renderView = () => {
    if (currentView === 'workspace' && selectedProject) {
      // Use selectedProjectId if available, otherwise try to find it
      const projectId = selectedProjectId || projects.find(p => p.name === selectedProject)?.id;
      
      return (
        <WorkspaceView 
          projectName={selectedProject} 
          onBack={handleBackToHome}
          isDark={isDark}
          activeTab={workspaceTab}
          onTabChange={setWorkspaceTab}
          currentUser={currentUser ? { ...currentUser, id: MOCK_USER_ID } : undefined}
          projectId={projectId || undefined}
          chartCreatedTrigger={chartCreatedTrigger}
          dashboardRefreshTrigger={dashboardRefreshTrigger}
          pendingChartFromAI={pendingChartFromAI}
          onChartFromAIProcessed={() => setPendingChartFromAI(null)}
          onOpenAIAssistant={() => setIsAIAssistantOpen(prev => !prev)}
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
          <ProfileView 
            user={currentUser} 
            onUpdateProfile={handleUpdateProfile}
            onLogout={handleLogout}
          />
        ) : null;
      default:
        return <ProjectsView onProjectSelect={handleProjectSelect} />;
    }
  };

  // Auto-close assistant when navigating away from workspace entirely
  useEffect(() => {
    if (!isInWorkspace && isAIAssistantOpen) {
      setIsAIAssistantOpen(false);
    }
  }, [isInWorkspace, isAIAssistantOpen]);

  // Auto-close assistant when navigating to a different tab/page within workspace
  useEffect(() => {
    // Only close if tab actually changed (not on initial mount)
    if (prevWorkspaceTabRef.current !== workspaceTab && isInWorkspace && isAIAssistantOpen) {
      setIsAIAssistantOpen(false);
      setEditingChart(null); // Clear editing chart when navigating away
    }
    // Update ref for next comparison
    prevWorkspaceTabRef.current = workspaceTab;
  }, [workspaceTab, isInWorkspace, isAIAssistantOpen]);

  // Show loading state while checking authentication
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen w-full bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

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
          projects={projects}
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
              onOpenAIAssistant={() => setIsAIAssistantOpen(prev => !prev)}
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
          projectId={selectedProjectId || projects.find(p => p.name === selectedProject)?.id || undefined}
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
