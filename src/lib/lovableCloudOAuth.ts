import { supabase } from '@/integrations/supabase/client';

type OAuthProvider = 'google' | 'apple';

const OAUTH_MESSAGE_TYPE = 'authorization_response';
const SUPPORTED_OAUTH_ORIGINS = ['https://oauth.lovable.app', 'https://lovable.dev'];

const generateState = () => {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    return [...crypto.getRandomValues(new Uint8Array(16))]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  return `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
};

export const signInWithLovableOAuthPopup = async (provider: OAuthProvider) => {
  const state = generateState();
  const params = new URLSearchParams({
    provider,
    redirect_uri: window.location.origin,
    response_mode: 'web_message',
    state,
  });

  if (provider === 'google') {
    params.set('prompt', 'select_account');
  }

  const authUrl = `/~oauth/initiate?${params.toString()}`;
  const width = Math.min(520, window.outerWidth || 520);
  const height = Math.min(720, window.outerHeight || 720);
  const left = Math.max(0, (window.screenX || 0) + ((window.outerWidth || width) - width) / 2);
  const top = Math.max(0, (window.screenY || 0) + ((window.outerHeight || height) - height) / 2);
  const popup = window.open(authUrl, 'oauth', `width=${width},height=${height},left=${left},top=${top}`);

  if (!popup) {
    window.location.href = authUrl;
    return { redirected: true, error: null } as const;
  }

  try {
    const response = await new Promise<any>((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        cleanup();
        reject(new Error('Tempo esgotado no login Google. Tenta novamente.'));
      }, 120000);

      const popupCheckId = window.setInterval(() => {
        if (popup.closed) {
          cleanup();
          reject(new Error('Login Google cancelado.'));
        }
      }, 500);

      const cleanup = () => {
        window.clearTimeout(timeoutId);
        window.clearInterval(popupCheckId);
        window.removeEventListener('message', onMessage);
      };

      const onMessage = (event: MessageEvent) => {
        if (!SUPPORTED_OAUTH_ORIGINS.includes(event.origin)) return;
        if (!event.data || event.data.type !== OAUTH_MESSAGE_TYPE) return;

        cleanup();
        resolve(event.data.response);
      };

      window.addEventListener('message', onMessage);
    });

    popup.close();

    if (response.state !== state) {
      throw new Error('Sessão Google inválida. Tenta novamente.');
    }

    if (response.error) {
      throw new Error(response.error_description || response.error || 'Falha no login Google.');
    }

    if (!response.access_token || !response.refresh_token) {
      throw new Error('O Google autenticou, mas a sessão não chegou à app.');
    }

    const { error } = await supabase.auth.setSession({
      access_token: response.access_token,
      refresh_token: response.refresh_token,
    });

    if (error) throw error;

    return { redirected: false, error: null } as const;
  } catch (error) {
    popup.close();
    return { redirected: false, error: error instanceof Error ? error : new Error(String(error)) } as const;
  }
};