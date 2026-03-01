import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Shield, UserPlus, Trash2 } from 'lucide-react';

const ROLES = ['super_admin', 'admin', 'sales_agent', 'operations_agent', 'finance', 'b2b_manager', 'viewer'] as const;

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  sales_agent: 'Sales Agent',
  operations_agent: 'Operations Agent',
  finance: 'Finance',
  b2b_manager: 'B2B Manager',
  viewer: 'Viewer',
};

const ROLE_COLORS: Record<string, string> = {
  super_admin: 'bg-destructive text-destructive-foreground',
  admin: 'bg-primary text-primary-foreground',
  sales_agent: 'bg-chart-1/20 text-foreground',
  operations_agent: 'bg-chart-2/20 text-foreground',
  finance: 'bg-warning/20 text-foreground',
  b2b_manager: 'bg-success/20 text-foreground',
  viewer: 'bg-muted text-muted-foreground',
};

interface UserWithRoles {
  id: string;
  full_name: string | null;
  email: string | null;
  status: string;
  created_at: string;
  roles: string[];
}

const AdminUsersPage = () => {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const { toast } = useToast();

  const fetchUsers = async () => {
    setLoading(true);
    const { data: profiles } = await supabase.from('profiles').select('*');
    const { data: allRoles } = await supabase.from('user_roles').select('*');

    const merged = (profiles || []).map((p: any) => ({
      id: p.id,
      full_name: p.full_name,
      email: p.email,
      status: p.status,
      created_at: p.created_at,
      roles: (allRoles || []).filter((r: any) => r.user_id === p.id).map((r: any) => r.role),
    }));

    setUsers(merged);
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const addRole = async (userId: string, role: string) => {
    const { error } = await supabase.from('user_roles').insert({ user_id: userId, role: role as any });
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Role adicionada' });
      fetchUsers();
    }
  };

  const removeRole = async (userId: string, role: string) => {
    const { error } = await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', role as any);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Role removida' });
      fetchUsers();
    }
  };

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          Acesso restrito a administradores.
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Gestão de Utilizadores</h1>
        </div>

        <div className="grid gap-4">
          {loading ? (
            <p className="text-muted-foreground">A carregar...</p>
          ) : users.length === 0 ? (
            <p className="text-muted-foreground">Nenhum utilizador encontrado.</p>
          ) : (
            users.map(user => (
              <Card key={user.id}>
                <CardContent className="pt-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold text-foreground">{user.full_name || 'Sem nome'}</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Status: <span className={user.status === 'active' ? 'text-green-600' : 'text-destructive'}>{user.status}</span>
                      </p>
                    </div>

                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap gap-1">
                        {user.roles.length === 0 && (
                          <span className="text-xs text-muted-foreground">Sem roles</span>
                        )}
                        {user.roles.map(role => (
                          <Badge key={role} className={`${ROLE_COLORS[role] || ''} text-xs`}>
                            {ROLE_LABELS[role] || role}
                            <button onClick={() => removeRole(user.id, role)} className="ml-1 hover:text-destructive">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>

                      <div className="flex gap-2">
                        <Select value={selectedRole} onValueChange={setSelectedRole}>
                          <SelectTrigger className="w-[160px] h-8 text-xs">
                            <SelectValue placeholder="Adicionar role" />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLES.filter(r => !user.roles.includes(r)).map(r => (
                              <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (selectedRole) {
                              addRole(user.id, selectedRole);
                              setSelectedRole('');
                            }
                          }}
                          disabled={!selectedRole}
                        >
                          <UserPlus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default AdminUsersPage;
