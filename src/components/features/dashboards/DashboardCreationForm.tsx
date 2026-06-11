import { useState } from "react";
import { motion } from "motion/react";
import { LayoutDashboard, Loader2 } from "lucide-react";
import { Button } from "../../ui/button";
import { Card } from "../../ui/card";
import { Input } from "../../ui/input";
import { Textarea } from "../../ui/textarea";
import { Label } from "../../ui/label";
import { toast } from "sonner";
import { cn } from "../../ui/utils";
import { createDashboard } from "../../../services/api";

const getErrorMessage = (error: any): string => {
  if (!error) return "Something went wrong";
  if (typeof error === "string") return error;
  if (error instanceof Error && typeof error.message === "string") return error.message;
  if (typeof error?.message === "string") return error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return "Something went wrong";
  }
};

interface DashboardCreationFormProps {
  projectId: string;
  onComplete: (data: { name: string; description: string; dashboardId: string }) => void;
  onCancel?: () => void;
}

export function DashboardCreationForm({
  projectId,
  onComplete,
  onCancel,
}: DashboardCreationFormProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; description?: string }>({});

  const validateForm = (): boolean => {
    const newErrors: { name?: string; description?: string } = {};

    if (!name.trim()) newErrors.name = "Dashboard name is required";
    else if (name.trim().length < 2)
      newErrors.name = "Dashboard name must be at least 2 characters";

    if (!description.trim()) newErrors.description = "Dashboard description is required";
    else if (description.trim().length < 10)
      newErrors.description = "Description should be at least 10 characters";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreating) return;
    if (!validateForm()) return;

    setIsCreating(true);
    try {
      const response = await createDashboard(projectId, {
        name: name.trim(),
        description: description.trim(),
      });

      if (!response.success || !response.data?.id) {
        throw new Error(response.error?.message || "Failed to create dashboard");
      }

      toast.success("Dashboard created successfully!");
      onComplete({
        name: name.trim(),
        description: description.trim(),
        dashboardId: String(response.data.id),
      });
    } catch (error: any) {
      console.error("Failed to create dashboard:", error);
      toast.error(getErrorMessage(error) || "Failed to create dashboard. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Card className="border border-border shadow-xl overflow-hidden">
      <div className="flex flex-col w-full">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border bg-gradient-to-r from-primary/5 to-accent/5">
          <div className="flex items-center gap-3 w-full">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg flex-shrink-0">
              <LayoutDashboard className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-foreground font-semibold">Create New Dashboard</h3>
              <p className="text-xs text-muted-foreground">
                Add a name and description to get started
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
        <div className="px-6 py-8">
          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            onSubmit={handleSubmit}
            className="space-y-6"
          >
            {/* Dashboard Name */}
            <div className="space-y-2.5 mt-4">
              <Label htmlFor="dashboardName" className="text-sm font-semibold text-foreground">
                Dashboard Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="dashboardName"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
                }}
                placeholder="e.g., Executive Overview"
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
                Keep it short and easy to recognize
              </p>
            </div>

            {/* Dashboard Description */}
            <div className="space-y-2.5">
              <Label htmlFor="dashboardDescription" className="text-sm font-semibold text-foreground">
                Dashboard Description <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="dashboardDescription"
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  if (errors.description)
                    setErrors((prev) => ({ ...prev, description: undefined }));
                }}
                placeholder="e.g., A high-level view of revenue, growth, and retention across regions..."
                className={cn(
                  "w-full min-h-[140px] resize-none border-2 transition-all duration-200",
                  errors.description
                    ? "border-destructive focus:border-destructive focus:ring-destructive/20"
                    : "border-border hover:border-primary/50 focus:border-purple-400/60 focus:ring-purple-400/20",
                  "bg-background shadow-sm hover:shadow-md focus:shadow-lg",
                  "outline-none focus:outline-none focus-visible:outline-none",
                  "ring-0 focus:ring-2 focus:ring-purple-400/20"
                )}
                disabled={isCreating}
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
                  Describe the purpose and scope of the dashboard
                </p>
                <p
                  className={cn(
                    "text-xs font-medium transition-colors",
                    description.length > 1980
                      ? "text-destructive"
                      : description.length > 1900
                        ? "text-orange-500 dark:text-orange-400"
                        : "text-muted-foreground"
                  )}
                >
                  {description.length}/2000
                </p>
              </div>
            </div>

            {/* Submit */}
            <div className="pt-2 flex items-center justify-end gap-3">
              <Button
                type="submit"
                disabled={isCreating}
                className={cn(
                  "h-11 px-6 font-semibold",
                  "bg-gradient-to-r from-primary to-accent text-white",
                  "shadow-lg hover:shadow-xl transition-all duration-300"
                )}
              >
                {isCreating ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </span>
                ) : (
                  "Create Dashboard"
                )}
              </Button>
            </div>
          </motion.form>
        </div>
      </div>
    </Card>
  );
}

