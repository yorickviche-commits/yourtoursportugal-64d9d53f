import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import TripsPage from "./pages/TripsPage";
import TripDetailPage from "./pages/TripDetailPage";
import ApprovalsPage from "./pages/ApprovalsPage";
import LeadsFilesPage from "./pages/LeadsFilesPage";
import LeadDetailPage from "./pages/LeadDetailPage";
import CRMPage from "./pages/CRMPage";
import CRMRecordDetailPage from "./pages/CRMRecordDetailPage";
import PaymentsPage from "./pages/PaymentsPage";
import TasksPage from "./pages/TasksPage";
import AgentDashboardPage from "./pages/AgentDashboardPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import AdminSettingsPage from "./pages/AdminSettingsPage";
import AdminActivityLogsPage from "./pages/AdminActivityLogsPage";
import AdminPermissionsPage from "./pages/AdminPermissionsPage";
import AdminSuppliersPage from "./pages/AdminSuppliersPage";
import AdminIntegrationsPage from "./pages/AdminIntegrationsPage";
import AdminKPIPage from "./pages/AdminKPIPage";
import AdminSupplierDetailPage from "./pages/AdminSupplierDetailPage";
import PartnersPage from "./pages/PartnersPage";
import PartnerDetailPage from "./pages/PartnerDetailPage";
import ItineraryPreviewPage from "./pages/ItineraryPreviewPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/preview/:id" element={<ItineraryPreviewPage />} />

            {/* Protected routes */}
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/trips" element={<ProtectedRoute><TripsPage /></ProtectedRoute>} />
            <Route path="/trips/:id" element={<ProtectedRoute><TripDetailPage /></ProtectedRoute>} />
            <Route path="/leads" element={<ProtectedRoute><LeadsFilesPage /></ProtectedRoute>} />
            <Route path="/leads/:id" element={<ProtectedRoute><LeadDetailPage /></ProtectedRoute>} />
            <Route path="/approvals" element={<ProtectedRoute><ApprovalsPage /></ProtectedRoute>} />
            <Route path="/tasks" element={<ProtectedRoute><TasksPage /></ProtectedRoute>} />
            <Route path="/crm" element={<ProtectedRoute><CRMPage /></ProtectedRoute>} />
            <Route path="/crm/:folderId/:recordId" element={<ProtectedRoute><CRMRecordDetailPage /></ProtectedRoute>} />
            <Route path="/payments" element={<ProtectedRoute><PaymentsPage /></ProtectedRoute>} />
            <Route path="/agents" element={<ProtectedRoute><AgentDashboardPage /></ProtectedRoute>} />

            {/* Admin routes */}
            <Route path="/admin/users" element={<ProtectedRoute adminOnly><AdminUsersPage /></ProtectedRoute>} />
            <Route path="/admin/settings" element={<ProtectedRoute adminOnly><AdminSettingsPage /></ProtectedRoute>} />
            <Route path="/admin/logs" element={<ProtectedRoute adminOnly><AdminActivityLogsPage /></ProtectedRoute>} />
            <Route path="/admin/permissions" element={<ProtectedRoute adminOnly><AdminPermissionsPage /></ProtectedRoute>} />
            <Route path="/admin/suppliers" element={<ProtectedRoute adminOnly><AdminSuppliersPage /></ProtectedRoute>} />
            <Route path="/admin/suppliers/:id" element={<ProtectedRoute adminOnly><AdminSupplierDetailPage /></ProtectedRoute>} />
            <Route path="/admin/partners" element={<ProtectedRoute adminOnly><PartnersPage /></ProtectedRoute>} />
            <Route path="/admin/partners/:id" element={<ProtectedRoute adminOnly><PartnerDetailPage /></ProtectedRoute>} />
            <Route path="/admin/integrations" element={<ProtectedRoute adminOnly><AdminIntegrationsPage /></ProtectedRoute>} />
            <Route path="/admin/kpis" element={<ProtectedRoute adminOnly><AdminKPIPage /></ProtectedRoute>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
