import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ShieldCheck, Save } from 'lucide-react';

const ROLES = ['super_admin', 'admin', 'sales_agent', 'operations_agent', 'finance', 'b2b_manager', 'viewer'] as const;
const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin', admin: 'Admin', sales_agent: 'Sales', operations_agent: 'Operations',
  finance: 'Finance', b2b_manager: 'B2B', viewer: 'Viewer',
};

const PERMISSIONS = [
  'create_proposal', 'approve_proposal', 'create_wetravel_draft', 'edit_pricing',
  'access_financial_reports', 'export_data', 'modify_settings', 'manage_users',
];

const PERM_LABELS: Record<string, string> = {
  create_proposal: 'Criar Proposta', approve_proposal: 'Aprovar Proposta',
  create_wetravel_draft: 'WeTravel Draft', edit_pricing: 'Editar Preços',
  access_financial_reports: 'Relatórios Financeiros', export_data: 'Exportar Dados',
  modify_settings: 'Modificar Definições', manage_users: 'Gerir Utilizadores',
};

interface PermRow {
  id: string;
  role: string;
  permission: string;
  granted: boolean;
}

const AdminPermissionsPage = () => {
  const { isAdmin } = useAuth();
  const [perms, setPerms] = useState<PermRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [changes, setChanges] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchPerms = async () => {
    setLoading(true);
    const { data } = await supabase.from('permissions').select('*');
    setPerms((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchPerms(); }, []);

  const isGranted = (role: string, perm: string) => {
    const key = `${role}.${perm}`;
    if (changes[key] !== undefined) return changes[key];
    const row = perms.find(p => p.role === role && p.permission === perm);
    return row ? row.granted : false;
  };

  const toggle = (role: string, perm: string) => {
    const key = `${role}.${perm}`;
    setChanges(prev => ({ ...prev, [key]: !isGranted(role, perm) }));
  };

  const saveAll = async () => {
    setSaving(true);
    for (const [key, granted] of Object.entries(changes)) {
      const [role, permission] = key.split('.');
      const existing = perms.find(p => p.role === role && p.permission === permission);
      if (existing) {
        await supabase.from('permissions').update({ granted } as any).eq('id', existing.id);
      } else {
        await supabase.from('permissions').insert({ role: role as any, permission, granted } as any);
      }
    }
    setChanges({});
    toast({ title: 'Permissões guardadas' });
    fetchPerms();
    setSaving(false);
  };

  if (!isAdmin) {
    return <AppLayout><div className="flex items-center justify-center h-64 text-muted-foreground">Acesso restrito.</div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Matriz de Permissões</h1>
          </div>
          <Button onClick={saveAll} disabled={saving || Object.keys(changes).length === 0}>
            <Save className="h-4 w-4 mr-2" />{saving ? 'A guardar...' : 'Guardar'}
          </Button>
        </div>

        {loading ? (
          <p className="text-muted-foreground">A carregar...</p>
        ) : (
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-medium text-muted-foreground sticky left-0 bg-card">Permissão</th>
                    {ROLES.map(r => (
                      <th key={r} className="p-3 text-center font-medium text-muted-foreground text-xs">{ROLE_LABELS[r]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PERMISSIONS.map(perm => (
                    <tr key={perm} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3 font-medium sticky left-0 bg-card">{PERM_LABELS[perm] || perm}</td>
                      {ROLES.map(role => (
                        <td key={role} className="p-3 text-center">
                          <Checkbox
                            checked={isGranted(role, perm)}
                            onCheckedChange={() => toggle(role, perm)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
};

export default AdminPermissionsPage;
