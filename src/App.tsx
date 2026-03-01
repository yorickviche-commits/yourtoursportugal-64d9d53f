import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/trips" element={<TripsPage />} />
          <Route path="/trips/:id" element={<TripDetailPage />} />
          <Route path="/leads" element={<LeadsFilesPage />} />
          <Route path="/leads/:id" element={<LeadDetailPage />} />
          <Route path="/approvals" element={<ApprovalsPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/crm" element={<CRMPage />} />
          <Route path="/crm/:folderId/:recordId" element={<CRMRecordDetailPage />} />
          <Route path="/payments" element={<PaymentsPage />} />
          <Route path="/agents" element={<AgentDashboardPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
