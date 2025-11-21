/**
 * DatabaseConnectionFlow Component
 * 
 * A streamlined 2-step wizard for adding database connections, aligned with the updated onboarding flow:
 * 
 * Step 1: Database Connection Setup
 *   - Form-based or connection string method
 *   - Validates and tests the connection
 * 
 * Step 2: Database Context Understanding
 *   - AI asks questions about the database
 *   - Gathers information to intelligently generate dashboards
 */

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Database, CheckCircle2, Sparkles, ArrowLeft } from "lucide-react";
import { DatabaseSetupGuided } from "./DatabaseSetupGuided.tsx";
import { DatabaseContextBot } from "./DatabaseContextBot.tsx";
import { Button } from "../../ui/button";

interface DatabaseConnectionFlowProps {
  projectId?: string;
  onComplete: (connectionData: {
    database: any;
    selectedTables: string[];
    databaseContext: Record<string, string>;
  }) => void;
  onCancel: () => void;
}

export function DatabaseConnectionFlow({ projectId, onComplete, onCancel }: DatabaseConnectionFlowProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [databaseConfig, setDatabaseConfig] = useState<any>(null);

  const handleBack = () => {
    if (currentStep === 1) {
      onCancel();
      return;
    }

    setCurrentStep((prev) => Math.max(1, prev - 1));
  };

  const handleDatabaseComplete = (dbConfig: any) => {
    setDatabaseConfig(dbConfig);
    setCurrentStep(2);
  };

  const handleDatabaseContextComplete = (contextData: {
    responses: Record<string, string>;
    suggestedDashboards: Array<{
      name: string;
      description: string;
      charts: string[];
    }>;
  }) => {
    // Complete the connection flow
    onComplete({
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
        <div className="flex items-center justify-between mb-4">
          <Button
            variant="outline"
            size="icon"
            onClick={handleBack}
            className="border-border"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            onClick={onCancel}
            className="text-muted-foreground hover:text-foreground"
          >
            Cancel
          </Button>
        </div>
        
        {/* Progress Steps */}
        <div className="mb-8 md:mb-12">
          <div className="flex items-center justify-center gap-2 md:gap-3">
            {[
              { number: 1, label: "Connect Database", icon: Database },
              { number: 2, label: "Understand Data", icon: Sparkles }
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
                  {index < 1 && (
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
              <DatabaseSetupGuided
                projectName="your workspace"
                projectId={projectId}
                onComplete={handleDatabaseComplete}
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
              <DatabaseContextBot
                databaseName={databaseConfig?.connectionName || databaseConfig?.name || "Your Database"}
                onComplete={handleDatabaseContextComplete}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
