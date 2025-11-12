import { Database, Bell, Palette, Globe, Sun, Moon } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import { Badge } from "../components/ui/badge";

interface SettingsViewProps {
  isDark: boolean;
  onThemeChange: (isDark: boolean) => void;
}

export function SettingsView({ isDark, onThemeChange }: SettingsViewProps) {
  return (
    <div className="min-h-full bg-background">
      {/* Header Section */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="px-8 py-8 max-w-5xl mx-auto">
          <h1 className="text-3xl text-foreground mb-2">Settings</h1>
          <p className="text-muted-foreground">Manage your VizAI configuration and preferences</p>
        </div>
      </div>

      <div className="px-8 py-12 max-w-5xl mx-auto space-y-8">
        {/* Organization Settings */}
        <Card className="border border-border overflow-hidden">
          <div className="border-b border-border bg-muted/30 px-6 py-4">
            <h3 className="text-lg text-foreground flex items-center gap-2">
              <Globe className="w-5 h-5" />
              Organization
            </h3>
          </div>
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Company Name</Label>
                <Input defaultValue="Acme Corporation" className="bg-input-background" />
              </div>
              <div className="space-y-2">
                <Label>Website</Label>
                <Input defaultValue="https://acme.com" className="bg-input-background" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Company Description</Label>
              <Input defaultValue="Enterprise analytics platform" className="bg-input-background" />
            </div>
            <div className="pt-4 border-t border-border flex justify-end">
              <Button className="bg-gradient-to-r from-primary to-accent text-white">
                Save Changes
              </Button>
            </div>
          </div>
        </Card>

        {/* Appearance */}
        <Card className="border border-border overflow-hidden">
          <div className="border-b border-border bg-muted/30 px-6 py-4">
            <h3 className="text-lg text-foreground flex items-center gap-2">
              <Palette className="w-5 h-5" />
              Appearance
            </h3>
          </div>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-foreground font-medium">Theme</p>
                <p className="text-sm text-muted-foreground">Choose your preferred color scheme</p>
              </div>
              <div className="flex items-center gap-2 p-1 rounded-lg bg-muted/50 border border-border">
                <button
                  onClick={() => onThemeChange(false)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${
                    !isDark 
                      ? 'bg-card shadow-sm text-foreground' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Sun className="w-4 h-4" />
                  <span className="text-sm">Light</span>
                </button>
                <button
                  onClick={() => onThemeChange(true)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${
                    isDark 
                      ? 'bg-card shadow-sm text-foreground' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Moon className="w-4 h-4" />
                  <span className="text-sm">Dark</span>
                </button>
              </div>
            </div>
          </div>
        </Card>

        {/* Notifications */}
        <Card className="border border-border overflow-hidden">
          <div className="border-b border-border bg-muted/30 px-6 py-4">
            <h3 className="text-lg text-foreground flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Notifications
            </h3>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-foreground font-medium">Email Notifications</p>
                <p className="text-sm text-muted-foreground">Receive updates via email</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-border">
              <div>
                <p className="text-foreground font-medium">Dashboard Updates</p>
                <p className="text-sm text-muted-foreground">Notify when dashboards are modified</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-border">
              <div>
                <p className="text-foreground font-medium">AI Insights</p>
                <p className="text-sm text-muted-foreground">Get notified about new insights</p>
              </div>
              <Switch />
            </div>
          </div>
        </Card>

        {/* System Information */}
        <Card className="border border-border overflow-hidden">
          <div className="border-b border-border bg-muted/30 px-6 py-4">
            <h3 className="text-lg text-foreground flex items-center gap-2">
              <Database className="w-5 h-5" />
              System Information
            </h3>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-6">
              <div className="p-4 rounded-xl bg-muted/30 border border-border">
                <p className="text-sm text-muted-foreground mb-1">Version</p>
                <span className="text-foreground font-medium">v2.4.1</span>
              </div>
              <div className="p-4 rounded-xl bg-muted/30 border border-border">
                <p className="text-sm text-muted-foreground mb-1">Environment</p>
                <Badge variant="outline" className="border-success/20 text-success bg-success/5">Production</Badge>
              </div>
              <div className="p-4 rounded-xl bg-muted/30 border border-border">
                <p className="text-sm text-muted-foreground mb-1">Last Backup</p>
                <span className="text-foreground font-medium">2024-10-18 03:00 UTC</span>
              </div>
              <div className="p-4 rounded-xl bg-muted/30 border border-border">
                <p className="text-sm text-muted-foreground mb-1">Storage Used</p>
                <span className="text-foreground font-medium">2.4 GB / 10 GB</span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
