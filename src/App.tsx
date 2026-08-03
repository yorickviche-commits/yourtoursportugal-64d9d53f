import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import { TourProvider } from "@/components/tour/TourProvider";
import TripsPage from "./pages/TripsPage";
import TripDetailPage from "./pages/TripDetailPage";
import LeadsFilesPage from "./pages/LeadsFilesPage";
import LeadDetailPage from "./pages/LeadDetailPage";
import PaymentsPage from "./pages/PaymentsPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import AuthCallbackPage from "./pages/AuthCallbackPage";
import ItineraryPreviewPage from "./pages/ItineraryPreviewPage";
import PublicProposalPage from "./pages/PublicProposalPage";
import ProposalDetailPage from "./pages/ProposalDetailPage";
import AgentControlPage from "./pages/AgentControlPage";
import QualificationAgentPage from "./pages/agents/QualificationAgentPage";
import ItineraryAgentPage from "./pages/agents/ItineraryAgentPage";
import FollowupAgentPage from "./pages/agents/FollowupAgentPage";
import SupplierAgentPage from "./pages/agents/SupplierAgentPage";
import OpsReviewAgentPage from "./pages/agents/OpsReviewAgentPage";
import MobilePage from "./pages/MobilePage";
import NotFound from "./pages/NotFound";
import Dashboard from "./pages/Dashboard";
import AIWorkOfficePage from "./pages/AIWorkOfficePage";
import ApprovalsPage from "./pages/ApprovalsPage";
import TasksPage from "./pages/TasksPage";
import CRMPage from "./pages/CRMPage";
import CRMRecordDetailPage from "./pages/CRMRecordDetailPage";
import ProposalListPage from "./pages/ProposalListPage";
import ProposalBuilderPage from "./pages/ProposalBuilderPage";
import PartnersPage from "./pages/PartnersPage";
import PartnerDetailPage from "./pages/PartnerDetailPage";
import FSEDatabasePage from "./pages/FSEDatabasePage";
import AdminSuppliersPage from "./pages/AdminSuppliersPage";
import AdminSupplierDetailPage from "./pages/AdminSupplierDetailPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import AdminPermissionsPage from "./pages/AdminPermissionsPage";
import AdminSettingsPage from "./pages/AdminSettingsPage";
import AdminIntegrationsPage from "./pages/AdminIntegrationsPage";
import AdminKPIPage from "./pages/AdminKPIPage";
import AdminActivityLogsPage from "./pages/AdminActivityLogsPage";
import AgentDashboardPage from "./pages/AgentDashboardPage";
import ProfilePage from "./pages/ProfilePage";
import CatalogPage from "./pages/CatalogPage";
import ProductsPage from "./pages/ProductsPage";
import ProductDetailPage from "./pages/ProductDetailPage";
import { BoldShortcutProvider } from "@/lib/richText";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BoldShortcutProvider />
        <BrowserRouter>
          <TourProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            <Route path="/preview/:id" element={<ItineraryPreviewPage />} />
            <Route path="/proposal/:token" element={<PublicProposalPage />} />

            <Route path="/" element={<Navigate to="/leads" replace />} />
            <Route path="/leads" element={<ProtectedRoute><LeadsFilesPage /></ProtectedRoute>} />
            <Route path="/leads/:id" element={<ProtectedRoute><LeadDetailPage /></ProtectedRoute>} />
            <Route path="/trips" element={<ProtectedRoute><TripsPage /></ProtectedRoute>} />
            <Route path="/trips/:id" element={<ProtectedRoute><TripDetailPage /></ProtectedRoute>} />
            <Route path="/bookings/:id" element={<ProtectedRoute><LeadDetailPage mode="booking" /></ProtectedRoute>} />
            <Route path="/payments" element={<ProtectedRoute><PaymentsPage /></ProtectedRoute>} />
            <Route path="/proposals/:id" element={<ProtectedRoute><ProposalDetailPage /></ProtectedRoute>} />
            <Route path="/agents" element={<ProtectedRoute><AgentControlPage /></ProtectedRoute>} />
            <Route path="/agents/qualification" element={<ProtectedRoute><QualificationAgentPage /></ProtectedRoute>} />
            <Route path="/agents/itinerary" element={<ProtectedRoute><ItineraryAgentPage /></ProtectedRoute>} />
            <Route path="/agents/followup" element={<ProtectedRoute><FollowupAgentPage /></ProtectedRoute>} />
            <Route path="/agents/supplier" element={<ProtectedRoute><SupplierAgentPage /></ProtectedRoute>} />
            <Route path="/agents/ops-review" element={<ProtectedRoute><OpsReviewAgentPage /></ProtectedRoute>} />
            <Route path="/mobile" element={<ProtectedRoute><MobilePage /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/ai-office" element={<ProtectedRoute><AIWorkOfficePage /></ProtectedRoute>} />
            <Route path="/agents/dashboard" element={<ProtectedRoute><AgentDashboardPage /></ProtectedRoute>} />
            <Route path="/approvals" element={<ProtectedRoute><ApprovalsPage /></ProtectedRoute>} />
            <Route path="/tasks" element={<ProtectedRoute><TasksPage /></ProtectedRoute>} />
            <Route path="/crm" element={<ProtectedRoute><CRMPage /></ProtectedRoute>} />
            <Route path="/crm/:folderId/:recordId" element={<ProtectedRoute><CRMRecordDetailPage /></ProtectedRoute>} />
            <Route path="/proposals" element={<ProtectedRoute><ProposalListPage /></ProtectedRoute>} />
            <Route path="/proposals/new" element={<ProtectedRoute><ProposalBuilderPage /></ProtectedRoute>} />
            <Route path="/partners" element={<ProtectedRoute><PartnersPage /></ProtectedRoute>} />
            <Route path="/partners/:id" element={<ProtectedRoute><PartnerDetailPage /></ProtectedRoute>} />
            <Route path="/comercial/matriz" element={<ProtectedRoute><FSEDatabasePage /></ProtectedRoute>} />
            <Route path="/comercial/suppliers" element={<ProtectedRoute><AdminSuppliersPage /></ProtectedRoute>} />
            <Route path="/comercial/suppliers/:id" element={<ProtectedRoute><AdminSupplierDetailPage /></ProtectedRoute>} />
            <Route path="/catalog" element={<ProtectedRoute><CatalogPage /></ProtectedRoute>} />
            <Route path="/products" element={<ProtectedRoute><ProductsPage /></ProtectedRoute>} />
            <Route path="/products/:magpieId" element={<ProtectedRoute><ProductDetailPage /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute><AdminUsersPage /></ProtectedRoute>} />
            <Route path="/admin/permissions" element={<ProtectedRoute><AdminPermissionsPage /></ProtectedRoute>} />
            <Route path="/admin/settings" element={<ProtectedRoute><AdminSettingsPage /></ProtectedRoute>} />
            <Route path="/admin/integrations" element={<ProtectedRoute><AdminIntegrationsPage /></ProtectedRoute>} />
            <Route path="/admin/kpi" element={<ProtectedRoute><AdminKPIPage /></ProtectedRoute>} />
            <Route path="/admin/logs" element={<ProtectedRoute><AdminActivityLogsPage /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
            <Route path="/profile/:userId" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />


            <Route path="*" element={<NotFound />} />
          </Routes>
          </TourProvider>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
