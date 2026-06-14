import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import TripsPage from "./pages/TripsPage";
import TripDetailPage from "./pages/TripDetailPage";
import LeadsFilesPage from "./pages/LeadsFilesPage";
import LeadDetailPage from "./pages/LeadDetailPage";
import PaymentsPage from "./pages/PaymentsPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
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

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
