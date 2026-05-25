import { useState, useEffect, useCallback } from "react";
import { Link2, Copy, Check, Trash2, Loader2, ExternalLink, Code } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../ui/alert-dialog";
import { toast } from "sonner";
import {
  createShareToken,
  getShareToken,
  revokeShareToken,
  type ShareTokenDetail,
} from "../../../services/api";

interface ShareLinkModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dashboardId: string;
  dashboardName: string;
}

export function ShareLinkModal({
  open,
  onOpenChange,
  dashboardId,
  dashboardName,
}: ShareLinkModalProps) {
  const [token, setToken] = useState<ShareTokenDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [expiryDays, setExpiryDays] = useState<string>("none");
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);

  // Load existing token when modal opens
  const loadExistingToken = useCallback(async () => {
    if (!dashboardId) return;

    setIsLoading(true);
    try {
      const response = await getShareToken(dashboardId);
      if (response.success && response.data) {
        setToken(response.data);
      } else {
        setToken(null);
      }
    } catch (error) {
      console.error("Failed to load share token:", error);
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  }, [dashboardId]);

  useEffect(() => {
    if (open) {
      loadExistingToken();
    } else {
      // Reset state when modal closes
      setCopiedUrl(false);
      setCopiedSnippet(false);
    }
  }, [open, loadExistingToken]);

  const handleCreateToken = async () => {
    setIsCreating(true);
    try {
      const expiry = expiryDays === "none" ? null : parseInt(expiryDays, 10);
      const response = await createShareToken(dashboardId, expiry);

      if (response.success && response.data) {
        setToken(response.data);
        toast.success("Shareable link created successfully!");
        // [STEP 4] Log
        console.log(
          `[EMBED][STEP 4] Share token created for dashboard ${dashboardId}`
        );
      } else {
        toast.error(
          response.error?.message || "Failed to create shareable link"
        );
      }
    } catch (error: any) {
      toast.error(error.message || "An error occurred");
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevokeToken = async () => {
    setIsRevoking(true);
    try {
      const response = await revokeShareToken(dashboardId);
      if (response.success) {
        setToken(null);
        setShowRevokeConfirm(false);
        toast.success("Share link revoked successfully");
      } else {
        toast.error(response.error?.message || "Failed to revoke share link");
      }
    } catch (error: any) {
      toast.error(error.message || "An error occurred");
    } finally {
      setIsRevoking(false);
    }
  };

  const handleCopyUrl = async () => {
    if (!token?.embed_url) return;
    try {
      await navigator.clipboard.writeText(token.embed_url);
      setCopiedUrl(true);
      toast.success("Embed URL copied to clipboard");
      // [STEP 4] User copied snippet to clipboard
      console.log("[EMBED][STEP 4] User copied embed URL to clipboard");
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  const handleCopySnippet = async () => {
    if (!token?.iframe_snippet) return;
    try {
      await navigator.clipboard.writeText(token.iframe_snippet);
      setCopiedSnippet(true);
      toast.success("Iframe snippet copied to clipboard");
      // [STEP 4] User copied snippet to clipboard
      console.log("[EMBED][STEP 4] User copied iframe snippet to clipboard");
      setTimeout(() => setCopiedSnippet(false), 2000);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="w-5 h-5 text-primary" />
              Share Dashboard
            </DialogTitle>
            <DialogDescription>
              Create a shareable embed link for &ldquo;{dashboardName}&rdquo;.
              Anyone with the link can view this dashboard without logging in.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-5">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                <span className="ml-3 text-muted-foreground">
                  Checking for existing share link...
                </span>
              </div>
            ) : token ? (
              /* ── Active Token View ──────────────────────────── */
              <>
                {/* Status Badge */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className="border-success/30 text-success bg-success/10"
                    >
                      ● Active
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Created {formatDate(token.created_at)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{token.access_count} views</span>
                    {token.expires_at && (
                      <span>
                        · Expires {formatDate(token.expires_at)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Embed URL */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground flex items-center gap-2">
                    <ExternalLink className="w-4 h-4" />
                    Embed URL
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-muted/50 border border-border rounded-lg px-3 py-2.5 font-mono text-xs text-foreground break-all select-all">
                      {token.embed_url}
                    </div>
                    <Button
                      id="copy-embed-url-btn"
                      variant="outline"
                      size="icon"
                      onClick={handleCopyUrl}
                      className="shrink-0 h-10 w-10"
                    >
                      {copiedUrl ? (
                        <Check className="w-4 h-4 text-success" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Iframe Snippet */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Code className="w-4 h-4" />
                    Iframe Snippet
                  </label>
                  <div className="flex items-start gap-2">
                    <div className="flex-1 bg-muted/50 border border-border rounded-lg px-3 py-2.5 font-mono text-xs text-foreground break-all select-all whitespace-pre-wrap">
                      {token.iframe_snippet}
                    </div>
                    <Button
                      id="copy-iframe-snippet-btn"
                      variant="outline"
                      size="icon"
                      onClick={handleCopySnippet}
                      className="shrink-0 h-10 w-10 mt-0"
                    >
                      {copiedSnippet ? (
                        <Check className="w-4 h-4 text-success" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Paste this code into any HTML page, CMS, or app to embed
                    the dashboard.
                  </p>
                </div>

                {/* Revoke Button */}
                <div className="pt-2 border-t border-border">
                  <Button
                    id="revoke-share-link-btn"
                    variant="outline"
                    onClick={() => setShowRevokeConfirm(true)}
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Revoke Link
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">
                    Revoking will immediately disable this embed link wherever
                    it&apos;s used.
                  </p>
                </div>
              </>
            ) : (
              /* ── No Token — Create View ─────────────────────── */
              <>
                <div className="bg-muted/30 border border-border rounded-xl p-6 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Link2 className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="text-foreground font-medium mb-1">
                    No active share link
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                    Generate a secure link to embed this dashboard in any
                    external page or application.
                  </p>
                </div>

                {/* Expiry Selector */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Link Expiry
                  </label>
                  <Select value={expiryDays} onValueChange={setExpiryDays}>
                    <SelectTrigger id="expiry-selector" className="w-full">
                      <SelectValue placeholder="Select expiry" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No expiry</SelectItem>
                      <SelectItem value="7">7 days</SelectItem>
                      <SelectItem value="30">30 days</SelectItem>
                      <SelectItem value="90">90 days</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {expiryDays === "none"
                      ? "The link will remain active until manually revoked."
                      : `The link will automatically expire after ${expiryDays} days.`}
                  </p>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {token ? "Done" : "Cancel"}
            </Button>
            {!token && !isLoading && (
              <Button
                id="generate-share-link-btn"
                onClick={handleCreateToken}
                disabled={isCreating}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Link2 className="w-4 h-4 mr-2" />
                    Generate Link
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Confirmation Dialog */}
      <AlertDialog open={showRevokeConfirm} onOpenChange={setShowRevokeConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Share Link</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately invalidate the embed link. Anyone viewing
              the embedded dashboard will see an &ldquo;expired&rdquo; message.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRevoking}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevokeToken}
              disabled={isRevoking}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRevoking ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Revoking...
                </>
              ) : (
                "Revoke Link"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
