import { useEffect, useRef, useState } from "react";
import { Database as DatabaseIcon, ArrowRight, Check, Sparkles, Loader2 } from "lucide-react";
import { Button } from "../../ui/button";
import { Card } from "../../ui/card";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { Checkbox } from "../../ui/checkbox";
import { Textarea } from "../../ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../ui/tabs";
import { toast } from "sonner";
import { createDatabase, getDatabases, type Database as DatabaseConnection, API_BASE_URL } from "../../../services/api";
import { Progress } from "../../ui/progress";

interface DatabaseSetupGuidedProps {
  projectName: string;
  projectId?: string;
  onComplete: (dbConfig: any) => void;
}

export function DatabaseSetupGuided({ projectName, projectId, onComplete }: DatabaseSetupGuidedProps) {
  const PROGRESS_OVERLAY_ENABLED = false;
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

  // Progress Overlay State
  const [showProgressOverlay, setShowProgressOverlay] = useState(false);
  const [progressValue, setProgressValue] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  const [progressTables, setProgressTables] = useState({
    total: 0,
    completed: 0,
    currentTable: "",
  });

  const progressIntervalRef = useRef<number | null>(null);
  const webSocketRef = useRef<WebSocket | null>(null);
  const overlayDismissTimeoutRef = useRef<number | null>(null);

  const resetProgressState = () => {
    setProgressValue(0);
    setProgressMessage("");
    setProgressTables({
      total: 0,
      completed: 0,
      currentTable: "",
    });
  };

  const cleanupWebSocket = () => {
    if (webSocketRef.current) {
      try {
        webSocketRef.current.close();
      } catch {
        // no-op if socket already closed
      }
      webSocketRef.current = null;
    }
  };

  const clearOverlayTimeout = () => {
    if (overlayDismissTimeoutRef.current) {
      window.clearTimeout(overlayDismissTimeoutRef.current);
      overlayDismissTimeoutRef.current = null;
    }
  };

  const stopInitialProgress = () => {
    if (progressIntervalRef.current) {
      window.clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  };

  const startInitialProgress = () => {
    stopInitialProgress();
    setShowProgressOverlay(true);
    setProgressValue(1);
    setProgressMessage("Validating connection details...");
    setProgressTables({
      total: 0,
      completed: 0,
      currentTable: "",
    });
    progressIntervalRef.current = window.setInterval(() => {
      setProgressValue((prev) => {
        if (prev >= 50) {
          stopInitialProgress();
          return 50;
        }
        return Math.min(50, prev + 2);
      });
    }, 300);
  };

  const buildProgressSocketUrl = (taskId: string): string => {
    const base = API_BASE_URL.replace(/\/$/, "");
    if (base.startsWith("https://")) {
      return `${base.replace("https://", "wss://")}/api/v1/backend/ws/progress/${taskId}`;
    }
    if (base.startsWith("http://")) {
      return `${base.replace("http://", "ws://")}/api/v1/backend/ws/progress/${taskId}`;
    }
    return `ws://${base}/api/v1/backend/ws/progress/${taskId}`;
  };

  const updateSecondHalfProgress = (completed: number, total: number) => {
    const ratio = total > 0 ? completed / total : 1;
    const target = 50 + Math.round(Math.min(ratio, 1) * 50);
    setProgressValue((prev) => {
      const ensured = Math.max(prev, target);
      if (ensured < 50) {
        return 50;
      }
      return Math.min(99, ensured);
    });
  };

  const waitForSchemaExtraction = (taskId: string, tablesCount: number): Promise<void> => {
    return new Promise((resolve, reject) => {
      const url = buildProgressSocketUrl(taskId);
      console.log("[DatabaseSetupGuided] Connecting to progress websocket:", url);
      try {
        const ws = new WebSocket(url);
        webSocketRef.current = ws;

        ws.onopen = () => {
          setProgressMessage("Extracting database schema...");
          setProgressTables((prev) => ({
            ...prev,
            total: tablesCount || prev.total,
          }));
        };

        ws.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            if (payload.type === "progress") {
              const total = payload.totalTables ?? tablesCount ?? 0;
              const completed = payload.completedTables ?? 0;
              setProgressTables({
                total,
                completed,
                currentTable: payload.tableName || "",
              });
              stopInitialProgress();
              updateSecondHalfProgress(completed, total);
              setProgressMessage(
                payload.message || `Extracting ${payload.tableName || "tables"}...`
              );
            } else if (payload.type === "completed") {
              stopInitialProgress();
              setProgressValue(100);
              setProgressMessage("Schema extraction completed");
              cleanupWebSocket();
              resolve();
            } else if (payload.type === "error") {
              cleanupWebSocket();
              reject(new Error(payload.message || "Schema extraction failed"));
            }
          } catch (err) {
            cleanupWebSocket();
            reject(err as Error);
          }
        };

        ws.onerror = () => {
          cleanupWebSocket();
          reject(new Error("WebSocket connection error while tracking progress"));
        };

        ws.onclose = () => {
          if (webSocketRef.current === ws) {
            webSocketRef.current = null;
          }
        };
      } catch (error) {
        reject(error as Error);
      }
    });
  };

  const delay = (ms: number) =>
    new Promise<void>((resolve) => {
      window.setTimeout(resolve, ms);
    });

  const fetchConnectionByName = async (
    name: string
  ): Promise<DatabaseConnection | null> => {
    if (!projectId) {
      return null;
    }
    const trimmedName = name.trim();
    for (let attempt = 0; attempt < 4; attempt++) {
      const connectionsResponse = await getDatabases(projectId);
      if (connectionsResponse.success && connectionsResponse.data) {
        const match = connectionsResponse.data.find(
          (conn) => conn.name === trimmedName
        );
        if (match) {
          return match;
        }
      }
      await delay(1000);
    }
    return null;
  };

  const buildDatabaseConfig = (connection: DatabaseConnection) => {
    if (connectionMethod === "string") {
      return {
        connectionString,
        method: "string",
        id: connection.id,
        name: connection.name,
        connectionName: connection.name,
      };
    }

    return {
      connectionName,
      dbType,
      host,
      port,
      database,
      username,
      password,
      useSSL,
      additionalParams,
      method: "form",
      id: connection.id,
      name: connection.name,
    };
  };

  useEffect(() => {
    return () => {
      stopInitialProgress();
      cleanupWebSocket();
      clearOverlayTimeout();
    };
  }, []);

  const handleComplete = async () => {
    if (!projectId) {
      toast.error("Project ID is required to create a database connection");
      return;
    }

    const normalizedConnectionName = connectionName.trim();

    if (connectionMethod === "string") {
      if (!connectionString.trim()) {
        toast.error("Please enter a connection string");
        return;
      }
      
      if (!normalizedConnectionName) {
        toast.error("Please provide a connection name");
        return;
      }
    } else {
      if (
        !normalizedConnectionName ||
        !host.trim() ||
        !database.trim() ||
        !username.trim()
      ) {
        toast.error("Please fill in all required fields");
        return;
      }
    }

    setIsConnecting(true);
    if (PROGRESS_OVERLAY_ENABLED) {
      clearOverlayTimeout();
      startInitialProgress();
    }

    try {
      let requestData: any;
      
      if (connectionMethod === "string") {
        requestData = {
          connectionString: connectionString.trim(),
          connectionName: normalizedConnectionName,
          consentGiven: true,
        };
      } else {
        const portValue = port && port.trim() ? port.trim() : undefined;
        
        requestData = {
          connectionName: normalizedConnectionName,
          dbType: dbType,
          host: host.trim(),
          ...(portValue && { port: portValue }),
          database: database.trim(),
          username: username.trim(),
          password: password || "",
          consentGiven: true,
        };
      }

      const response = await createDatabase(projectId, requestData);

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || "Failed to create database connection");
      }

      if (PROGRESS_OVERLAY_ENABLED) {
        setProgressTables({
          total: response.data.tablesCount || 0,
          completed: 0,
          currentTable: "",
        });
        setProgressMessage("Preparing schema extraction...");

        if (response.data.taskId) {
          console.log(
            "[DatabaseSetupGuided] Starting schema extraction task",
            response.data.taskId
          );
        } else {
          console.warn("[DatabaseSetupGuided] Missing taskId in createDatabase response");
        }

        await waitForSchemaExtraction(response.data.taskId, response.data.tablesCount || 0);
        setProgressMessage("Finalizing connection details...");
      }

      const createdConnection = await fetchConnectionByName(normalizedConnectionName);

      if (!createdConnection) {
        throw new Error(
          "Database connected but details are not available yet. Please refresh your connections list."
        );
      }

      const dbConfig = buildDatabaseConfig(createdConnection);

      toast.success("Database connected successfully!");
      onComplete(dbConfig);

      if (PROGRESS_OVERLAY_ENABLED) {
        clearOverlayTimeout();
        overlayDismissTimeoutRef.current = window.setTimeout(() => {
          setShowProgressOverlay(false);
          resetProgressState();
          overlayDismissTimeoutRef.current = null;
        }, 600);
      }
    } catch (error: any) {
      console.error("Error creating database connection:", error);
      toast.error(
        error.message ||
          "Failed to create database connection. Please check your credentials and try again."
      );
      if (PROGRESS_OVERLAY_ENABLED) {
        cleanupWebSocket();
        clearOverlayTimeout();
        setShowProgressOverlay(false);
        resetProgressState();
      }
    } finally {
      if (PROGRESS_OVERLAY_ENABLED) {
        stopInitialProgress();
      }
      setIsConnecting(false);
    }
  };

  return (
    <>
      {/* Progress overlay temporarily disabled */}
      {PROGRESS_OVERLAY_ENABLED && showProgressOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <Card className="w-full max-w-md border border-border shadow-2xl space-y-6 p-8 mx-4">
            <div className="flex flex-col items-center gap-3 text-center">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <h3 className="text-xl font-semibold text-foreground">Connecting to database</h3>
              <p className="text-sm text-muted-foreground">
                {progressMessage || "Initializing secure connection..."}
              </p>
              {progressTables.total > 0 && (
                <p className="text-xs text-muted-foreground">
                  {progressTables.completed}/{progressTables.total} tables processed
                </p>
              )}
              {progressTables.currentTable && (
                <p className="text-sm font-medium text-foreground truncate w-full">
                  {progressTables.currentTable}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Progress value={progressValue} className="h-3" />
              <div className="text-xs text-muted-foreground text-right">
                {Math.min(100, Math.max(0, Math.round(progressValue)))}%
              </div>
            </div>
          </Card>
        </div>
      )}
      <Card className="px-6 py-10 md:px-12 md:py-12 border border-border shadow-xl max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mx-auto mb-4 shadow-lg">
          <DatabaseIcon className="w-7 h-7 md:w-8 md:h-8 text-white" />
        </div>
        <h2 className="text-2xl md:text-3xl text-foreground mb-2">Connect Your Database</h2>
        <p className="text-sm md:text-lg text-muted-foreground">
          Let's connect your first data source for "{projectName}"
        </p>
      </div>

      <div className="max-w-2xl mx-auto space-y-6">
        {/* Connection Name - Always visible */}
        <div className="space-y-2">
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
          <p className="text-xs text-muted-foreground">
            A friendly name to identify this database connection
          </p>
        </div>

        <Tabs value={connectionMethod} onValueChange={setConnectionMethod} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6 md:mb-8">
            <TabsTrigger value="form" className="flex items-center gap-2">
              <DatabaseIcon className="w-4 h-4" />
              Connection Form
            </TabsTrigger>
            <TabsTrigger value="string" className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Connection String
            </TabsTrigger>
          </TabsList>

          {/* Connection Form Tab */}
          <TabsContent value="form" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

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
                <Label htmlFor="connectionString">
                  Connection String <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="connectionString"
                  placeholder="postgresql://username:password@localhost:5432/database&#10;or&#10;mysql://username:password@localhost:3306/database"
                  value={connectionString}
                  onChange={(e) => setConnectionString(e.target.value)}
                  className="min-h-[160px] font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Enter your full database connection string
                </p>
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
    </>
  );
}
