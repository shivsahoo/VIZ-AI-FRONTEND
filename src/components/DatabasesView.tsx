import { Plus, Database, Check, X, MoreVertical, Pencil, Trash2, Eye } from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { toast } from "sonner@2.0.3";
import { DatabaseConnectionFlow } from "./DatabaseConnectionFlow";

const mockDatabases = [
  {
    id: 1,
    name: "prod-analytics-db",
    type: "PostgreSQL",
    host: "analytics.prod.company.com",
    status: "connected",
    lastChecked: "2 minutes ago"
  },
  {
    id: 2,
    name: "sales-mysql-db",
    type: "MySQL",
    host: "sales.prod.company.com",
    status: "connected",
    lastChecked: "5 minutes ago"
  },
  {
    id: 3,
    name: "customer-data-warehouse",
    type: "PostgreSQL",
    host: "warehouse.prod.company.com",
    status: "connected",
    lastChecked: "1 minute ago"
  },
  {
    id: 4,
    name: "legacy-reporting",
    type: "MySQL",
    host: "legacy.company.com",
    status: "error",
    lastChecked: "10 minutes ago"
  }
];

interface DatabaseConnection {
  id: number;
  name: string;
  type: string;
  host: string;
  status: string;
  lastChecked: string;
}

export function DatabasesView() {
  const [databases, setDatabases] = useState<DatabaseConnection[]>(mockDatabases);
  const [showConnectionFlow, setShowConnectionFlow] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedDatabase, setSelectedDatabase] = useState<DatabaseConnection | null>(null);
  
  // Edit form state (for editing existing connections)
  const [connectionName, setConnectionName] = useState("");
  const [dbType, setDbType] = useState("postgresql");
  const [host, setHost] = useState("");

  const handleConnectionFlowComplete = (connectionData: {
    database: any;
    selectedTables: string[];
    databaseContext: Record<string, string>;
  }) => {
    const dbName = connectionData.database.connectionName || connectionData.database.name || "New Database";
    toast.success(`Database "${dbName}" connected successfully!`);
    
    // Add the new database to the list (in real app, this would be saved to backend)
    const newDb: DatabaseConnection = {
      id: databases.length + 1,
      name: dbName,
      type: connectionData.database.dbType === "postgresql" ? "PostgreSQL" : "MySQL",
      host: connectionData.database.host || "localhost",
      status: "connected",
      lastChecked: "just now"
    };
    
    setDatabases([...databases, newDb]);
    setShowConnectionFlow(false);
  };

  const handleViewConnection = (db: DatabaseConnection) => {
    setSelectedDatabase(db);
    setViewDialogOpen(true);
  };

  const handleEditConnection = (db: DatabaseConnection) => {
    setSelectedDatabase(db);
    setConnectionName(db.name);
    setDbType(db.type.toLowerCase());
    setHost(db.host);
    setEditDialogOpen(true);
  };

  const handleUpdateConnection = () => {
    if (!connectionName.trim() || !host.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    setDatabases(databases.map(db => 
      db.id === selectedDatabase?.id 
        ? { ...db, name: connectionName, host: host, type: dbType === "postgresql" ? "PostgreSQL" : "MySQL" }
        : db
    ));

    toast.success("Database connection updated successfully");
    
    // Reset form
    setConnectionName("");
    setHost("");
    setPort("");
    setDatabase("");
    setUsername("");
    setPassword("");
    setUseSSL(false);
    setAdditionalParams("");
    setSelectedDatabase(null);
    setEditDialogOpen(false);
  };

  const handleDeleteConnection = (db: DatabaseConnection) => {
    setDatabases(databases.filter(d => d.id !== db.id));
    toast.success(`Connection "${db.name}" deleted successfully`);
  };

  return (
    <div className="px-12 py-10">
      <div className="max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl text-foreground mb-1">Database Connections</h2>
            <p className="text-muted-foreground">Manage your PostgreSQL and MySQL connections</p>
          </div>
          <Button 
            onClick={() => setShowConnectionFlow(true)}
            className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white shadow-lg hover:shadow-xl transition-all"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Connection
          </Button>
        </div>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="p-6 border border-border">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
                  <Check className="w-6 h-6 text-success" />
                </div>
                <div>
                  <p className="text-2xl text-foreground mb-1">3</p>
                  <p className="text-sm text-muted-foreground">Active Connections</p>
                </div>
              </div>
            </Card>

            <Card className="p-6 border border-border">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center">
                  <X className="w-6 h-6 text-destructive" />
                </div>
                <div>
                  <p className="text-2xl text-foreground mb-1">1</p>
                  <p className="text-sm text-muted-foreground">Connection Errors</p>
                </div>
              </div>
            </Card>

            <Card className="p-6 border border-border">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                  <Database className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <p className="text-2xl text-foreground mb-1">4</p>
                  <p className="text-sm text-muted-foreground">Total Databases</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Databases Table */}
          <Card className="border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Host</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Checked</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {databases.map((db) => (
                  <TableRow key={db.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md">
                          <Database className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-foreground">{db.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-border">
                        {db.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{db.host}</TableCell>
                    <TableCell>
                      <Badge 
                        className={
                          db.status === 'connected' 
                            ? 'bg-success/10 text-success border-success/20' 
                            : 'bg-destructive/10 text-destructive border-destructive/20'
                        }
                      >
                        {db.status === 'connected' ? (
                          <Check className="w-3 h-3 mr-1" />
                        ) : (
                          <X className="w-3 h-3 mr-1" />
                        )}
                        {db.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{db.lastChecked}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleViewConnection(db)}>
                            <Eye className="w-4 h-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEditConnection(db)}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Edit Connection
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => handleDeleteConnection(db)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete Connection
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

        {/* Database Connection Flow */}
        {showConnectionFlow && (
          <DatabaseConnectionFlow
            onComplete={handleConnectionFlowComplete}
            onCancel={() => setShowConnectionFlow(false)}
          />
        )}

        {/* View Connection Dialog */}
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Connection Details</DialogTitle>
              <DialogDescription>
                View database connection information
              </DialogDescription>
            </DialogHeader>

            {selectedDatabase && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Connection Name</Label>
                    <div className="p-3 rounded-md bg-muted/30 border border-border">
                      {selectedDatabase.name}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Database Type</Label>
                    <div className="p-3 rounded-md bg-muted/30 border border-border">
                      {selectedDatabase.type}
                    </div>
                  </div>

                  <div className="col-span-2 space-y-2">
                    <Label>Host</Label>
                    <div className="p-3 rounded-md bg-muted/30 border border-border">
                      {selectedDatabase.host}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Status</Label>
                    <div className="p-3 rounded-md bg-muted/30 border border-border">
                      <Badge 
                        className={
                          selectedDatabase.status === 'connected' 
                            ? 'bg-success/10 text-success border-success/20' 
                            : 'bg-destructive/10 text-destructive border-destructive/20'
                        }
                      >
                        {selectedDatabase.status === 'connected' ? (
                          <Check className="w-3 h-3 mr-1" />
                        ) : (
                          <X className="w-3 h-3 mr-1" />
                        )}
                        {selectedDatabase.status}
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Last Checked</Label>
                    <div className="p-3 rounded-md bg-muted/30 border border-border">
                      {selectedDatabase.lastChecked}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Connection Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Database Connection</DialogTitle>
              <DialogDescription>
                Update your database connection settings
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="edit-connectionName">
                    Connection Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="edit-connectionName"
                    placeholder="prod-analytics-db"
                    value={connectionName}
                    onChange={(e) => setConnectionName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-dbType">
                    Database Type <span className="text-destructive">*</span>
                  </Label>
                  <Select value={dbType} onValueChange={setDbType}>
                    <SelectTrigger id="edit-dbType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="postgresql">PostgreSQL</SelectItem>
                      <SelectItem value="mysql">MySQL</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-host">
                    Host <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="edit-host"
                    placeholder="localhost or db.example.com"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleUpdateConnection}
                className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white"
              >
                <Database className="w-4 h-4 mr-2" />
                Update Connection
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>
  );
}
