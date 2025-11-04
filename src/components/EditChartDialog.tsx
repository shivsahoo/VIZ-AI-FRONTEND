import { useState } from "react";
import { Wand2, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Badge } from "./ui/badge";
import { toast } from "sonner@2.0.3";

interface EditChartDialogProps {
  isOpen: boolean;
  onClose: () => void;
  chartName: string;
  chartType: 'line' | 'bar' | 'pie' | 'area';
  onSave: (updatedChart: {
    name: string;
    type: 'line' | 'bar' | 'pie' | 'area';
    query: string;
    description: string;
  }) => void;
}

export function EditChartDialog({ isOpen, onClose, chartName, chartType, onSave }: EditChartDialogProps) {
  const [editPrompt, setEditPrompt] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = () => {
    if (!editPrompt.trim()) {
      toast.error("Please describe your changes");
      return;
    }

    setIsProcessing(true);

    // Simulate AI processing
    setTimeout(() => {
      // Mock updated chart based on prompt
      const updatedChart = {
        name: chartName,
        type: chartType,
        query: "SELECT updated_column, SUM(value) FROM table WHERE condition GROUP BY updated_column",
        description: `Updated based on: "${editPrompt}"`
      };

      onSave(updatedChart);
      toast.success("Chart updated successfully!");
      setIsProcessing(false);
      setEditPrompt("");
      onClose();
    }, 1500);
  };

  const handleClose = () => {
    setEditPrompt("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <DialogTitle>Edit Chart with AI</DialogTitle>
            <Badge variant="outline" className="capitalize">
              {chartType} Chart
            </Badge>
          </div>
          <DialogDescription>
            Describe how you want to modify "{chartName}" using natural language
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Edit Prompt Input */}
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">
              What would you like to change?
            </label>
            <Textarea
              placeholder="E.g., 'Change the time range to last 12 months' or 'Add a comparison with last year' or 'Show only data from North America region'"
              value={editPrompt}
              onChange={(e) => setEditPrompt(e.target.value)}
              className="min-h-[120px] resize-none"
              disabled={isProcessing}
            />
          </div>

          {/* Example Prompts */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Example prompts:</p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-auto py-1.5 px-3"
                onClick={() => setEditPrompt("Change the date range to last 6 months")}
                disabled={isProcessing}
              >
                Change date range to 6 months
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-auto py-1.5 px-3"
                onClick={() => setEditPrompt("Add a breakdown by product category")}
                disabled={isProcessing}
              >
                Add category breakdown
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-auto py-1.5 px-3"
                onClick={() => setEditPrompt("Filter to show only premium customers")}
                disabled={isProcessing}
              >
                Filter premium customers
              </Button>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isProcessing || !editPrompt.trim()}
            className="bg-gradient-to-r from-primary to-accent text-white gap-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                Apply Changes
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
