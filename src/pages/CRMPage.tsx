import AppLayout from '@/components/AppLayout';

const CRM_URL = 'https://nethunt.com'; // TODO: Replace with actual NetHunt CRM URL

const CRMPage = () => {
  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-48px)]">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-foreground">CRM (NetHunt)</h1>
          <a
            href={CRM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Abrir em nova janela ↗
          </a>
        </div>
        <div className="flex-1 rounded-lg border border-border overflow-hidden bg-card">
          <iframe
            src={CRM_URL}
            title="NetHunt CRM"
            className="w-full h-full border-0"
            allow="clipboard-read; clipboard-write"
          />
        </div>
      </div>
    </AppLayout>
  );
};

export default CRMPage;
