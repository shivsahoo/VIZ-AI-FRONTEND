import { useState, useEffect } from "react";
import { Loader2, Link2, Copy, Check } from "lucide-react";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "../../ui/dialog";
import { toast } from "sonner";
import { registerApp, getUserDashboardCharts } from "../../../services/api";

interface AddProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface DashboardOption {
    id: string;
    name: string;
}

export function AddProjectModal({ isOpen, onClose }: AddProjectModalProps) {
    const [domain, setDomain] = useState("");
    const [selectedDashboardId, setSelectedDashboardId] = useState("");
    const [dashboards, setDashboards] = useState<DashboardOption[]>([]);
    const [isLoadingDashboards, setIsLoadingDashboards] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Results
    const [credentials, setCredentials] = useState<{ clientId: string; clientSecret: string } | null>(null);
    const [copiedId, setCopiedId] = useState(false);
    const [copiedSecret, setCopiedSecret] = useState(false);

    useEffect(() => {
        if (isOpen) {
            // Reset state
            setDomain("");
            setSelectedDashboardId("");
            setCredentials(null);
            setCopiedId(false);
            setCopiedSecret(false);

            // Fetch dashboards
            fetchDashboards();
        }
    }, [isOpen]);

    const fetchDashboards = async () => {
        setIsLoadingDashboards(true);
        try {
            const res = await getUserDashboardCharts();
            if (res.success && res.data) {
                // Map dashboards to options
                const options: DashboardOption[] = res.data.map((d: any) => ({
                    id: d.dashboardId,
                    name: d.dashboardTitle
                }));
                setDashboards(options);
                if (options.length > 0) {
                    setSelectedDashboardId(options[0].id);
                }
            } else {
                toast.error(res.error?.message || "Failed to load dashboards");
            }
        } catch (err: any) {
            toast.error(err.message || "Error loading dashboards");
        } finally {
            setIsLoadingDashboards(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!domain.trim() || !selectedDashboardId) {
            toast.error("Please fill in all required fields.");
            return;
        }

        // Basic domain validation
        let formattedDomain = domain.trim();
        if (!/^https?:\/\//i.test(formattedDomain)) {
            formattedDomain = `https://${formattedDomain}`;
        }

        setIsSubmitting(true);
        try {
            const res = await registerApp({
                domain: formattedDomain,
                dashboard_id: selectedDashboardId
            });

            if (res.success && res.data) {
                setCredentials({
                    clientId: res.data.client_id,
                    clientSecret: res.data.client_secret
                });
                toast.success("Application registered successfully!");
            } else {
                toast.error(res.error?.message || "Failed to register application.");
            }
        } catch (err: any) {
            toast.error(err.message || "An error occurred during registration.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const copyToClipboard = async (text: string, type: 'id' | 'secret') => {
        try {
            await navigator.clipboard.writeText(text);
            if (type === 'id') {
                setCopiedId(true);
                setTimeout(() => setCopiedId(false), 2000);
            } else {
                setCopiedSecret(true);
                setTimeout(() => setCopiedSecret(false), 2000);
            }
            toast.success("Copied to clipboard!");
        } catch (err) {
            toast.error("Failed to copy");
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open: boolean) => !open && !isSubmitting && onClose()}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{credentials ? "Registration Successful" : "Add Project (Register App)"}</DialogTitle>
                    <DialogDescription>
                        {credentials
                            ? "Please save your Client ID and Client Secret in a secure location. You will not be able to see the secret again."
                            : "Register your application domain and link it to a dashboard to generate SDK credentials."}
                    </DialogDescription>
                </DialogHeader>

                {!credentials ? (
                    <form onSubmit={handleSubmit} className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label htmlFor="domain" className="text-sm font-medium">
                                Domain Name
                            </label>
                            <Input
                                id="domain"
                                placeholder="e.g. example.com or http://localhost:3000"
                                value={domain}
                                onChange={(e) => setDomain(e.target.value)}
                                disabled={isSubmitting}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="dashboard" className="text-sm font-medium">
                                Link Dashboard
                            </label>
                            {isLoadingDashboards ? (
                                <div className="flex items-center space-x-2 text-sm text-muted-foreground p-2 border rounded-md">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span>Loading dashboards...</span>
                                </div>
                            ) : dashboards.length === 0 ? (
                                <div className="text-sm text-amber-500 p-2 border border-amber-500/20 rounded-md bg-amber-500/10">
                                    No dashboards found. Please create a dashboard first.
                                </div>
                            ) : (
                                <select
                                    id="dashboard"
                                    value={selectedDashboardId}
                                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedDashboardId(e.target.value)}
                                    disabled={isSubmitting}
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    required
                                >
                                    <option value="" disabled>Select a dashboard</option>
                                    {dashboards.map((d) => (
                                        <option key={d.id} value={d.id}>
                                            {d.name}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>

                        <DialogFooter className="pt-4">
                            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSubmitting || isLoadingDashboards || dashboards.length === 0}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Generate Credentials
                            </Button>
                        </DialogFooter>
                    </form>
                ) : (
                    <div className="space-y-6 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">Client ID</label>
                            <div className="flex items-center mt-1">
                                <code className="flex-1 p-2 rounded-l-md bg-muted border border-r-0 text-sm break-all">
                                    {credentials.clientId}
                                </code>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="rounded-l-none h-auto py-2"
                                    onClick={() => copyToClipboard(credentials.clientId, 'id')}
                                >
                                    {copiedId ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">Client Secret</label>
                            <div className="flex items-center mt-1">
                                <code className="flex-1 p-2 rounded-l-md bg-muted border border-r-0 text-sm break-all font-mono text-amber-600 dark:text-amber-400">
                                    {credentials.clientSecret}
                                </code>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="rounded-l-none h-auto py-2"
                                    onClick={() => copyToClipboard(credentials.clientSecret, 'secret')}
                                >
                                    {copiedSecret ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                                </Button>
                            </div>
                        </div>

                        <div className="p-3 text-sm text-blue-600 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-md flex items-start gap-2">
                            <Link2 className="w-4 h-4 mt-0.5 shrink-0" />
                            <p>Use these credentials to authenticate your SDK. Make sure to keep the secret safe!</p>
                        </div>

                        <DialogFooter>
                            <Button onClick={onClose} className="w-full">
                                Done
                            </Button>
                        </DialogFooter>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
