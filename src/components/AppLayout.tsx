import { ReactNode, useState } from 'react';
import AppSidebar from './AppSidebar';
import NewLeadDialog, { NewLeadFAB } from './NewLeadDialog';
import { useIsMobile } from '@/hooks/use-mobile';
import BrandLogo from './BrandLogo';
import TourLauncher from './tour/TourLauncher';
import AssistantLauncher from './assistant/AssistantLauncher';

const AppLayout = ({ children }: { children: ReactNode }) => {
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const isMobile = useIsMobile();

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <main className={
        isMobile
          ? "p-4 pt-14 pb-28 max-w-full"
          : "ml-[56px] p-6 pb-28 max-w-[1400px] transition-all duration-200"
      }>
        <div className="mb-4 hidden justify-end md:flex">
          <BrandLogo imageClassName="h-8 w-8" className="opacity-80" />
        </div>
        {children}
      </main>
      <NewLeadFAB onClick={() => setNewLeadOpen(true)} />
      <TourLauncher />
      <AssistantLauncher />
      <NewLeadDialog open={newLeadOpen} onOpenChange={setNewLeadOpen} />
    </div>
  );
};

export default AppLayout;
