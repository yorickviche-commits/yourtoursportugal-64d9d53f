import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Shield, UserPlus, UserX, Mail, RefreshCw, X, Plus, Pencil, Trash2, ShieldCheck } from 'lucide-react';
import {
  useAppRoles, useInvites, useSendInvite, useCancelInvite, useSetUserRole,
  useCreateRole, useUpdateRole, useDeleteRole,
} from '@/hooks/useUserAdmin';

interface UserWithRoles {
  id: string;
  full_name: string | null;
  email: string | null;
  status: string;
  onboarding_completed_at: string | null;
  created_at: string;
  roles: string[];
}

const AdminUsersPage = () => {
  const { isAdmin, user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const { data: appRoles } = useAppRoles();
  const { data: invites } = useInvites();
  const sendInvite = useSendInvite();
  const cancelInvite = useCancelInvite();
  const setUserRole = useSetUserRole();
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();
  const deleteRole = useDeleteRole();

  const roleLabels = useMemo(
    () => Object.fromEntries((appRoles || []).map(r => [r.code, r.label])) as Record<string, string>,
    [appRoles],
  );

  // Convite
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');

  // Roles
  const [newRoleLabel, setNewRoleLabel] = useState('');
  const [editingRole, setEditingRole] = useState<{ code: string; label: string } | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    const { data: profiles } = await supabase.from('profiles').select('*');
    const { data: allRoles } = await supabase.from('user_roles').select('*');
    const { data: customRoles } = await supabase.from('user_custom_roles' as any).select('*');

    const merged = (profiles || []).map((p: any) => ({
      id: p.id,
      full_name: p.full_name,
      email: p.email,
      status: p.status,
      onboarding_completed_at: p.onboarding_completed_at ?? null,
      created_at: p.created_at,
      roles: [
        ...(allRoles || []).filter((r: any) => r.user_id === p.id).map((r: any) => r.role as string),
        ...((customRoles as any[]) || []).filter((r: any) => r.user_id === p.id).map((r: any) => r.role_code as string),
      ],
    }));

    setUsers(merged);
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const primaryRole = (u: UserWithRoles) => {
    const custom = u.roles.find(r => !!appRoles?.find(ar => ar.code === r && !ar.is_system));
    return custom || u.roles[0] || '';
  };

  const changeRole = async (userId: string, role: string) => {
    try {
      await setUserRole.mutateAsync({ userId, role });
      toast({ title: 'Role atualizada' });
      fetchUsers();
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
  };

  const toggleStatus = async (userId: string, current: string) => {
    const next = current === 'active' ? 'inactive' : 'active';
    const { error } = await supabase.from('profiles').update({ status: next } as any).eq('id', userId);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: `Utilizador ${next === 'active' ? 'ativado' : 'desativado'}` });
      fetchUsers();
    }
  };

  const deleteUser = async (userId: string, name: string) => {
    if (userId === currentUser?.id) {
      toast({ title: 'Ação bloqueada', description: 'Não podes eliminar o teu próprio utilizador.', variant: 'destructive' });
      return;
    }
    if (!window.confirm(`Eliminar ${name}? Esta ação remove o perfil e as roles do utilizador.`)) return;

    await supabase.from('user_custom_roles' as any).delete().eq('user_id', userId);
    const { error: rolesError } = await supabase.from('user_roles').delete().eq('user_id', userId);
    if (rolesError) {
      toast({ title: 'Erro ao remover acessos', description: rolesError.message, variant: 'destructive' });
      return;
    }

    const { data: deletedProfile, error: profileError } = await supabase
      .from('profiles').delete().eq('id', userId).select('id').maybeSingle();

    if (profileError) {
      toast({ title: 'Erro ao eliminar utilizador', description: profileError.message, variant: 'destructive' });
    } else if (!deletedProfile) {
      toast({ title: 'Utilizador não eliminado', description: 'A base de dados não confirmou a remoção do perfil.', variant: 'destructive' });
    } else {
      setUsers(prev => prev.filter(u => u.id !== userId));
      toast({ title: 'Utilizador eliminado' });
    }
  };

  const submitInvite = async () => {
    try {
      const res = await sendInvite.mutateAsync({ email: inviteEmail.trim(), role: inviteRole });
      toast({
        title: res?.emailSent ? 'Convite enviado' : 'Convite criado',
        description: res?.emailSent ? `Email enviado para ${inviteEmail}.` : (res as any)?.warning || 'Convite pendente criado.',
      });
      setInviteOpen(false);
      setInviteEmail('');
      setInviteRole('viewer');
    } catch (e: any) {
      toast({ title: 'Erro ao convidar', description: e.message, variant: 'destructive' });
    }
  };

  const resend = async (email: string, role: string) => {
    try {
      await sendInvite.mutateAsync({ email, role });
      toast({ title: 'Convite reenviado' });
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Gestão de Utilizadores</h1>
          </div>

          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button><UserPlus className="h-4 w-4 mr-2" /> Adicionar utilizador</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>Convidar utilizador</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="inviteEmail">Email</Label>
                  <Input
                    id="inviteEmail"
                    type="email"
                    placeholder="nome@yourtours.pt"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Role</Label>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(appRoles || []).map(r => (
                        <SelectItem key={r.code} value={r.code}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">
                  A pessoa recebe um email com o link para entrar com a conta Google e concluir o registo.
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancelar</Button>
                <Button onClick={submitInvite} disabled={!inviteEmail.trim() || sendInvite.isPending}>
                  <Mail className="h-4 w-4 mr-2" /> Enviar convite
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Convites pendentes */}
        {(invites || []).length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Convites pendentes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(invites || []).map(inv => (
                <div key={inv.id} className="flex flex-wrap items-center justify-between gap-2 border-b last:border-0 pb-2 last:pb-0">
                  <div>
                    <p className="text-sm font-medium">{inv.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {roleLabels[inv.role_code] || inv.role_code} · válido até {new Date(inv.expires_at).toLocaleDateString('pt-PT')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">Pendente</Badge>
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => resend(inv.email, inv.role_code)}>
                      <RefreshCw className="h-3 w-3 mr-1" /> Reenviar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={async () => {
                        await cancelInvite.mutateAsync(inv.id);
                        toast({ title: 'Convite cancelado' });
                      }}
                    >
                      <X className="h-3 w-3 mr-1" /> Cancelar
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Utilizadores */}
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
                      <div className="flex items-center gap-3 mt-2">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={user.status === 'active'}
                            onCheckedChange={() => toggleStatus(user.id, user.status)}
                          />
                          <span className={`text-xs ${user.status === 'active' ? 'text-green-600' : 'text-destructive'}`}>
                            {user.status === 'active' ? 'Ativo' : 'Inativo'}
                          </span>
                        </div>
                        {!user.onboarding_completed_at && (
                          <Badge variant="outline" className="text-xs">Registo incompleto</Badge>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => deleteUser(user.id, user.full_name || user.email || 'utilizador')}
                        >
                          <UserX className="h-3 w-3 mr-1" /> Eliminar
                        </Button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 sm:items-end">
                      <div className="flex flex-wrap gap-1">
                        {user.roles.length === 0 ? (
                          <span className="text-xs text-muted-foreground">Sem roles</span>
                        ) : (
                          user.roles.map(role => (
                            <Badge key={role} variant="secondary" className="text-xs">
                              {roleLabels[role] || role}
                            </Badge>
                          ))
                        )}
                      </div>
                      <Select value={primaryRole(user)} onValueChange={value => changeRole(user.id, value)}>
                        <SelectTrigger className="w-[190px] h-8 text-xs">
                          <SelectValue placeholder="Alterar role" />
                        </SelectTrigger>
                        <SelectContent>
                          {(appRoles || []).map(r => (
                            <SelectItem key={r.code} value={r.code}>{r.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Gestão de roles */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" /> Roles
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Os roles criados aqui aparecem automaticamente como coluna na Matriz de Permissões.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Input
                className="w-56 h-9"
                placeholder="Nome do novo role"
                value={newRoleLabel}
                onChange={e => setNewRoleLabel(e.target.value)}
              />
              <Button
                size="sm"
                variant="outline"
                disabled={!newRoleLabel.trim() || createRole.isPending}
                onClick={async () => {
                  try {
                    await createRole.mutateAsync({ label: newRoleLabel });
                    setNewRoleLabel('');
                    toast({ title: 'Role criado' });
                  } catch (e: any) {
                    toast({ title: 'Erro', description: e.message, variant: 'destructive' });
                  }
                }}
              >
                <Plus className="h-3 w-3 mr-1" /> Criar role
              </Button>
            </div>

            <div className="divide-y">
              {(appRoles || []).map(r => (
                <div key={r.code} className="flex items-center justify-between gap-2 py-2">
                  {editingRole?.code === r.code ? (
                    <>
                      <Input
                        className="h-8 w-56"
                        value={editingRole.label}
                        onChange={e => setEditingRole({ code: r.code, label: e.target.value })}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="h-7"
                          onClick={async () => {
                            await updateRole.mutateAsync({ code: r.code, label: editingRole!.label });
                            setEditingRole(null);
                            toast({ title: 'Role atualizado' });
                          }}
                        >
                          Guardar
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditingRole(null)}>Cancelar</Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-sm">
                        {r.label}
                        <span className="ml-2 text-[10px] text-muted-foreground">{r.code}</span>
                        {r.is_system && <Badge variant="outline" className="ml-2 text-[10px]">sistema</Badge>}
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditingRole({ code: r.code, label: r.label })}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        {!r.is_system && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={async () => {
                              if (!window.confirm(`Eliminar o role "${r.label}"?`)) return;
                              await deleteRole.mutateAsync(r.code);
                              toast({ title: 'Role eliminado' });
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default AdminUsersPage;
