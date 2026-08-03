import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import BrandLogo from "@/components/BrandLogo";
import { Loader2 } from "lucide-react";
import { storeAuthRedirect } from "@/lib/authRedirect";

type OAuthNamespace = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: any }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: any }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: any }>;
};

function oauth(): OAuthNamespace {
  return (supabase.auth as unknown as { oauth: OAuthNamespace }).oauth;
}

const OAuthConsentPage = () => {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) return setError("Pedido inválido: falta authorization_id.");
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        storeAuthRedirect(next);
        window.location.href = `/login?next=${encodeURIComponent(next)}`;
        return;
      }
      const { data, error: detailsError } = await oauth().getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (detailsError) return setError(detailsError.message);
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    const { data, error: decisionError } = approve
      ? await oauth().approveAuthorization(authorizationId)
      : await oauth().denyAuthorization(authorizationId);
    if (decisionError) {
      setBusy(false);
      return setError(decisionError.message);
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      return setError("O servidor de autorização não devolveu um redirecionamento.");
    }
    window.location.href = target;
  }

  const clientName = details?.client?.name ?? "a aplicação";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <BrandLogo className="mx-auto mb-3 justify-center" imageClassName="h-14 w-14" />
          <CardTitle className="text-xl font-bold text-foreground">Autorizar acesso</CardTitle>
          <CardDescription>Your Tours Portugal — Operations Center</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <p className="text-sm text-destructive">Não foi possível carregar este pedido: {error}</p>
          ) : !details ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> A carregar…
            </p>
          ) : (
            <>
              <p className="text-sm text-foreground">
                <strong>{clientName}</strong> pede acesso à plataforma em teu nome. As ferramentas vão ler e escrever
                apenas os dados a que a tua conta já tem acesso.
              </p>
              <div className="flex gap-2">
                <Button className="flex-1" disabled={busy} onClick={() => decide(true)}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Aprovar
                </Button>
                <Button variant="outline" className="flex-1" disabled={busy} onClick={() => decide(false)}>
                  Recusar
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OAuthConsentPage;
