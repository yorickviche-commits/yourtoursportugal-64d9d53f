import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Settings, Save, Building2, DollarSign, Wrench } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface SettingRow {
  id: string;
  category: string;
  key: string;
  value: any;
  description: string | null;
}

const AdminSettingsPage = () => {
  const { isAdmin } = useAuth();
  const [settings, setSettings] = useState<SettingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const fetchSettings = async () => {
    setLoading(true);
    const { data } = await supabase.from('system_settings').select('*').order('category').order('key');
    setSettings((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchSettings(); }, []);

  const getDisplayValue = (setting: SettingRow) => {
    const edited = editedValues[`${setting.category}.${setting.key}`];
    if (edited !== undefined) return edited;
    const val = setting.value;
    return typeof val === 'string' ? val : JSON.stringify(val);
  };

  const handleChange = (setting: SettingRow, newValue: string) => {
    setEditedValues(prev => ({ ...prev, [`${setting.category}.${setting.key}`]: newValue }));
  };

  const saveAll = async () => {
    setSaving(true);
    const updates = Object.entries(editedValues);
    for (const [compositeKey, newValue] of updates) {
      const [category, key] = compositeKey.split('.');
      let jsonValue: any;
      try {
        jsonValue = JSON.parse(newValue);
      } catch {
        jsonValue = newValue;
      }
      await supabase.from('system_settings')
        .update({ value: jsonValue, updated_at: new Date().toISOString() } as any)
        .eq('category', category)
        .eq('key', key);
    }
    setEditedValues({});
    toast({ title: 'Definições guardadas' });
    fetchSettings();
    setSaving(false);
  };

  const byCategory = (cat: string) => settings.filter(s => s.category === cat);

  const LABELS: Record<string, string> = {
    company_name: 'Nome da Empresa',
    legal_name: 'Nome Legal',
    vat_number: 'NIF / VAT',
    address: 'Morada',
    default_currency: 'Moeda Padrão',
    default_language: 'Idioma Padrão',
    timezone: 'Fuso Horário',
    default_markup_pct: 'Markup Padrão (%)',
    b2b_commission_pct: 'Comissão B2B (%)',
    seasonal_adjustment_pct: 'Ajuste Sazonal (%)',
    market_adjustment_pct: 'Ajuste Mercado (%)',
    emergency_override_margin: 'Margem Emergência (%)',
    minimum_margin_threshold: 'Margem Mínima (%)',
    payment_plan_default: 'Plano Pagamento',
    stripe_fee_pct: 'Taxa Stripe (%)',
    vat_rate_default: 'IVA Padrão (%)',
    auto_approval_threshold: 'Auto-aprovação até (€)',
  };

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64 text-muted-foreground">Acesso restrito.</div>
      </AppLayout>
    );
  }

  const renderSettings = (category: string) => (
    <div className="grid gap-4 sm:grid-cols-2">
      {byCategory(category).map(s => (
        <div key={s.id} className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">
            {LABELS[s.key] || s.key}
          </Label>
          <Input
            value={getDisplayValue(s)}
            onChange={e => handleChange(s, e.target.value)}
            className="h-9 text-sm"
          />
          {s.description && <p className="text-[11px] text-muted-foreground">{s.description}</p>}
        </div>
      ))}
    </div>
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Definições do Sistema</h1>
          </div>
          <Button onClick={saveAll} disabled={saving || Object.keys(editedValues).length === 0}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'A guardar...' : 'Guardar Alterações'}
          </Button>
        </div>

        {loading ? (
          <p className="text-muted-foreground">A carregar...</p>
        ) : (
          <Tabs defaultValue="general" className="space-y-4">
            <TabsList>
              <TabsTrigger value="general" className="gap-1.5"><Building2 className="h-3.5 w-3.5" />Geral</TabsTrigger>
              <TabsTrigger value="pricing" className="gap-1.5"><DollarSign className="h-3.5 w-3.5" />Preços</TabsTrigger>
              <TabsTrigger value="operations" className="gap-1.5"><Wrench className="h-3.5 w-3.5" />Operações</TabsTrigger>
            </TabsList>

            <TabsContent value="general">
              <Card><CardHeader><CardTitle className="text-base">Informação Geral</CardTitle></CardHeader>
                <CardContent>{renderSettings('general')}</CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="pricing">
              <Card><CardHeader><CardTitle className="text-base">Regras de Preços Globais</CardTitle></CardHeader>
                <CardContent>{renderSettings('pricing')}</CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="operations">
              <Card><CardHeader><CardTitle className="text-base">Configurações Operacionais</CardTitle></CardHeader>
                <CardContent>{renderSettings('operations')}</CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppLayout>
  );
};

export default AdminSettingsPage;
