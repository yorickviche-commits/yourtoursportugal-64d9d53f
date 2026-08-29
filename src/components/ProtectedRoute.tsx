import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePagePermissions } from '@/hooks/usePagePermissions';
import { resolvePageKey } from '@/lib/pagePermissions';
import { Loader2, ShieldAlert } from 'lucide-react';
import BrandLogo from './BrandLogo';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string;
  adminOnly?: boolean;
}

const ProtectedRoute = ({ children, adminOnly = false }: ProtectedRouteProps) => {
  const { user, loading, isAdmin, profileLoaded, onboardingCompleted } = useAuth();
  const { canAccess, loading: permLoading } = usePagePermissions();
  const location = useLocation();

  if (loading || (user && !profileLoaded)) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background">
        <BrandLogo imageClassName="h-14 w-14" />
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;

  // Onboarding obrigatório para contas novas (definir password + dados).
  if (profileLoaded && !onboardingCompleted && location.pathname !== '/setup-account') {
    return <Navigate to="/setup-account" replace />;
  }

  if (adminOnly && !isAdmin) return <Navigate to="/" replace />;

  // Enforce page-level permissions matrix (skips admins).
  const pageKey = resolvePageKey(location.pathname);
  if (pageKey && !permLoading && !canAccess(pageKey)) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-background p-6 text-center">
        <ShieldAlert className="h-10 w-10 text-destructive" />
        <h1 className="text-lg font-semibold">Sem acesso a esta página</h1>
        <p className="text-sm text-muted-foreground max-w-md">
          O teu papel atual não tem permissão para <code className="bg-muted px-1 rounded">{location.pathname}</code>.
          Pede a um administrador para atualizar as permissões em <strong>Administração › Permissões</strong>.
        </p>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
