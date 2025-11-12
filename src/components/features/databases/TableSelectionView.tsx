import { useState } from "react";
import type { MouseEvent } from "react";
import { motion } from "motion/react";
import { Database, CheckCircle2, Search, Table2, Shield, ArrowRight, Info, Sparkles } from "lucide-react";
import { Button } from "../../ui/button";
import { Card } from "../../ui/card";
import { Input } from "../../ui/input";
import { Checkbox } from "../../ui/checkbox";
import { Badge } from "../../ui/badge";
import { ScrollArea } from "../../ui/scroll-area";
import { Alert, AlertDescription } from "../../ui/alert";

interface DatabaseTable {
  name: string;
  schema: string;
  rowCount: number;
  columns: number;
  description?: string;
}

interface TableSelectionViewProps {
  databaseName: string;
  onComplete: (selectedTables: string[]) => void;
}

// Mock data - in real implementation, this would come from the database
const MOCK_TABLES: DatabaseTable[] = [
  {
    name: "users",
    schema: "public",
    rowCount: 15420,
    columns: 12,
    description: "Customer user accounts and profiles"
  },
  {
    name: "orders",
    schema: "public",
    rowCount: 45890,
    columns: 18,
    description: "Order transactions and details"
  },
  {
    name: "products",
    schema: "public",
    rowCount: 2340,
    columns: 15,
    description: "Product catalog and inventory"
  },
  {
    name: "order_items",
    schema: "public",
    rowCount: 98560,
    columns: 8,
    description: "Individual items within orders"
  },
  {
    name: "payments",
    schema: "public",
    rowCount: 46230,
    columns: 10,
    description: "Payment transactions and methods"
  },
  {
    name: "categories",
    schema: "public",
    rowCount: 45,
    columns: 6,
    description: "Product categories and hierarchies"
  },
  {
    name: "reviews",
    schema: "public",
    rowCount: 8970,
    columns: 9,
    description: "Customer product reviews and ratings"
  },
  {
    name: "shipping",
    schema: "public",
    rowCount: 44120,
    columns: 14,
    description: "Shipping and delivery information"
  },
  {
    name: "promotions",
    schema: "public",
    rowCount: 156,
    columns: 11,
    description: "Marketing campaigns and discount codes"
  },
  {
    name: "inventory",
    schema: "public",
    rowCount: 2340,
    columns: 8,
    description: "Stock levels and warehouse data"
  }
];

// AI-recommended tables (would be determined by AI analysis in production)
const AI_RECOMMENDED_TABLES = ["users", "orders", "products", "payments"];

export function TableSelectionView({ databaseName, onComplete }: TableSelectionViewProps) {
  const [selectedTables, setSelectedTables] = useState<Set<string>>(
    new Set(AI_RECOMMENDED_TABLES) // Pre-select AI recommended tables
  );
  const [searchQuery, setSearchQuery] = useState("");

  // Filter unselected tables
  const unselectedTables = MOCK_TABLES.filter(
    table => !selectedTables.has(table.name) && 
    (table.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    table.description?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Get selected tables with full details
  const selectedTableDetails = MOCK_TABLES.filter(table => 
    selectedTables.has(table.name)
  );

  const addTable = (tableName: string) => {
    const newSelected = new Set(selectedTables);
    newSelected.add(tableName);
    setSelectedTables(newSelected);
  };

  const removeTable = (tableName: string) => {
    const newSelected = new Set(selectedTables);
    newSelected.delete(tableName);
    setSelectedTables(newSelected);
  };

  const selectAll = () => {
    setSelectedTables(new Set(MOCK_TABLES.map(t => t.name)));
  };

  const deselectAll = () => {
    setSelectedTables(new Set());
  };

  const handleContinue = () => {
    onComplete(Array.from(selectedTables));
  };

  return (
    <Card className="border border-border shadow-xl overflow-hidden">
      <div className="flex flex-col h-[600px]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border bg-gradient-to-r from-primary/5 to-accent/5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg flex-shrink-0">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-foreground">Select Tables for AI</h3>
                <p className="text-xs text-muted-foreground">
                  {selectedTables.size} of {MOCK_TABLES.length} tables selected
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-success/20 bg-success/10 text-success">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                {databaseName}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={selectAll}
                className="h-8 text-xs"
              >
                Select All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={deselectAll}
                className="h-8 text-xs"
              >
                Clear All
              </Button>
            </div>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="flex-1 overflow-hidden flex gap-4 p-4">
          {/* All Tables Section */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm text-foreground">
                Available Tables ({unselectedTables.length})
              </h4>
            </div>

            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tables..."
                className="pl-9 h-9 text-sm"
              />
            </div>
            
            <div className="flex-1 min-h-0 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="space-y-2 pr-3">
                  {unselectedTables.length === 0 ? (
                    <Card className="p-6 border border-dashed border-border">
                      <div className="text-center text-sm text-muted-foreground">
                        {searchQuery ? "No tables match your search" : "All tables are selected"}
                      </div>
                    </Card>
                  ) : (
                    unselectedTables.map((table, index) => {
                      const isRecommended = AI_RECOMMENDED_TABLES.includes(table.name);
                      return (
                        <motion.div
                          key={table.name}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.2, delay: index * 0.02 }}
                        >
                          <Card className="p-3 border-border hover:border-primary/30 hover:bg-muted/30 transition-all cursor-pointer group"
                            onClick={() => addTable(table.name)}
                          >
                            <div className="flex items-start gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <Table2 className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
                                  <h5 className="text-sm text-foreground">
                                    {table.name}
                                  </h5>
                                  {isRecommended && (
                                    <Badge variant="outline" className="text-xs border-primary/30 bg-primary/10 text-primary px-1.5 py-0">
                                      <Sparkles className="w-3 h-3" />
                                    </Badge>
                                  )}
                                </div>
                                {table.description && (
                                  <p className="text-xs text-muted-foreground mb-1 line-clamp-1 pl-5">
                                    {table.description}
                                  </p>
                                )}
                                <div className="flex items-center gap-2 text-xs text-muted-foreground pl-5">
                                  <span>{table.rowCount.toLocaleString()} rows</span>
                                  <span>•</span>
                                  <span>{table.columns} cols</span>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e: MouseEvent) => {
                                  e.stopPropagation();
                                  addTable(table.name);
                                }}
                                className="h-7 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                              >
                                Add
                              </Button>
                            </div>
                          </Card>
                        </motion.div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>

          {/* Divider */}
          <div className="w-px bg-border flex-shrink-0" />

          {/* Selected Tables Section */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm text-foreground flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-success" />
                Selected Tables ({selectedTables.size})
              </h4>
            </div>

            <Alert className="border-primary/20 bg-primary/5 mb-2 py-2">
              <Shield className="w-3.5 h-3.5 text-primary" />
              <AlertDescription className="text-xs text-muted-foreground ml-2">
                AI-recommended tables are pre-selected
              </AlertDescription>
            </Alert>
            
            <div className="flex-1 min-h-0 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="space-y-2 pr-3">
                  {selectedTableDetails.length === 0 ? (
                    <Card className="p-6 border border-dashed border-border">
                      <div className="text-center text-sm text-muted-foreground">
                        No tables selected. Add tables from the left.
                      </div>
                    </Card>
                  ) : (
                    selectedTableDetails.map((table, index) => {
                      const isRecommended = AI_RECOMMENDED_TABLES.includes(table.name);
                      return (
                        <motion.div
                          key={table.name}
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.2, delay: index * 0.02 }}
                        >
                          <Card className="p-3 border-primary bg-primary/5 hover:bg-primary/10 transition-colors group">
                            <div className="flex items-start gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <Table2 className="w-3.5 h-3.5 flex-shrink-0 text-primary" />
                                  <h5 className="text-sm text-foreground">
                                    {table.name}
                                  </h5>
                                  {isRecommended && (
                                    <Badge variant="outline" className="text-xs border-primary/30 bg-primary/10 text-primary px-1.5 py-0">
                                      <Sparkles className="w-3 h-3" />
                                    </Badge>
                                  )}
                                </div>
                                {table.description && (
                                  <p className="text-xs text-muted-foreground mb-1 line-clamp-1 pl-5">
                                    {table.description}
                                  </p>
                                )}
                                <div className="flex items-center gap-2 text-xs text-muted-foreground pl-5">
                                  <span>{table.rowCount.toLocaleString()} rows</span>
                                  <span>•</span>
                                  <span>{table.columns} cols</span>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeTable(table.name)}
                                className="h-7 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                              >
                                Remove
                              </Button>
                            </div>
                          </Card>
                        </motion.div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border bg-card">
          <Button
            onClick={handleContinue}
            disabled={selectedTables.size === 0}
            className="w-full h-11 bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white shadow-lg hover:shadow-xl transition-all"
          >
            Continue with {selectedTables.size} Table{selectedTables.size !== 1 ? 's' : ''}
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
          
          {selectedTables.size === 0 && (
            <p className="text-xs text-center text-muted-foreground mt-1.5">
              Please select at least one table to continue
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
