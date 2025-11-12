import { Plus, Shield, Search, Mail, MoreVertical, Trash2, UserCog, Users as UsersIcon, Database, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Checkbox } from "../components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { toast } from "sonner";
import { getTeamMembers, getRoles, getPermissions, createRole, inviteUser, type Permission as ApiPermission } from "../services/api";
import { Skeleton } from "../components/ui/skeleton";

interface Permission {
  id: string;
  name: string;
  description: string;
  category: string;
}

interface DatabaseAccess {
  databaseId: string;
  databaseName: string;
  tables: string[]; // Empty array means all tables
}

interface Role {
  id: number;
  name: string;
  description: string;
  permissions: string[];
  count: number;
  color: string;
  isSystem?: boolean;
  databaseAccess?: DatabaseAccess[]; // Database and table restrictions
}

interface User {
  id: number;
  name: string;
  email: string;
  roleId: number;
  status: "active" | "inactive";
  avatar: string;
}

const allPermissions: Permission[] = [
  // Projects permissions (Read only for all)
  { id: "projects.view", name: "View Projects", description: "Can view project details (read-only)", category: "Projects" },
  
  // Team permissions
  { id: "team.view", name: "View Team", description: "Can view team members", category: "Team" },
  { id: "team.invite", name: "Invite Members", description: "Can invite new team members", category: "Team" },
  { id: "team.edit", name: "Edit Members", description: "Can modify member roles", category: "Team" },
  { id: "team.remove", name: "Remove Members", description: "Can remove team members", category: "Team" },
  
  // Database permissions
  { id: "database.view", name: "Read Databases", description: "Can view database connections", category: "Databases" },
  { id: "database.connect", name: "Create Databases", description: "Can add new database connections", category: "Databases" },
  { id: "database.edit", name: "Update Databases", description: "Can modify database connections", category: "Databases" },
  { id: "database.delete", name: "Delete Databases", description: "Can remove database connections", category: "Databases" },
  
  // Dashboards & Charts permissions
  { id: "dashboard.view", name: "Read Dashboards", description: "Can view dashboards and charts", category: "Dashboards & Charts" },
  { id: "dashboard.create", name: "Create Dashboards", description: "Can create dashboards and charts", category: "Dashboards & Charts" },
  { id: "dashboard.edit", name: "Update Dashboards", description: "Can edit dashboards and charts", category: "Dashboards & Charts" },
  { id: "dashboard.delete", name: "Delete Dashboards", description: "Can delete dashboards and charts", category: "Dashboards & Charts" },
  
  // Insights permissions
  { id: "insights.view", name: "Read Insights", description: "Can view generated insights", category: "Insights" },
  { id: "insights.generate", name: "Create Insights", description: "Can generate new insights", category: "Insights" },
  { id: "insights.edit", name: "Update Insights", description: "Can modify existing insights", category: "Insights" },
];

const defaultRoles: Role[] = [
  {
    id: 1,
    name: "Admin",
    description: "Full control over team, databases, dashboards, and insights. Read-only access to projects.",
    permissions: [
      "projects.view",
      "team.view", "team.invite", "team.edit", "team.remove",
      "database.view", "database.connect", "database.edit", "database.delete",
      "dashboard.view", "dashboard.create", "dashboard.edit", "dashboard.delete",
      "insights.view", "insights.generate", "insights.edit",
    ],
    count: 2,
    color: "bg-primary",
    isSystem: true,
  },
  {
    id: 2,
    name: "Member",
    description: "Create and edit databases, dashboards, and insights. Read-only access to projects and team.",
    permissions: [
      "projects.view",
      "team.view",
      "database.view", "database.connect", "database.edit",
      "dashboard.view", "dashboard.create", "dashboard.edit",
      "insights.view", "insights.generate", "insights.edit",
    ],
    count: 4,
    color: "bg-accent",
    isSystem: true,
  },
  {
    id: 3,
    name: "Viewer",
    description: "View-only access to all project resources",
    permissions: [
      "projects.view",
      "team.view",
      "database.view",
      "dashboard.view",
      "insights.view",
    ],
    count: 3,
    color: "bg-muted-foreground/40",
    isSystem: true,
  },
];

// Mock databases and their tables
const mockDatabases = [
  {
    id: "db-1",
    name: "prod-analytics-db",
    tables: ["users", "orders", "products", "payments", "reviews"]
  },
  {
    id: "db-2",
    name: "sales-mysql-db",
    tables: ["customers", "transactions", "invoices", "campaigns"]
  },
  {
    id: "db-3",
    name: "customer-data-warehouse",
    tables: ["dim_customers", "fact_sales", "dim_products", "dim_time"]
  }
];

const mockUsers: User[] = [
  { id: 1, name: "Sarah Johnson", email: "sarah.j@company.com", roleId: 1, status: "active", avatar: "SJ" },
  { id: 2, name: "Michael Chen", email: "m.chen@company.com", roleId: 1, status: "active", avatar: "MC" },
  { id: 3, name: "Emily Davis", email: "emily.d@company.com", roleId: 2, status: "active", avatar: "ED" },
  { id: 4, name: "James Wilson", email: "j.wilson@company.com", roleId: 2, status: "active", avatar: "JW" },
  { id: 5, name: "Lisa Anderson", email: "l.anderson@company.com", roleId: 2, status: "active", avatar: "LA" },
  { id: 6, name: "David Kim", email: "d.kim@company.com", roleId: 2, status: "active", avatar: "DK" },
  { id: 7, name: "Anna Martinez", email: "a.martinez@company.com", roleId: 3, status: "active", avatar: "AM" },
  { id: 8, name: "Tom Brown", email: "t.brown@company.com", roleId: 3, status: "inactive", avatar: "TB" },
  { id: 9, name: "Rachel Green", email: "r.green@company.com", roleId: 3, status: "active", avatar: "RG" },
];

type ViewType = "members" | "roles";

interface UsersViewProps {
  projectId?: number | string;
}

export function UsersView({ projectId }: UsersViewProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [apiPermissions, setApiPermissions] = useState<ApiPermission[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [isLoadingRoles, setIsLoadingRoles] = useState(true);
  const [activeView, setActiveView] = useState<ViewType>("members");
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Invite member state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteUsername, setInviteUsername] = useState("");
  const [inviteRoleId, setInviteRoleId] = useState<string>("");

  // Edit member state
  const [editMemberDialogOpen, setEditMemberDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUserName, setEditUserName] = useState("");
  const [editUserEmail, setEditUserEmail] = useState("");
  const [editUserRoleId, setEditUserRoleId] = useState<string>("");

  // Create/Edit role state
  const [roleName, setRoleName] = useState("");
  const [roleDescription, setRoleDescription] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [selectedDatabaseAccess, setSelectedDatabaseAccess] = useState<DatabaseAccess[]>([]);
  const [expandedDatabases, setExpandedDatabases] = useState<Set<string>>(new Set());

  // Store API role IDs mapping
  const [roleIdMap, setRoleIdMap] = useState<Map<string, string>>(new Map()); // UI ID -> API ID
  const [rolesLoaded, setRolesLoaded] = useState(false);

  // Fetch permissions and roles when projectId is available
  useEffect(() => {
    if (projectId) {
      setRolesLoaded(false); // Reset when projectId changes
      fetchPermissions();
      fetchRoles();
    } else {
      setIsLoadingUsers(false);
      setIsLoadingRoles(false);
      setRolesLoaded(false);
    }
  }, [projectId]);

  // Fetch users after roles are loaded (only once when roles are first loaded)
  useEffect(() => {
    if (projectId && roles.length > 0 && !isLoadingRoles && !rolesLoaded) {
      setRolesLoaded(true);
      fetchUsers();
    }
  }, [projectId, roles.length, isLoadingRoles]);

  // Update role counts when users change
  useEffect(() => {
    if (users.length > 0 && roles.length > 0) {
      const updatedRoles = roles.map(role => {
        const userCount = users.filter(u => u.roleId === role.id).length;
        return { ...role, count: userCount };
      });
      // Only update if counts actually changed to avoid infinite loops
      const countsChanged = updatedRoles.some((role, index) => role.count !== roles[index]?.count);
      if (countsChanged) {
        setRoles(updatedRoles);
      }
    }
  }, [users]);

  const fetchUsers = async () => {
    if (!projectId || roles.length === 0) return;
    
    setIsLoadingUsers(true);
    try {
      const response = await getTeamMembers(String(projectId));
      if (response.success && response.data) {
        // Map API users to UI format
        const uiUsers: User[] = response.data.map((user, index) => {
          // Find role by name to get roleId
          const role = roles.find(r => r.name === user.role);
          return {
            id: index + 1, // Temporary ID for UI
            name: user.name,
            email: user.email,
            roleId: role?.id || (roles.length > 0 ? roles[0].id : 1), // Default to first role if not found
            status: "active" as const,
            avatar: user.name.split(" ").map(n => n[0]).join("").toUpperCase(),
          };
        });
        setUsers(uiUsers);
      } else {
        toast.error(response.error?.message || "Failed to load users");
        setUsers([]);
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred while fetching users");
      setUsers([]);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const fetchRoles = async () => {
    if (!projectId) return;
    
    setIsLoadingRoles(true);
    try {
      const response = await getRoles(String(projectId));
      if (response.success && response.data) {
        // Create mapping for API role IDs
        const newRoleIdMap = new Map<string, string>();
        
        // Map API roles to UI format
        const uiRoles: Role[] = response.data.map((role, index) => {
          const uiId = index + 1;
          // Store mapping: UI ID -> API ID
          newRoleIdMap.set(uiId.toString(), role.id);

          return {
            id: uiId,
            name: role.name,
            description: role.description || `${role.name} role`,
            permissions: Array.isArray(role.permissions) ? role.permissions : [],
            count: 0, // Will be updated after users are loaded
            color: role.isBuiltIn 
              ? role.name.toLowerCase() === 'admin' 
                ? "bg-primary" 
                : "bg-accent"
              : "bg-accent/80",
            isSystem: role.isBuiltIn || false,
            databaseAccess: role.databaseAccess ? Object.keys(role.databaseAccess.tables || {}).map(dbId => ({
              databaseId: dbId,
              databaseName: dbId, // Would need to fetch database names
              tables: role.databaseAccess!.tables[dbId] || [],
            })) : [],
          };
        });
        setRoleIdMap(newRoleIdMap);
        setRoles(uiRoles);
      } else {
        toast.error(response.error?.message || "Failed to load roles");
        setRoles([]);
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred while fetching roles");
      setRoles([]);
    } finally {
      setIsLoadingRoles(false);
    }
  };

  const fetchPermissions = async () => {
    try {
      const response = await getPermissions();
      if (response.success && response.data) {
        setApiPermissions(response.data);
      }
    } catch (err: any) {
      console.error("Failed to fetch permissions:", err);
      // Don't show error toast for permissions as it's not critical
    }
  };

  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRoleName = (roleId: number) => {
    return roles.find(r => r.id === roleId)?.name || "Unknown";
  };

  const getRoleColor = (roleId: number) => {
    return roles.find(r => r.id === roleId)?.color || "from-gray-500 to-slate-500";
  };

  const handleInviteMember = async () => {
    if (!projectId) {
      toast.error("Project ID is required");
      return;
    }

    if (!inviteEmail || !inviteName || !inviteUsername || !inviteRoleId) {
      toast.error("Please fill in all fields");
      return;
    }

    try {
      // Get the actual API role ID from the mapping
      const apiRoleId = roleIdMap.get(inviteRoleId);
      if (!apiRoleId) {
        toast.error("Selected role not found");
        return;
      }

      const response = await inviteUser(String(projectId), {
        username: inviteUsername,
        email: inviteEmail,
        role_id: apiRoleId, // Use the actual API role ID (UUID)
      });

      if (response.success) {
        toast.success(`User invited successfully`);
        setInviteDialogOpen(false);
        setInviteEmail("");
        setInviteName("");
        setInviteUsername("");
        setInviteRoleId("");
        
        // Refresh users list
        fetchUsers();
      } else {
        toast.error(response.error?.message || "Failed to invite user");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred while inviting user");
    }
  };

  const handleCreateOrUpdateRole = async () => {
    if (!projectId) {
      toast.error("Project ID is required");
      return;
    }

    if (!roleName || !roleDescription) {
      toast.error("Please fill in role name and description");
      return;
    }

    if (editingRole) {
      // Update existing role - TODO: Implement update API if available
      toast.error("Role update not yet implemented via API");
      return;
    }

    try {
      // Map selected permissions to permission IDs (UUIDs) from API
      // selectedPermissions contains permission IDs (UUIDs) from the API permissions
      const permissionIds: string[] = [];
      
      selectedPermissions.forEach(permId => {
        // Check if it's already a UUID (API permission ID)
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(permId)) {
          permissionIds.push(permId);
        } else {
          // Try to find matching permission by type or name
          const apiPerm = apiPermissions.find(p => 
            p.type === permId || 
            p.id === permId ||
            p.type.toLowerCase().includes(permId.toLowerCase())
          );
          if (apiPerm) {
            permissionIds.push(apiPerm.id);
          }
        }
      });

      if (permissionIds.length === 0) {
        toast.error("Please select at least one permission");
        return;
      }

      const response = await createRole(String(projectId), {
        name: roleName,
        description: roleDescription,
        permissions: permissionIds,
      });

      if (response.success && response.data) {
        toast.success("Role created successfully");
        setRoleDialogOpen(false);
        resetRoleDialog();
        
        // Refresh roles list
        fetchRoles();
      } else {
        toast.error(response.error?.message || "Failed to create role");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred while creating role");
    }
  };

  const resetRoleDialog = () => {
    setRoleName("");
    setRoleDescription("");
    setSelectedPermissions([]);
    setSelectedDatabaseAccess([]);
    setExpandedDatabases(new Set());
    setEditingRole(null);
  };

  const openEditRoleDialog = (role: Role) => {
    setEditingRole(role);
    setRoleName(role.name);
    setRoleDescription(role.description);
    setSelectedPermissions(role.permissions);
    setSelectedDatabaseAccess(role.databaseAccess || []);
    setRoleDialogOpen(true);
  };

  const handleDeleteRole = (roleId: number) => {
    const role = roles.find(r => r.id === roleId);
    if (role?.isSystem) {
      toast.error("Cannot delete system roles");
      return;
    }
    if (role && role.count > 0) {
      toast.error("Cannot delete role with assigned members");
      return;
    }
    setRoles(roles.filter(r => r.id !== roleId));
    toast.success("Role deleted successfully");
  };

  const handleChangeUserRole = (userId: number, newRoleId: number) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    const oldRoleId = user.roleId;

    setUsers(users.map(u => u.id === userId ? { ...u, roleId: newRoleId } : u));
    
    // Update role counts
    const updatedRoles = roles.map(role => {
      if (role.id === oldRoleId) return { ...role, count: role.count - 1 };
      if (role.id === newRoleId) return { ...role, count: role.count + 1 };
      return role;
    });
    setRoles(updatedRoles);

    toast.success("Member role updated");
  };

  const openEditMemberDialog = (user: User) => {
    setEditingUser(user);
    setEditUserName(user.name);
    setEditUserEmail(user.email);
    setEditUserRoleId(user.roleId.toString());
    setEditMemberDialogOpen(true);
  };

  const handleUpdateUser = () => {
    if (!editingUser || !editUserName || !editUserEmail || !editUserRoleId) {
      toast.error("Please fill in all fields");
      return;
    }

    const oldRoleId = editingUser.roleId;
    const newRoleId = parseInt(editUserRoleId);

    setUsers(users.map(u => 
      u.id === editingUser.id 
        ? { ...u, name: editUserName, email: editUserEmail, roleId: newRoleId, avatar: editUserName.split(" ").map(n => n[0]).join("").toUpperCase() }
        : u
    ));

    // Update role counts if role changed
    if (oldRoleId !== newRoleId) {
      const updatedRoles = roles.map(role => {
        if (role.id === oldRoleId) return { ...role, count: role.count - 1 };
        if (role.id === newRoleId) return { ...role, count: role.count + 1 };
        return role;
      });
      setRoles(updatedRoles);
    }

    toast.success("Member details updated");
    setEditMemberDialogOpen(false);
    setEditingUser(null);
    setEditUserName("");
    setEditUserEmail("");
    setEditUserRoleId("");
  };

  const handleRemoveUser = (userId: number) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    setUsers(users.filter(u => u.id !== userId));
    
    // Update role count
    const updatedRoles = roles.map(role =>
      role.id === user.roleId
        ? { ...role, count: role.count - 1 }
        : role
    );
    setRoles(updatedRoles);

    toast.success("Member removed");
  };

  const togglePermission = (permissionId: string) => {
    if (selectedPermissions.includes(permissionId)) {
      setSelectedPermissions(selectedPermissions.filter(p => p !== permissionId));
    } else {
      setSelectedPermissions([...selectedPermissions, permissionId]);
    }
  };

  const toggleDatabaseExpanded = (databaseId: string) => {
    const newExpanded = new Set(expandedDatabases);
    if (newExpanded.has(databaseId)) {
      newExpanded.delete(databaseId);
    } else {
      newExpanded.add(databaseId);
    }
    setExpandedDatabases(newExpanded);
  };

  const isDatabaseSelected = (databaseId: string) => {
    return selectedDatabaseAccess.some(db => db.databaseId === databaseId);
  };

  const toggleDatabase = (database: typeof mockDatabases[0]) => {
    if (isDatabaseSelected(database.id)) {
      // Remove database
      setSelectedDatabaseAccess(selectedDatabaseAccess.filter(db => db.databaseId !== database.id));
    } else {
      // Add database with all tables
      setSelectedDatabaseAccess([
        ...selectedDatabaseAccess,
        {
          databaseId: database.id,
          databaseName: database.name,
          tables: [] // Empty means all tables
        }
      ]);
    }
  };

  const toggleTable = (databaseId: string, tableName: string) => {
    setSelectedDatabaseAccess(selectedDatabaseAccess.map(db => {
      if (db.databaseId === databaseId) {
        const tables = db.tables.length === 0 
          ? mockDatabases.find(d => d.id === databaseId)?.tables.filter(t => t !== tableName) || []
          : db.tables.includes(tableName)
          ? db.tables.filter(t => t !== tableName)
          : [...db.tables, tableName];
        return { ...db, tables };
      }
      return db;
    }));
  };

  const isTableSelected = (databaseId: string, tableName: string) => {
    const db = selectedDatabaseAccess.find(d => d.databaseId === databaseId);
    if (!db) return false;
    if (db.tables.length === 0) return true; // All tables selected
    return db.tables.includes(tableName);
  };

  // Map API permissions to UI permissions format
  const mappedPermissions: Permission[] = apiPermissions.map(apiPerm => {
    // Try to find matching permission in allPermissions by type/name
    const matchingPerm = allPermissions.find(p => 
      p.id === apiPerm.type || 
      p.name.toLowerCase().includes(apiPerm.type.toLowerCase()) ||
      apiPerm.type.toLowerCase().includes(p.name.toLowerCase())
    );
    
    if (matchingPerm) {
      return {
        ...matchingPerm,
        id: apiPerm.id, // Use API permission ID
      };
    }
    
    // If no match, create a new permission entry
    return {
      id: apiPerm.id,
      name: apiPerm.type,
      description: `${apiPerm.type} permission`,
      category: "General",
    };
  });

  const groupedPermissions = mappedPermissions.length > 0 
    ? mappedPermissions.reduce((acc, permission) => {
        if (!acc[permission.category]) {
          acc[permission.category] = [];
        }
        acc[permission.category].push(permission);
        return acc;
      }, {} as Record<string, Permission[]>)
    : allPermissions.reduce((acc, permission) => {
        if (!acc[permission.category]) {
          acc[permission.category] = [];
        }
        acc[permission.category].push(permission);
        return acc;
      }, {} as Record<string, Permission[]>);

  return (
    <div className="min-h-full bg-background">
      {/* Header Section */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="px-8 py-6 max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl text-foreground mb-1">Team</h1>
              <p className="text-sm text-muted-foreground">Manage members, roles, and permissions</p>
            </div>

            {/* Custom Tab Navigation */}
            <div className="flex gap-1 bg-muted/30 p-1 rounded-lg">
              <button
                onClick={() => setActiveView("members")}
                className={`px-4 py-2 rounded-md text-sm transition-all flex items-center gap-2 ${
                  activeView === "members"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <UsersIcon className={`w-4 h-4 ${activeView === "members" ? "text-primary" : ""}`} />
                Members
                <span className={`ml-1 text-xs ${activeView === "members" ? "text-primary/70" : "text-muted-foreground"}`}>{users.length}</span>
              </button>
              <button
                onClick={() => setActiveView("roles")}
                className={`px-4 py-2 rounded-md text-sm transition-all flex items-center gap-2 ${
                  activeView === "roles"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Shield className={`w-4 h-4 ${activeView === "roles" ? "text-accent" : ""}`} />
                Roles & Permissions
                <span className={`ml-1 text-xs ${activeView === "roles" ? "text-accent/70" : "text-muted-foreground"}`}>{roles.length}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="px-8 py-6 max-w-7xl mx-auto">
        {/* Members View */}
        {activeView === "members" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {isLoadingUsers ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-primary animate-spin" />
                    Loading members...
                  </span>
                ) : (
                  `${filteredUsers.length} team members`
                )}
              </p>
              <div className="flex items-center gap-3">
                <div className="relative w-80">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search members..." 
                    className="pl-10 bg-card border-border h-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Button 
                  onClick={() => setInviteDialogOpen(true)}
                  className="h-9 bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Invite Member
                </Button>
              </div>
            </div>

            <Card className="border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead>Member</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingUsers ? (
                    // Loading skeleton rows
                    Array.from({ length: 5 }).map((_, index) => (
                      <TableRow key={`skeleton-${index}`} className="hover:bg-muted/20">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Skeleton className="w-9 h-9 rounded-full" />
                            <Skeleton className="h-4 w-32" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Skeleton className="w-3.5 h-3.5 rounded" />
                            <Skeleton className="h-4 w-40" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-8 w-36" />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Skeleton className="w-1.5 h-1.5 rounded-full" />
                            <Skeleton className="h-4 w-16" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-8 w-8 rounded" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : filteredUsers.length === 0 ? (
                    // Empty state
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        <div className="flex flex-col items-center gap-3">
                          <UsersIcon className="w-12 h-12 text-muted-foreground/30" />
                          <div>
                            <p className="text-sm text-foreground font-medium">No members found</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {searchQuery ? "Try adjusting your search" : "Invite team members to get started"}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    // User rows
                    filteredUsers.map((user) => {
                      const roleColor = getRoleColor(user.roleId);
                      
                      return (
                        <TableRow key={user.id} className="hover:bg-muted/20">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="w-9 h-9 border border-border">
                                <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                                  {user.avatar}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm text-foreground">{user.name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Mail className="w-3.5 h-3.5" />
                              {user.email}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={user.roleId.toString()}
                              onValueChange={(value) => handleChangeUserRole(user.id, parseInt(value))}
                            >
                              <SelectTrigger className="w-36 h-8 border-0 bg-transparent hover:bg-muted text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {roles.map((role) => (
                                  <SelectItem key={role.id} value={role.id.toString()}>
                                    {role.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className={`w-1.5 h-1.5 rounded-full ${user.status === 'active' ? 'bg-success' : 'bg-muted-foreground/30'}`} />
                              <span className="text-sm text-muted-foreground capitalize">{user.status}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEditMemberDialog(user)}>
                                  <UserCog className="w-4 h-4 mr-2" />
                                  Edit Details
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  className="text-destructive"
                                  onClick={() => handleRemoveUser(user.id)}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Remove Member
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </Card>
          </div>
        )}

        {/* Roles View */}
        {activeView === "roles" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{roles.length} roles defined</p>
              <Button 
                onClick={() => {
                  resetRoleDialog();
                  setRoleDialogOpen(true);
                }}
                variant="outline"
                size="sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Role
              </Button>
            </div>

            <Card className="border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead>Role</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Members</TableHead>
                    <TableHead>Permissions</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roles.map((role) => {
                    // Get first letter of role name for badge
                    const roleInitial = role.name.charAt(0).toUpperCase();
                    
                    return (
                      <TableRow key={role.id} className="hover:bg-muted/20">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg ${role.color} flex items-center justify-center`}>
                              <span className="text-sm text-white">{roleInitial}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-foreground">{role.name}</span>
                              {role.isSystem && (
                                <span className="text-xs text-muted-foreground">(System)</span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm text-muted-foreground max-w-md">{role.description}</p>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {role.count} {role.count === 1 ? 'member' : 'members'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-muted-foreground hover:text-foreground justify-start px-2"
                              onClick={() => openEditRoleDialog(role)}
                            >
                              {role.permissions.length} permissions
                            </Button>
                            {role.databaseAccess && role.databaseAccess.length > 0 && (
                              <div className="flex items-center gap-1 px-2">
                                <Database className="w-3 h-3 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">
                                  {role.databaseAccess.length} database{role.databaseAccess.length !== 1 ? 's' : ''}
                                </span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {!role.isSystem && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEditRoleDialog(role)}>
                                  <UserCog className="w-4 h-4 mr-2" />
                                  Edit Role
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  className="text-destructive"
                                  onClick={() => handleDeleteRole(role.id)}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete Role
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          </div>
        )}
      </div>

      {/* Invite Member Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Send an invitation to join your VizAI workspace
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                placeholder="John Doe"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="johndoe"
                value={inviteUsername}
                onChange={(e) => setInviteUsername(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="john.doe@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={inviteRoleId} onValueChange={setInviteRoleId}>
                <SelectTrigger id="role">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id.toString()}>
                      <div className="flex flex-col items-start">
                        <span>{role.name}</span>
                        <span className="text-xs text-muted-foreground">{role.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleInviteMember}>
              Send Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Member Dialog */}
      <Dialog open={editMemberDialogOpen} onOpenChange={setEditMemberDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Member Details</DialogTitle>
            <DialogDescription>
              Update member information
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editName">Full Name</Label>
              <Input
                id="editName"
                type="text"
                placeholder="John Doe"
                value={editUserName}
                onChange={(e) => setEditUserName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editEmail">Email Address</Label>
              <Input
                id="editEmail"
                type="email"
                placeholder="john.doe@company.com"
                value={editUserEmail}
                onChange={(e) => setEditUserEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editRole">Role</Label>
              <Select value={editUserRoleId} onValueChange={setEditUserRoleId}>
                <SelectTrigger id="editRole">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id.toString()}>
                      <div className="flex flex-col items-start">
                        <span>{role.name}</span>
                        <span className="text-xs text-muted-foreground">{role.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditMemberDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateUser}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Role Dialog */}
      <Dialog open={roleDialogOpen} onOpenChange={(open) => {
        setRoleDialogOpen(open);
        if (!open) resetRoleDialog();
      }}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingRole ? `${editingRole.name} Role` : "Create New Role"}</DialogTitle>
            <DialogDescription>
              {editingRole?.isSystem 
                ? "View role permissions (system roles cannot be modified)" 
                : editingRole 
                ? "Update role details and permissions" 
                : "Define a new role with specific permissions"
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 overflow-y-auto flex-1">
            {(!editingRole || !editingRole.isSystem) && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="roleName">Role Name</Label>
                    <Input
                      id="roleName"
                      placeholder="e.g., Data Scientist"
                      value={roleName}
                      onChange={(e) => setRoleName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="roleDescription">Description</Label>
                    <Input
                      id="roleDescription"
                      placeholder="Brief description of this role"
                      value={roleDescription}
                      onChange={(e) => setRoleDescription(e.target.value)}
                    />
                  </div>
                </div>
                <div className="border-t border-border pt-4" />
              </>
            )}
            
            {/* Permissions Section */}
            <div className="space-y-3">
              <Label className="text-base">Permissions</Label>
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(groupedPermissions).map(([category, permissions]) => (
                  <Card key={category} className="p-4 border border-border">
                    <h4 className="text-sm text-foreground mb-3">{category}</h4>
                    <div className="space-y-2.5">
                      {permissions.map((permission) => (
                        <div key={permission.id} className="flex items-start gap-2.5">
                          <Checkbox
                            id={permission.id}
                            checked={selectedPermissions.includes(permission.id)}
                            onCheckedChange={() => togglePermission(permission.id)}
                            disabled={editingRole?.isSystem}
                            className="mt-0.5"
                          />
                          <div className="flex-1">
                            <Label 
                              htmlFor={permission.id}
                              className="text-sm cursor-pointer leading-none"
                            >
                              {permission.name}
                            </Label>
                            <p className="text-xs text-muted-foreground mt-1">
                              {permission.description}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* Database & Table Access Section */}
            {(!editingRole || !editingRole.isSystem) && (
              <>
                <div className="border-t border-border pt-4" />
                <div className="space-y-3">
                  <div>
                    <Label className="text-base">Database & Table Access</Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Restrict which databases and tables this role can access. Leave unselected for full access.
                    </p>
                  </div>
                  <Card className="border border-border">
                    <div className="divide-y divide-border">
                      {mockDatabases.map((database) => {
                        const isSelected = isDatabaseSelected(database.id);
                        const isExpanded = expandedDatabases.has(database.id);
                        const dbAccess = selectedDatabaseAccess.find(db => db.databaseId === database.id);
                        const allTablesSelected = dbAccess?.tables.length === 0;
                        const someTablesSelected = dbAccess && dbAccess.tables.length > 0;

                        return (
                          <div key={database.id} className="p-4">
                            <div className="flex items-center gap-3">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleDatabase(database)}
                                className="mt-0.5"
                              />
                              <button
                                onClick={() => toggleDatabaseExpanded(database.id)}
                                className="flex items-center gap-2 flex-1 text-left hover:text-foreground transition-colors cursor-pointer"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                )}
                                <Database className="w-4 h-4 text-primary" />
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm text-foreground">{database.name}</span>
                                    {isSelected && (
                                      <Badge variant="outline" className="text-xs">
                                        {allTablesSelected ? "All tables" : `${dbAccess.tables.length} tables`}
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    {database.tables.length} tables available
                                  </p>
                                </div>
                              </button>
                            </div>

                            {/* Tables List */}
                            {isExpanded && (
                              <div className="ml-11 mt-3 space-y-2 pl-4 border-l-2 border-border">
                                {isSelected && (
                                  <div className="flex items-center gap-2 mb-2">
                                    <Checkbox
                                      checked={allTablesSelected}
                                      onCheckedChange={() => {
                                        setSelectedDatabaseAccess(selectedDatabaseAccess.map(db => 
                                          db.databaseId === database.id 
                                            ? { ...db, tables: allTablesSelected ? database.tables : [] }
                                            : db
                                        ));
                                      }}
                                    />
                                    <span className="text-xs text-muted-foreground">
                                      {allTablesSelected ? "Deselect all tables" : "Select all tables"}
                                    </span>
                                  </div>
                                )}
                                {database.tables.map((table) => (
                                  <div key={table} className="flex items-center gap-2">
                                    <Checkbox
                                      checked={isTableSelected(database.id, table)}
                                      onCheckedChange={() => toggleTable(database.id, table)}
                                      disabled={!isSelected}
                                    />
                                    <Label className={`text-sm cursor-pointer ${isSelected ? 'text-muted-foreground hover:text-foreground' : 'text-muted-foreground/50'}`}>
                                      {table}
                                    </Label>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleDialogOpen(false)}>
              {editingRole?.isSystem ? "Close" : "Cancel"}
            </Button>
            {(!editingRole || !editingRole.isSystem) && (
              <Button onClick={handleCreateOrUpdateRole}>
                {editingRole ? "Update Role" : "Create Role"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
