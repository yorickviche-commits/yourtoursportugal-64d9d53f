import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import BrandLogo from '@/components/BrandLogo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserCheck } from 'lucide-react';

const SetupAccountPage = () => {
  const navigate = useNavigate();
  const { user, profile, loading, onboardingCompleted, refreshProfile } = useAuth();
  const { toast } = useToast();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate('/login', { replace: true });
    if (!loading && user && onboardingCompleted) navigate('/leads', { replace: true });
  }, [loading, user, onboardingCompleted, navigate]);

  useEffect(() => {
    if (profile) {
      setFullName(prev => prev || profile.full_name || '');
      setPhone(prev => prev || (profile as any).phone || '');
    }
  }, [profile]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!fullName.trim()) {
      toast({ title: 'Nome obrigatório', variant: 'destructive' });
      return;
    }
    if (password.length < 8) {
      toast({ title: 'Password demasiado curta', description: 'Usa pelo menos 8 caracteres.', variant: 'destructive' });
      return;
    }
    if (password !== confirm) {
      toast({ title: 'As passwords não coincidem', variant: 'destructive' });
      return;
    }

    setSaving(true);
    const { error: passError } = await supabase.auth.updateUser({ password });
    if (passError) {
      setSaving(false);
      toast({ title: 'Erro ao definir password', description: passError.message, variant: 'destructive' });
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        status: 'active',
        onboarding_completed_at: new Date().toISOString(),
      } as any)
      .eq('id', user.id);

    setSaving(false);
    if (error) {
      toast({ title: 'Erro ao guardar dados', description: error.message, variant: 'destructive' });
      return;
    }

    await refreshProfile();
    toast({ title: 'Conta configurada', description: 'Bem-vindo à plataforma Your Tours.' });
    navigate('/leads', { replace: true });
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md space-y-6">
        <BrandLogo className="justify-center" imageClassName="h-14 w-14" />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserCheck className="h-5 w-5 text-primary" /> Concluir registo
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Confirma os teus dados e define uma password para poderes também entrar por email/password.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input value={user?.email || ''} disabled />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fullName">Nome completo</Label>
                <Input id="fullName" value={fullName} onChange={e => setFullName(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Telefone</Label>
                <Input id="phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+351 ..." />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirmar password</Label>
                <Input id="confirm" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Concluir e entrar
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default SetupAccountPage;
