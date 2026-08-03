import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { consumeAuthRedirect } from '@/lib/authRedirect';
import BrandLogo from '@/components/BrandLogo';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const AUTH_TIMEOUT_MS = 12_000;

const AuthCallbackPage = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let completed = false;

    const finish = async () => {
      if (completed) return;

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (!active || completed) return;
      if (sessionError) {
        setError('Não foi possível recuperar a sessão Google. Tenta novamente.');
        return;
      }
      if (!sessionData.session) return;

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (!active || completed) return;
      if (userError || !userData.user) {
        setError('A sessão Google não pôde ser validada. Tenta novamente.');
        return;
      }

      completed = true;
      navigate(consumeAuthRedirect(), { replace: true });
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
        window.setTimeout(() => void finish(), 0);
      }
    });

    void finish();
    const timeout = window.setTimeout(() => {
      if (active && !completed) {
        setError('O Google concluiu o acesso, mas a sessão não chegou à aplicação. Tenta novamente.');
      }
    }, AUTH_TIMEOUT_MS);

    return () => {
      active = false;
      window.clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <BrandLogo className="justify-center" imageClassName="h-16 w-16" />
        {error ? (
          <>
            <Alert variant="destructive" className="text-left">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Não foi possível concluir o acesso</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <Button onClick={() => navigate('/login', { replace: true })}>Voltar ao login</Button>
          </>
        ) : (
          <div className="space-y-3">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
            <h1 className="text-lg font-semibold text-foreground">A concluir o acesso Google…</h1>
          </div>
        )}
      </div>
    </main>
  );
};

export default AuthCallbackPage;