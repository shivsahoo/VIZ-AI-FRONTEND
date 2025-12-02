/**
 * OnboardingFlow Component
 * 
 * A streamlined 3-step conversational onboarding experience for VizAI:
 * 
 * Step 1: Conversational Project Creation
 *   - AI assistant conversationally asks for project name and description
 *   - Then gathers contextual information about industry, goals, team, and data sources
 *   - All done through natural conversation
 * 
 * Step 2: Database Connection Setup
 *   - Required step to connect the first database
 *   - Supports both form-based and connection string methods
 *   - Validates and tests the connection before completion
 *   - Database analysis happens automatically after connection
 * 
 * Step 3: Database Context Understanding
 *   - AI asks questions about the database to understand the data
 *   - Gathers information about key metrics, insights needed, and analysis requirements
 *   - Uses responses to intelligently generate dashboards
 * 
 * After completion, the user is automatically taken to their new workspace
 * with the project selected, database connected, and AI-ready to generate insights.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, CheckCircle2, Database, ArrowLeft } from "lucide-react";
import { ProjectContextBot } from "../components/features/ai/ProjectContextBot";
import { DatabaseSetupGuided } from "../components/features/databases/DatabaseSetupGuided";
import { DatabaseContextBot } from "../components/features/databases/DatabaseContextBot";
import { Button } from "../components/ui/button";

interface OnboardingFlowProps {
  onComplete: (projectData: {
    name: string;
    description: string;
    context: Record<string, string>;
    database: any;
    selectedTables?: string[];
    databaseContext?: Record<string, string>;
  }) => void;
  onCancel?: () => void;
}

export function OnboardingFlow({ onComplete, onCancel }: OnboardingFlowProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [enhancedDescription, setEnhancedDescription] = useState<string | undefined>(undefined);
  const [projectDomain, setProjectDomain] = useState<string | undefined>(undefined);
  const [projectContext, setProjectContext] = useState<Record<string, string>>({});
  const [projectId, setProjectId] = useState<string | undefined>(undefined);
  const [databaseConfig, setDatabaseConfig] = useState<any>(null);

  const handleBack = () => {
    if (currentStep === 1) {
      if (onCancel) {
        onCancel();
      }
      return;
    }
    setCurrentStep((prev) => Math.max(1, prev - 1));
  };

  const handleProjectSetupComplete = (data: {
    name: string;
    description: string;
    context: Record<string, string>;
    enhancedDescription?: string;
    domain?: string;
    projectId?: string;
  }) => {
    setProjectName(data.name);
    setProjectDescription(data.description);
    setEnhancedDescription(data.enhancedDescription);
    setProjectDomain(data.domain);
    setProjectContext(data.context);
    setProjectId(data.projectId);
    setCurrentStep(2);
  };

  const handleDatabaseComplete = (dbConfig: any) => {
    setDatabaseConfig(dbConfig);
    setCurrentStep(3);
  };

  const handleDatabaseContextComplete = (contextData: {
    responses: Record<string, string>;
    suggestedDashboards: Array<{
      name: string;
      description: string;
      charts: string[];
    }>;
  }) => {
    const contextPayload: Record<string, string> = {
      ...projectContext,
      ...contextData.responses,
    };

    if (enhancedDescription) {
      contextPayload.enhanced_description = enhancedDescription;
    }
    if (projectDomain) {
      contextPayload.domain = projectDomain;
    }
    // Include projectId from Step 1 if available
    if (projectId) {
      contextPayload.projectId = projectId;
    }

    // Complete onboarding
    onComplete({
      name: projectName,
      description: enhancedDescription || projectDescription,
      context: contextPayload,
      database: databaseConfig,
      selectedTables: [],
      databaseContext: contextData.responses
    });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 bg-grid-pattern opacity-30" />
      <div className="absolute top-20 left-20 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
      
      <div className="w-full max-w-5xl relative z-10">
        {/* Back & Cancel Actions */}
        {(currentStep > 1 || onCancel) && (
          <div className="flex items-center justify-between mb-4">
            <div>
              <Button
                variant="outline"
                size="icon"
                onClick={handleBack}
                className="border-border"
                disabled={currentStep === 1 && !onCancel}
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </div>
            {/* {onCancel && (
              <Button
                variant="ghost"
                onClick={onCancel}
                className="text-muted-foreground hover:text-foreground"
              >
                Cancel Setup
              </Button>
            )} */}
          </div>
        )}
        
        {/* Progress Steps */}
        <div className="mb-8 md:mb-12">
          <div className="flex items-center justify-center gap-2 md:gap-3">
            {[
              { number: 1, label: "Product Setup", icon: Sparkles },
              { number: 2, label: "Connect Database", icon: Database },
              { number: 3, label: "Understand Data", icon: Sparkles }
            ].map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={step.number} className="flex items-center gap-2 md:gap-3">
                  <div className="flex flex-col items-center gap-1 md:gap-2">
                    <div
                      className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-all ${
                        currentStep > step.number
                          ? "bg-success text-white"
                          : currentStep === step.number
                          ? "bg-gradient-to-r from-primary to-accent text-white shadow-lg"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {currentStep > step.number ? (
                        <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5" />
                      ) : (
                        <Icon className="w-4 h-4 md:w-5 md:h-5" />
                      )}
                    </div>
                    <p className={`text-xs ${currentStep === step.number ? "text-foreground" : "text-muted-foreground"} hidden md:block`}>
                      {step.label}
                    </p>
                  </div>
                  {index < 2 && (
                    <div
                      className={`w-8 md:w-16 h-0.5 mb-0 md:mb-6 ${
                        currentStep > step.number ? "bg-success" : "bg-muted"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step Content */}
        <AnimatePresence mode="wait">
          {currentStep === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <ProjectContextBot
                onComplete={handleProjectSetupComplete}
                onCancel={onCancel}
              />
            </motion.div>
          )}

          {currentStep === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <DatabaseSetupGuided
                projectName={projectName}
                projectId={projectId}
                onComplete={handleDatabaseComplete}
              />
            </motion.div>
          )}

          {currentStep === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <DatabaseContextBot
                databaseName={databaseConfig?.name || "Your Database"}
                databaseConnectionId={databaseConfig?.id}
                projectName={projectName}
                projectDescription={projectDescription}
                projectDomain={projectDomain}
                enhancedDescription={enhancedDescription}
                onComplete={handleDatabaseContextComplete}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
