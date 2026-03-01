import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart3, Users, Wrench, DollarSign, Handshake, TrendingUp, Clock, CheckCircle, AlertTriangle, FileText } from 'lucide-react';

const KPICard = ({ icon: Icon, label, value, change, variant = 'default' }: {
  icon: React.ElementType; label: string; value: string; change?: string;
  variant?: 'default' | 'success' | 'warning' | 'urgent';
}) => {
  const variantStyles = {
    default: 'border-border', success: 'border-success/30', warning: 'border-warning/30', urgent: 'border-destructive/30',
  };
  return (
    <Card className={`${variantStyles[variant]}`}>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {change && <p className="text-xs text-success mt-0.5">{change}</p>}
          </div>
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
};

const AdminKPIPage = () => {
  const { isAdmin } = useAuth();
  const [period, setPeriod] = useState('30d');

  if (!isAdmin) {
    return <AppLayout><div className="flex items-center justify-center h-64 text-muted-foreground">Acesso restrito.</div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Agent KPIs</h1>
          </div>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="90d">Últimos 90 dias</SelectItem>
              <SelectItem value="year">Este ano</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Tabs defaultValue="sales" className="space-y-4">
          <TabsList>
            <TabsTrigger value="sales" className="gap-1.5"><Users className="h-3.5 w-3.5" />Sales</TabsTrigger>
            <TabsTrigger value="operations" className="gap-1.5"><Wrench className="h-3.5 w-3.5" />Operations</TabsTrigger>
            <TabsTrigger value="finance" className="gap-1.5"><DollarSign className="h-3.5 w-3.5" />Finance</TabsTrigger>
            <TabsTrigger value="b2b" className="gap-1.5"><Handshake className="h-3.5 w-3.5" />B2B</TabsTrigger>
          </TabsList>

          <TabsContent value="sales">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <KPICard icon={Users} label="Leads Recebidos" value="—" variant="default" />
              <KPICard icon={TrendingUp} label="Leads Convertidos" value="—" variant="success" />
              <KPICard icon={Clock} label="Tempo Médio Resposta" value="—" variant="default" />
              <KPICard icon={DollarSign} label="Revenue Gerado" value="—" variant="success" />
              <KPICard icon={TrendingUp} label="Taxa Conversão" value="—" variant="default" />
              <KPICard icon={CheckCircle} label="Aprovação Propostas" value="—" variant="default" />
            </div>
            <p className="text-xs text-muted-foreground mt-4 text-center">
              KPIs serão calculados dinamicamente quando os dados de produção estiverem disponíveis.
            </p>
          </TabsContent>

          <TabsContent value="operations">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <KPICard icon={FileText} label="Trips Criados" value="—" variant="default" />
              <KPICard icon={AlertTriangle} label="Erros Sinalizados" value="—" variant="urgent" />
              <KPICard icon={CheckCircle} label="Drafts WeTravel" value="—" variant="default" />
              <KPICard icon={DollarSign} label="Desvios Custo Operacional" value="—" variant="warning" />
            </div>
            <p className="text-xs text-muted-foreground mt-4 text-center">
              KPIs serão calculados dinamicamente quando os dados de produção estiverem disponíveis.
            </p>
          </TabsContent>

          <TabsContent value="finance">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <KPICard icon={DollarSign} label="Revenue Cobrado" value="—" variant="success" />
              <KPICard icon={Clock} label="Pagamentos Pendentes" value="—" variant="warning" />
              <KPICard icon={CheckCircle} label="Stripe Links Gerados" value="—" variant="default" />
              <KPICard icon={AlertTriangle} label="Reembolsos" value="—" variant="urgent" />
            </div>
            <p className="text-xs text-muted-foreground mt-4 text-center">
              KPIs serão calculados dinamicamente quando os dados de produção estiverem disponíveis.
            </p>
          </TabsContent>

          <TabsContent value="b2b">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <KPICard icon={Handshake} label="Parceiros Onboarded" value="—" variant="default" />
              <KPICard icon={CheckCircle} label="Deals Fechados" value="—" variant="success" />
              <KPICard icon={DollarSign} label="Valor Médio Deal" value="—" variant="default" />
            </div>
            <p className="text-xs text-muted-foreground mt-4 text-center">
              KPIs serão calculados dinamicamente quando os dados de produção estiverem disponíveis.
            </p>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default AdminKPIPage;
