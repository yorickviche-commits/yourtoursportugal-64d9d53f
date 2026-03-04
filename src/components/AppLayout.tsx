import { ReactNode, useState } from 'react';
import AppSidebar from './AppSidebar';
import NewLeadDialog, { NewLeadFAB } from './NewLeadDialog';
import { useIsMobile } from '@/hooks/use-mobile';

const AppLayout = ({ children }: { children: ReactNode }) => {
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const isMobile = useIsMobile();

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <main className={
        isMobile
          ? "p-4 pt-14 max-w-full"
          : "ml-[56px] p-6 max-w-[1400px] transition-all duration-200"
      }>
        {children}
      </main>
      <NewLeadFAB onClick={() => setNewLeadOpen(true)} />
      <NewLeadDialog open={newLeadOpen} onOpenChange={setNewLeadOpen} />
    </div>
  );
};

export default AppLayout;
