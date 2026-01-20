import { useState } from "react";
import { motion } from "motion/react";
import { Sparkles, Loader2, Wand2 } from "lucide-react";
import { Button } from "../../ui/button";
import { Card } from "../../ui/card";
import { Input } from "../../ui/input";
import { Textarea } from "../../ui/textarea";
import { Label } from "../../ui/label";
import { createProject } from "../../../services/api";
import { toast } from "sonner";
import { cn } from "../../ui/utils";

interface ProjectCreationFormProps {
  onComplete: (data: {
    name: string;
    description: string;
    projectId: string;
  }) => void;
  onCancel?: () => void;
}

// Get LLM service URL
const getLLMServiceUrl = (): string => {
  const env = typeof import.meta !== 'undefined' ? import.meta.env : undefined;
  
  // Priority 1: Use dedicated LLM service URL if set
  if (env?.VITE_LLM_SERVICE_URL) {
    return env.VITE_LLM_SERVICE_URL.replace(/\/$/, ''); // Remove trailing slash
  }
  
  // Priority 2: Convert WebSocket URL to HTTP if available
  if (env?.VITE_WEBSOCKET_URL) {
    const baseUrl = env.VITE_WEBSOCKET_URL;
    // Convert to HTTP if it's WebSocket URL
    return baseUrl.replace('wss://', 'https://').replace('ws://', 'http://').replace(/\/$/, '');
  }
  
  // Priority 3: Default to localhost for local development
  return 'http://localhost:8001';
};

export function ProjectCreationForm({ onComplete, onCancel }: ProjectCreationFormProps) {
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; description?: string }>({});

  const validateForm = (): boolean => {
    const newErrors: { name?: string; description?: string } = {};
    
    if (!projectName.trim()) {
      newErrors.name = "Project name is required";
    } else if (projectName.trim().length < 3) {
      newErrors.name = "Project name must be at least 3 characters";
    } else if (projectName.trim().length > 100) {
      newErrors.name = "Project name must be less than 100 characters";
    }

    if (!projectDescription.trim()) {
      newErrors.description = "Project description is required";
    } else if (projectDescription.trim().length < 10) {
      newErrors.description = "Project description must be at least 10 characters";
    } else if (projectDescription.trim().length > 2000) {
      newErrors.description = "Description must be less than 2000 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsCreating(true);

    try {
      const response = await createProject({
        name: projectName.trim(),
        description: projectDescription.trim(),
      });

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || "Failed to create project");
      }

      const projectId = response.data.id;
      
      toast.success("Product created successfully! 🎉");
      
      onComplete({
        name: projectName.trim(),
        description: projectDescription.trim(),
        projectId,
      });
    } catch (error: any) {
      console.error("Failed to create project:", error);
      toast.error(error.message || "Failed to create project. Please try again.");
      setIsCreating(false);
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProjectName(e.target.value);
    if (errors.name) {
      setErrors({ ...errors, name: undefined });
    }
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setProjectDescription(e.target.value);
    if (errors.description) {
      setErrors({ ...errors, description: undefined });
    }
  };

  const handleEnhanceWithAI = async () => {
    if (!projectDescription.trim()) {
      toast.error("Please enter a description first");
      return;
    }

    if (projectDescription.trim().length < 10) {
      toast.error("Description must be at least 10 characters to enhance");
      return;
    }

    setIsEnhancing(true);

    try {
      const llmServiceUrl = getLLMServiceUrl();
      const response = await fetch(`http://170.187.237.181:8001/api/v1/enhance-text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: projectDescription.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Failed to enhance text' }));
        throw new Error(errorData.detail || 'Failed to enhance text');
      }

      const data = await response.json();
      
      if (data.enhanced_text) {
        // Truncate to 2000 characters if needed
        const enhanced = data.enhanced_text.slice(0, 2000);
        setProjectDescription(enhanced);
        toast.success("Description enhanced successfully! ✨");
      } else {
        throw new Error("No enhanced text received");
      }
    } catch (error: any) {
      console.error("Failed to enhance description:", error);
      toast.error(error.message || "Failed to enhance description. Please try again.");
    } finally {
      setIsEnhancing(false);
    }
  };

  return (
    <Card className="border border-border shadow-xl overflow-hidden">
      <div className="flex flex-col h-[600px]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border bg-gradient-to-r from-primary/5 to-accent/5">
          <div className="flex items-center gap-3 w-full">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg flex-shrink-0">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-foreground font-semibold">Create New Product</h3>
              <p className="text-xs text-muted-foreground">
                Set up your analytics product in seconds
              </p>
            </div>
            {onCancel && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onCancel}
                className="text-muted-foreground hover:text-foreground"
                disabled={isCreating}
              >
                Cancel
              </Button>
            )}
          </div>
        </div>

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto px-6 py-8">
          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            onSubmit={handleSubmit}
            className="space-y-6"
          >
            {/* Project Name Field */}
            <div className="space-y-2.5 mt-4">
              <Label htmlFor="projectName" className="text-sm font-semibold text-foreground">
                Product Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="projectName"
                type="text"
                value={projectName}
                onChange={handleNameChange}
                placeholder="e.g., Sales Analytics Dashboard"
                className={cn(
                  "w-full h-11 border-2 transition-all duration-200",
                  errors.name 
                    ? "border-destructive focus:border-destructive focus:ring-destructive/20" 
                    : "border-border hover:border-primary/50 focus:border-purple-400/60 focus:ring-purple-400/20",
                  "bg-background shadow-sm hover:shadow-md focus:shadow-lg",
                  "outline-none focus:outline-none focus-visible:outline-none",
                  "ring-0 focus:ring-2 focus:ring-purple-400/20"
                )}
                disabled={isCreating}
                autoFocus
                maxLength={100}
              />
              {errors.name && (
                <motion.p 
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs text-destructive font-medium flex items-center gap-1"
                >
                  <span>⚠</span> {errors.name}
                </motion.p>
              )}
              <p className="text-xs text-muted-foreground leading-relaxed">
                Give your product a clear, descriptive name
              </p>
            </div>

            {/* Project Description Field */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="projectDescription" className="text-sm font-semibold text-foreground">
                  Product Description <span className="text-destructive">*</span>
                </Label>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleEnhanceWithAI}
                  disabled={isEnhancing || isCreating || !projectDescription.trim() || projectDescription.trim().length < 10}
                  style={{
                    background: 'linear-gradient(to right, rgb(236, 72, 153), rgb(168, 85, 247), rgb(59, 130, 246))',
                  }}
                  className={cn(
                    "h-9 px-4 text-xs gap-2 font-semibold relative",
                    "text-white",
                    "border-0",
                    "rounded-full",
                    "shadow-lg shadow-pink-500/30",
                    "hover:shadow-xl hover:shadow-pink-500/40 hover:brightness-110",
                    "active:shadow-md active:brightness-95",
                    "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg disabled:hover:brightness-100",
                    "transition-all duration-300 ease-in-out",
                    "outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/50"
                  )}
                >
                  {isEnhancing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                      <span className="text-white">Enhancing...</span>
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-3.5 h-3.5 text-white" />
                      <span className="text-white">Enhance with AI</span>
                    </>
                  )}
                </Button>
              </div>
              <Textarea
                id="projectDescription"
                value={projectDescription}
                onChange={handleDescriptionChange}
                placeholder="e.g., A comprehensive analytics product to track sales performance, revenue trends, and customer insights across all regions..."
                className={cn(
                  "w-full min-h-[140px] resize-none border-2 transition-all duration-200",
                  errors.description 
                    ? "border-destructive focus:border-destructive focus:ring-destructive/20" 
                    : "border-border hover:border-primary/50 focus:border-purple-400/60 focus:ring-purple-400/20",
                  "bg-background shadow-sm hover:shadow-md focus:shadow-lg",
                  "outline-none focus:outline-none focus-visible:outline-none",
                  "ring-0 focus:ring-2 focus:ring-purple-400/20"
                )}
                disabled={isCreating || isEnhancing}
                maxLength={2000}
              />
              {errors.description && (
                <motion.p 
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs text-destructive font-medium flex items-center gap-1"
                >
                  <span>⚠</span> {errors.description}
                </motion.p>
              )}
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Describe what this product is about
                </p>
                <p className={cn(
                  "text-xs font-medium transition-colors",
                  projectDescription.length > 1980 
                    ? "text-destructive" 
                    : projectDescription.length > 1900 
                    ? "text-orange-500 dark:text-orange-400" 
                    : "text-muted-foreground"
                )}>
                  {projectDescription.length}/2000
                </p>
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-gradient-to-br from-primary/5 via-accent/5 to-primary/5 border-2 border-primary/20 rounded-xl p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0 shadow-md">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div className="space-y-1.5 flex-1">
                  <p className="text-sm font-semibold text-foreground">What's Next?</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    After creating your product, you'll connect your database to start analyzing data and generating KPIs.
                  </p>
                </div>
              </div>
            </div>
          </motion.form>
        </div>

        {/* Footer with Submit Button */}
        <div className="px-6 py-4 border-t border-border bg-card">
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isCreating || !projectName.trim() || !projectDescription.trim()}
            className="w-full h-12 bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
          >
            {isCreating ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Creating Project...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 mr-2" />
                Create Product & Continue
              </>
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
}

