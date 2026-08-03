const DEFAULT_AUTH_REDIRECT = '/leads';
const POST_AUTH_REDIRECT_KEY = 'postAuthRedirect';

export function sanitizeAuthRedirect(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return DEFAULT_AUTH_REDIRECT;

  try {
    const parsed = new URL(value, window.location.origin);
    if (parsed.origin !== window.location.origin || parsed.pathname === '/login' || parsed.pathname === '/signup') {
      return DEFAULT_AUTH_REDIRECT;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return DEFAULT_AUTH_REDIRECT;
  }
}

export function storeAuthRedirect(value: string | null | undefined) {
  sessionStorage.setItem(POST_AUTH_REDIRECT_KEY, sanitizeAuthRedirect(value));
}

export function consumeAuthRedirect(): string {
  const target = sanitizeAuthRedirect(sessionStorage.getItem(POST_AUTH_REDIRECT_KEY));
  sessionStorage.removeItem(POST_AUTH_REDIRECT_KEY);
  return target;
}

export function getAuthCallbackUrl(): string {
  return `${window.location.origin}/auth/callback`;
}