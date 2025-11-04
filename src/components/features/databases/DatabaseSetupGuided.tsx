import { useState } from "react";
import { Database, ArrowRight, Check, Sparkles, Loader2 } from "lucide-react";
import { Button } from "../../ui/button";
import { Card } from "../../ui/card";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { Checkbox } from "../../ui/checkbox";
import { Textarea } from "../../ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../ui/tabs";
import { toast } from "sonner";

interface DatabaseSetupGuidedProps {
  projectName: string;
  onComplete: (dbConfig: any) => void;
}

export function DatabaseSetupGuided({ projectName, onComplete }: DatabaseSetupGuidedProps) {
  const [connectionMethod, setConnectionMethod] = useState("form");
  const [isConnecting, setIsConnecting] = useState(false);
  
  // Connection String
  const [connectionString, setConnectionString] = useState("");
  
  // Form-based Connection
  const [connectionName, setConnectionName] = useState("");
  const [dbType, setDbType] = useState("postgresql");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("");
  const [database, setDatabase] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [useSSL, setUseSSL] = useState(false);
  const [additionalParams, setAdditionalParams] = useState("");

  const handleComplete = () => {
    if (connectionMethod === "string") {
      if (!connectionString.trim()) {
        toast.error("Please enter a connection string");
        return;
      }
    } else {
      if (!connectionName.trim() || !host.trim() || !database.trim() || !username.trim()) {
        toast.error("Please fill in all required fields");
        return;
      }
    }

    setIsConnecting(true);

    // Simulate connection process
    setTimeout(() => {
      const dbConfig = connectionMethod === "string" 
        ? { connectionString, method: "string" }
        : { connectionName, dbType, host, port, database, username, password, useSSL, additionalParams, method: "form" };

      toast.success("Database connected successfully!");
      
      // Wait a bit before completing to show success state
      setTimeout(() => {
        onComplete(dbConfig);
      }, 500);
    }, 1500);
  };

  return (
    <Card className="p-12 border border-border shadow-xl">
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mx-auto mb-4 shadow-lg">
          <Database className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-3xl text-foreground mb-2">Connect Your Database</h2>
        <p className="text-muted-foreground text-lg">
          Let's connect your first data source for "{projectName}"
        </p>
      </div>

      <div className="max-w-2xl mx-auto">
        <Tabs value={connectionMethod} onValueChange={setConnectionMethod} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="form" className="flex items-center gap-2">
              <Database className="w-4 h-4" />
              Connection Form
            </TabsTrigger>
            <TabsTrigger value="string" className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Connection String
            </TabsTrigger>
          </TabsList>

          {/* Connection Form Tab */}
          <TabsContent value="form" className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="connectionName">
                  Connection Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="connectionName"
                  placeholder="my-analytics-db"
                  value={connectionName}
                  onChange={(e) => setConnectionName(e.target.value)}
                  className="h-12"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dbType">
                  Database Type <span className="text-destructive">*</span>
                </Label>
                <Select value={dbType} onValueChange={setDbType}>
                  <SelectTrigger id="dbType" className="h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="postgresql">PostgreSQL</SelectItem>
                    <SelectItem value="mysql">MySQL</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="host">
                  Host <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="host"
                  placeholder="localhost or db.example.com"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  className="h-12"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="port">Port</Label>
                <Input
                  id="port"
                  placeholder={dbType === "postgresql" ? "5432" : "3306"}
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  className="h-12"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="database">
                  Database Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="database"
                  placeholder="my_database"
                  value={database}
                  onChange={(e) => setDatabase(e.target.value)}
                  className="h-12"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">
                  Username <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="username"
                  placeholder="database_user"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="h-12"
                  autoComplete="off"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12"
                  autoComplete="new-password"
                />
              </div>

              <div className="col-span-2 flex items-center space-x-2">
                <Checkbox
                  id="useSSL"
                  checked={useSSL}
                  onCheckedChange={(checked) => setUseSSL(checked as boolean)}
                />
                <Label htmlFor="useSSL" className="cursor-pointer">
                  Use SSL/TLS Connection
                </Label>
              </div>

              <div className="col-span-2 space-y-2">
                <Label htmlFor="additionalParams">Additional Parameters (Optional)</Label>
                <Textarea
                  id="additionalParams"
                  placeholder="sslmode=require&connect_timeout=10"
                  value={additionalParams}
                  onChange={(e) => setAdditionalParams(e.target.value)}
                  className="min-h-[80px] font-mono text-sm"
                />
              </div>
            </div>

            <div className="pt-4">
              <Button
                onClick={handleComplete}
                disabled={isConnecting}
                className="w-full h-14 bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white shadow-lg hover:shadow-xl transition-all disabled:opacity-70"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Connecting to database...
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5 mr-2" />
                    Connect Database & Complete Setup
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </TabsContent>

          {/* Connection String Tab */}
          <TabsContent value="string" className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="connectionString">Connection String</Label>
                <Textarea
                  id="connectionString"
                  placeholder="postgresql://username:password@localhost:5432/database&#10;or&#10;mysql://username:password@localhost:3306/database"
                  value={connectionString}
                  onChange={(e) => setConnectionString(e.target.value)}
                  className="min-h-[160px] font-mono text-sm"
                />
              </div>

              <div className="rounded-xl bg-muted/30 p-6 space-y-3 border border-border">
                <p className="text-sm text-muted-foreground">Example formats:</p>
                <code className="block text-xs bg-card p-3 rounded-lg border border-border">
                  postgresql://user:pass@host:5432/dbname
                </code>
                <code className="block text-xs bg-card p-3 rounded-lg border border-border">
                  mysql://user:pass@host:3306/dbname
                </code>
              </div>
            </div>

            <div className="pt-4">
              <Button
                onClick={handleComplete}
                disabled={isConnecting}
                className="w-full h-14 bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white shadow-lg hover:shadow-xl transition-all disabled:opacity-70"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Connecting to database...
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5 mr-2" />
                    Connect Database & Complete Setup
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Card>
  );
}
