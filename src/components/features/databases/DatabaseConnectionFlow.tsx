/**
 * DatabaseConnectionFlow Component
 *
 * A single-step wizard for adding database connections:
 *
 * Step 1: Database Connection Setup
 *   - Form-based or connection string method
 *   - Validates and tests the connection
 *   - On success, immediately redirects to charts page (no conversation step)
 */

import { motion, AnimatePresence } from "motion/react";
import { Database, ArrowLeft } from "lucide-react";
import { DatabaseSetupGuided } from "./DatabaseSetupGuided.tsx";

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
  const handleBack = () => {
    onCancel();
  };

  // When the DB connection succeeds, skip the conversation step and complete immediately.
  const handleDatabaseComplete = (dbConfig: any) => {
    onComplete({
      database: dbConfig,
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

      <div className="w-full max-w-5xl relative z-10">
        {/* Back & Cancel Actions */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={handleBack}
            className="inline-flex items-center justify-center rounded-md border border-border bg-transparent px-3 py-2 text-sm hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button
            onClick={onCancel}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
        </div>

        {/* Progress Step */}
        <div className="mb-8 md:mb-12">
          <div className="flex items-center justify-center gap-2 md:gap-3">
            <div className="flex flex-col items-center gap-1 md:gap-2">
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center bg-gradient-to-r from-primary to-accent text-white shadow-lg">
                <Database className="w-4 h-4 md:w-5 md:h-5" />
              </div>
              <p className="text-xs text-foreground hidden md:block">Connect Datasource</p>
            </div>
          </div>
        </div>

        {/* Step Content */}
        <AnimatePresence mode="wait">
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
        </AnimatePresence>
      </div>
    </div>
  );
}
