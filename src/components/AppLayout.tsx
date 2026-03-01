import { ReactNode, useState } from 'react';
import AppSidebar from './AppSidebar';
import NewLeadDialog, { NewLeadFAB } from './NewLeadDialog';

const AppLayout = ({ children }: { children: ReactNode }) => {
  const [newLeadOpen, setNewLeadOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <main className="ml-[56px] p-6 max-w-[1400px] transition-all duration-200">
        {children}
      </main>
      <NewLeadFAB onClick={() => setNewLeadOpen(true)} />
      <NewLeadDialog open={newLeadOpen} onOpenChange={setNewLeadOpen} />
    </div>
  );
};

export default AppLayout;
