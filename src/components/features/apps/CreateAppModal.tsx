import { useState } from "react";
import { Globe, Building2, Loader2 } from "lucide-react";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import { toast } from "sonner";
import { createApp } from "../../../services/api";

interface CreateAppModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAppCreated: () => void;
}

/**
 * Validate that a string looks like a valid bare hostname.
 * Strips protocol/www/paths first, then checks the result.
 */
function normalizeDomainInput(raw: string): string {
  let domain = raw.trim().toLowerCase();
  // Strip protocol
  domain = domain.replace(/^https?:\/\//, "");
  // Strip www.
  domain = domain.replace(/^www\./, "");
  // Strip paths/query/fragment
  domain = domain.split("/")[0].split("?")[0].split("#")[0];
  // Strip port
  domain = domain.split(":")[0];
  // Strip trailing dots
  domain = domain.replace(/\.+$/, "");
  return domain;
}

function isValidHostname(hostname: string): boolean {
  if (!hostname || hostname.length < 3) return false;
  const pattern = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
  return pattern.test(hostname);
}

export function CreateAppModal({
  open,
  onOpenChange,
  onAppCreated,
}: CreateAppModalProps) {
  const [companyName, setCompanyName] = useState("");
  const [domainUrl, setDomainUrl] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [domainError, setDomainError] = useState<string | null>(null);

  const handleDomainChange = (value: string) => {
    setDomainUrl(value);
    if (domainError) {
      // Clear error when user types
      const normalized = normalizeDomainInput(value);
      if (isValidHostname(normalized)) {
        setDomainError(null);
      }
    }
  };

  const handleSubmit = async () => {
    // Validate company name
    if (!companyName.trim()) {
      toast.error("Company name is required");
      return;
    }

    // Validate and normalize domain
    const normalized = normalizeDomainInput(domainUrl);
    if (!isValidHostname(normalized)) {
      setDomainError(
        "Please enter a valid domain (e.g. fedex.com). No http://, paths, or trailing slashes."
      );
      return;
    }

    setIsCreating(true);
    console.log(`[APP][STEP 1] User clicked "Create app"`);

    try {
      const response = await createApp(companyName.trim(), normalized);

      if (response.success && response.data) {
        toast.success(`App "${companyName.trim()}" registered for ${normalized}`);
        // Reset form
        setCompanyName("");
        setDomainUrl("");
        setDomainError(null);
        onOpenChange(false);
        onAppCreated();
      } else {
        toast.error(response.error?.message || "Failed to create app");
      }
    } catch (error: any) {
      toast.error(error.message || "An error occurred");
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = (open: boolean) => {
    if (!isCreating) {
      onOpenChange(open);
      if (!open) {
        // Reset form on close
        setCompanyName("");
        setDomainUrl("");
        setDomainError(null);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            Create App
          </DialogTitle>
          <DialogDescription>
            Register an external application that will embed your dashboards.
            The domain URL determines which origins can load embedded content.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Company Name */}
          <div className="space-y-2">
            <Label htmlFor="company-name" className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              Company Name
            </Label>
            <Input
              id="company-name"
              placeholder="e.g. FedEx, DHL, Acme Corp"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              disabled={isCreating}
              autoFocus
            />
          </div>

          {/* Domain URL */}
          <div className="space-y-2">
            <Label htmlFor="domain-url" className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-muted-foreground" />
              Domain URL
            </Label>
            <Input
              id="domain-url"
              placeholder="e.g. fedex.com"
              value={domainUrl}
              onChange={(e) => handleDomainChange(e.target.value)}
              disabled={isCreating}
              className={domainError ? "border-destructive" : ""}
            />
            {domainError ? (
              <p className="text-xs text-destructive">{domainError}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Enter the bare hostname where the dashboard will be embedded.
                Protocol and paths will be stripped automatically.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button
            id="submit-create-app-btn"
            onClick={handleSubmit}
            disabled={isCreating || !companyName.trim() || !domainUrl.trim()}
          >
            {isCreating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Globe className="w-4 h-4 mr-2" />
                Create App
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
