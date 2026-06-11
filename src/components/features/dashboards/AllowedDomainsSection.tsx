import { useState, useEffect, useCallback } from "react";
import { Globe, Plus, X, Loader2, Check, ChevronDown } from "lucide-react";
import { Button } from "../../ui/button";
import { Badge } from "../../ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import { toast } from "sonner";
import {
  listApps,
  getAllowedDomains,
  setAllowedDomains,
  removeAllowedDomain,
  type AppDetail,
  type AllowedDomainDetail,
} from "../../../services/api";

interface AllowedDomainsSectionProps {
  dashboardId: string;
  onDomainsChanged: (count: number) => void;
}

export function AllowedDomainsSection({
  dashboardId,
  onDomainsChanged,
}: AllowedDomainsSectionProps) {
  const [allowedDomains, setAllowedDomainsState] = useState<AllowedDomainDetail[]>([]);
  const [allApps, setAllApps] = useState<AppDetail[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [selectedAppIds, setSelectedAppIds] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  // Load allowed domains on mount
  const loadAllowedDomains = useCallback(async () => {
    if (!dashboardId) return;
    setIsLoading(true);
    try {
      const response = await getAllowedDomains(dashboardId);
      if (response.success && response.data) {
        setAllowedDomainsState(response.data);
        onDomainsChanged(response.data.length);
      }
    } catch (error) {
      console.error("Failed to load allowed domains:", error);
    } finally {
      setIsLoading(false);
    }
  }, [dashboardId, onDomainsChanged]);

  useEffect(() => {
    loadAllowedDomains();
  }, [loadAllowedDomains]);

  // Load apps when picker opens
  const handleOpenPicker = async () => {
    setShowPicker(true);
    try {
      const response = await listApps();
      if (response.success && response.data) {
        setAllApps(response.data);
        // Pre-select currently attached domains
        const currentIds = new Set(allowedDomains.map((d) => d.app_id));
        setSelectedAppIds(currentIds);
      }
    } catch (error) {
      console.error("Failed to load apps:", error);
      toast.error("Failed to load registered apps");
    }
  };

  const toggleApp = (appId: string) => {
    setSelectedAppIds((prev) => {
      const next = new Set(prev);
      if (next.has(appId)) {
        next.delete(appId);
      } else {
        next.add(appId);
      }
      return next;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await setAllowedDomains(
        dashboardId,
        Array.from(selectedAppIds)
      );
      if (response.success && response.data) {
        setAllowedDomainsState(response.data);
        onDomainsChanged(response.data.length);
        setShowPicker(false);
        toast.success(`${response.data.length} allowed domain(s) saved`);
        console.log(
          `[EMBED][STEP 5] Allowed domains set for dashboard ${dashboardId} — domains: ${response.data.map((d) => d.domain_url).join(", ")}`
        );
      } else {
        toast.error(response.error?.message || "Failed to save allowed domains");
      }
    } catch (error: any) {
      toast.error(error.message || "An error occurred");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveDomain = async (appId: string) => {
    try {
      const response = await removeAllowedDomain(dashboardId, appId);
      if (response.success) {
        const updated = allowedDomains.filter((d) => d.app_id !== appId);
        setAllowedDomainsState(updated);
        onDomainsChanged(updated.length);
        toast.success("Domain removed");
      } else {
        toast.error(response.error?.message || "Failed to remove domain");
      }
    } catch (error: any) {
      toast.error(error.message || "An error occurred");
    }
  };

  return (
    <>
      {/* Inline domain badges + add button */}
      <div className="flex items-center gap-2 flex-wrap">
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        ) : allowedDomains.length > 0 ? (
          allowedDomains.map((domain) => (
            <Badge
              key={domain.app_id}
              variant="secondary"
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs"
            >
              <Globe className="w-3 h-3" />
              {domain.domain_url}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveDomain(domain.app_id);
                }}
                className="ml-0.5 hover:text-destructive transition-colors"
                title="Remove domain"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))
        ) : (
          <span className="text-xs text-muted-foreground">
            No allowed domains
          </span>
        )}
        <Button
          id="add-allowed-domains-btn"
          variant="outline"
          size="sm"
          onClick={handleOpenPicker}
          className="h-7 text-xs gap-1"
        >
          <Plus className="w-3 h-3" />
          {allowedDomains.length > 0 ? "Edit" : "Add domains"}
        </Button>
      </div>

      {/* Domain picker dialog */}
      <Dialog open={showPicker} onOpenChange={setShowPicker}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-primary" />
              Allowed Domains
            </DialogTitle>
            <DialogDescription>
              Select which registered apps can embed this dashboard.
              Only iframes loaded from these domains will be served.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {allApps.length === 0 ? (
              <div className="text-center py-8">
                <Globe className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-1">
                  No registered apps yet
                </p>
                <p className="text-xs text-muted-foreground">
                  Create an app from the home page first, then come back to
                  attach its domain to this dashboard.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {allApps.map((app) => {
                  const isSelected = selectedAppIds.has(app.app_id);
                  return (
                    <button
                      key={app.app_id}
                      onClick={() => toggleApp(app.app_id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/30 hover:bg-muted/50"
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${
                          isSelected
                            ? "bg-primary border-primary"
                            : "border-border"
                        }`}
                      >
                        {isSelected && (
                          <Check className="w-3 h-3 text-primary-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {app.company_name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {app.domain_url}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPicker(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            {allApps.length > 0 && (
              <Button
                id="save-allowed-domains-btn"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    Save ({selectedAppIds.size} selected)
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
