/**
 * OnboardingFlow Component
 *
 * New flow:
 * Step 1 only -> Create Product (name + description).
 * Datasource connection is done later from Home/Databases.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, CheckCircle2 } from "lucide-react";
import { ProjectCreationForm } from "../components/features/projects/ProjectCreationForm";

interface OnboardingFlowProps {
  onComplete: (projectData: {
    name: string;
    description: string;
    context: Record<string, string>;
    database?: any;
    selectedTables?: string[];
    databaseContext?: Record<string, string>;
  }) => void;
  onCancel?: () => void;
}

export function OnboardingFlow({ onComplete, onCancel }: OnboardingFlowProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectId, setProjectId] = useState<string | undefined>(undefined);

  const handleProjectSetupComplete = (data: {
    name: string;
    description: string;
    projectId: string;
    primary_domain: string;
    additional_kpis: string | null;
  }) => {
    setProjectName(data.name);
    setProjectDescription(data.description);
    setProjectId(data.projectId);
    onComplete({
      name: data.name,
      description: data.description,
      context: {
        project_name: data.name,
        project_description: data.description,
        primary_domain: data.primary_domain,
        ...(data.additional_kpis != null && data.additional_kpis !== ""
          ? { additional_kpis: data.additional_kpis }
          : {}),
        ...(data.projectId ? { projectId: data.projectId } : {}),
      },
      database: null,
      selectedTables: [],
      databaseContext: {},
    });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 bg-grid-pattern opacity-30" />
      <div className="absolute top-20 left-20 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
      
      <div className="w-full max-w-6xl relative z-10">
        {/* Progress Steps */}
        <div className="mb-8 md:mb-12">
          <div className="flex items-center justify-center gap-2 md:gap-3">
            {[
              { number: 1, label: "Create Product", icon: Sparkles }
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
                  {index < 0 && (
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
              <ProjectCreationForm
                onComplete={handleProjectSetupComplete}
                onCancel={onCancel}
              />
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
