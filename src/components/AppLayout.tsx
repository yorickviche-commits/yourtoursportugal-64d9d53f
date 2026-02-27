import { ReactNode } from 'react';
import AppSidebar from './AppSidebar';

const AppLayout = ({ children }: { children: ReactNode }) => {
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      {/* ml matches the sidebar collapsed/expanded — we use the wider value and let sidebar overlay when collapsed */}
      <main className="ml-[56px] p-6 max-w-[1400px] transition-all duration-200">
        {children}
      </main>
    </div>
  );
};

export default AppLayout;
