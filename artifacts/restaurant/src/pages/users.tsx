import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListUsers,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  getListUsersQueryKey,
  Role,
  type User as ApiUser
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, UserX, UserCheck, Pencil } from "lucide-react";
import { toast } from "sonner";

export default function Users() {
  const queryClient = useQueryClient();
  const { data: users = [], isLoading } = useListUsers({ query: { queryKey: getListUsersQueryKey() } });

  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();

  const [createOpen, setCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ApiUser | null>(null);

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>(Role.WAITER);

  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<Role>(Role.WAITER);
  const [editPassword, setEditPassword] = useState("");

  const handleCreate = () => {
    createUser.mutate({
      data: { name, password, role, active: true }
    }, {
      onSuccess: () => {
        toast.success("User created");
        setCreateOpen(false);
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        setName("");
        setPassword("");
        setRole(Role.WAITER);
      },
      onError: () => toast.error("Failed to create user")
    });
  };

  const openEdit = (user: ApiUser) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditRole(user.role as Role);
    setEditPassword("");
  };

  const handleEdit = () => {
    if (!editingUser) return;
    const data: { name?: string; role?: Role; password?: string } = {};
    if (editName !== editingUser.name) data.name = editName;
    if (editRole !== editingUser.role) data.role = editRole;
    if (editPassword.trim().length > 0) data.password = editPassword;
    if (Object.keys(data).length === 0) {
      setEditingUser(null);
      return;
    }
    updateUser.mutate({ id: editingUser.id, data }, {
      onSuccess: () => {
        toast.success("User updated");
        setEditingUser(null);
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
      },
      onError: () => toast.error("Failed to update user")
    });
  };

  const handleToggleActive = (id: number, currentActive: boolean) => {
    updateUser.mutate({
      id,
      data: { active: !currentActive }
    }, {
      onSuccess: () => {
        toast.success(`User ${!currentActive ? 'activated' : 'deactivated'}`);
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
      }
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to permanently delete this user?")) {
      deleteUser.mutate({ id }, {
        onSuccess: () => {
          toast.success("User deleted");
          queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        }
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Users</h1>
        <Button onClick={() => setCreateOpen(true)} data-testid="button-new-user">
          <Plus className="w-4 h-4 mr-2" />
          New User
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map(user => (
                <TableRow key={user.id} className={!user.active ? "opacity-50" : ""} data-testid={`row-user-${user.id}`}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>
                    <Badge variant={user.role === "ADMIN" ? "default" : user.role === "CASHIER" ? "secondary" : "outline"}>
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {user.active ? (
                      <span className="text-emerald-500 font-medium text-sm flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" /> Active
                      </span>
                    ) : (
                      <span className="text-muted-foreground font-medium text-sm flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-muted-foreground" /> Inactive
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(user)}
                      title="Edit"
                      data-testid={`button-edit-user-${user.id}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleToggleActive(user.id, user.active)}
                      title={user.active ? "Deactivate" : "Activate"}
                      data-testid={`button-toggle-user-${user.id}`}
                    >
                      {user.active ? <UserX className="w-4 h-4 text-muted-foreground" /> : <UserCheck className="w-4 h-4 text-emerald-500" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(user.id)}
                      data-testid={`button-delete-user-${user.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Username</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. jrodriguez" data-testid="input-new-username" />
            </div>

            <div className="space-y-2">
              <Label>Password</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} data-testid="input-new-password" />
            </div>

            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger data-testid="select-new-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Administrator</SelectItem>
                  <SelectItem value="CASHIER">Cashier</SelectItem>
                  <SelectItem value="WAITER">Waiter</SelectItem>
                  <SelectItem value="COCINERA">Cocinera</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!name || !password || createUser.isPending} data-testid="button-save-new-user">
              Create User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editingUser !== null} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Username</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} data-testid="input-edit-username" />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={editRole} onValueChange={(v) => setEditRole(v as Role)}>
                <SelectTrigger data-testid="select-edit-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Administrator</SelectItem>
                  <SelectItem value="CASHIER">Cashier</SelectItem>
                  <SelectItem value="WAITER">Waiter</SelectItem>
                  <SelectItem value="COCINERA">Cocinera</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>New Password (leave blank to keep current)</Label>
              <Input type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} data-testid="input-edit-password" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={!editName || updateUser.isPending} data-testid="button-save-edit-user">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
