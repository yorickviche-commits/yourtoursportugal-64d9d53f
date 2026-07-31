import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';

import { useToast } from '@/hooks/use-toast';

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
    <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1S8.7 6 12 6c1.9 0 3.1.8 3.9 1.5l2.6-2.5C16.9 3.6 14.7 2.7 12 2.7 6.9 2.7 2.8 6.8 2.8 12s4.1 9.3 9.2 9.3c5.3 0 8.8-3.7 8.8-9 0-.6-.1-1.1-.2-1.6H12z"/>
  </svg>
);

const GoogleSignInButton = ({ label = 'Continuar com Google' }: { label?: string }) => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleGoogle = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth('google', {
      redirect_uri: window.location.origin,
      extraParams: { prompt: 'select_account' },
    });


    if (result.error) {
      setLoading(false);
      toast({ title: 'Erro Google', description: result.error.message, variant: 'destructive' });
      return;
    }

    if (result.redirected) return;

    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
      setLoading(false);
      toast({
        title: 'Sessão Google não guardada',
        description: 'A autenticação abriu corretamente, mas a sessão não ficou ativa. Tenta novamente.',
        variant: 'destructive',
      });
      return;
    }

    const stored = sessionStorage.getItem('postAuthRedirect');
    if (stored) sessionStorage.removeItem('postAuthRedirect');
    window.location.replace(stored || '/leads');
  };

  return (
    <Button type="button" variant="outline" className="w-full" onClick={handleGoogle} disabled={loading}>
      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GoogleIcon />}
      {label}
    </Button>
  );
};

export default GoogleSignInButton;
