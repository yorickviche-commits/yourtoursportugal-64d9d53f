import { ReactNode, useState } from 'react';
import AppSidebar from './AppSidebar';
import NewLeadDialog, { NewLeadFAB } from './NewLeadDialog';
import { useIsMobile } from '@/hooks/use-mobile';
import BrandLogo from './BrandLogo';
import TourLauncher from './tour/TourLauncher';
import AssistantLauncher from './assistant/AssistantLauncher';
import FeedbackLauncher from './feedback/FeedbackLauncher';

const AppLayout = ({ children }: { children: ReactNode }) => {
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const isMobile = useIsMobile();

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <main className={
        isMobile
          ? "mobile-app-main p-4 max-w-full min-w-0"
          : "ml-[56px] p-6 pb-28 max-w-[1400px] transition-all duration-200"
      }>
        <div className="mb-4 hidden justify-end md:flex">
          <BrandLogo imageClassName="h-8 w-8" className="opacity-80" />
        </div>
        {children}
      </main>
      <div className="hidden md:contents">
        <NewLeadFAB onClick={() => setNewLeadOpen(true)} />
        <TourLauncher />
        <AssistantLauncher />
        <FeedbackLauncher />
      </div>
      <NewLeadDialog open={newLeadOpen} onOpenChange={setNewLeadOpen} />
    </div>
  );
};

export default AppLayout;
