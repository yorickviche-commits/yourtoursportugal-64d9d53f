import AppLayout from '@/components/AppLayout';

const WETRAVEL_URL = 'https://www.wetravel.com'; // TODO: Replace with actual WeTravel URL

const PaymentsPage = () => {
  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-48px)]">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-foreground">Pagamentos (WeTravel)</h1>
          <a
            href={WETRAVEL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Abrir em nova janela ↗
          </a>
        </div>
        <div className="flex-1 rounded-lg border border-border overflow-hidden bg-card">
          <iframe
            src={WETRAVEL_URL}
            title="WeTravel Payments"
            className="w-full h-full border-0"
            allow="clipboard-read; clipboard-write; payment"
          />
        </div>
      </div>
    </AppLayout>
  );
};

export default PaymentsPage;
