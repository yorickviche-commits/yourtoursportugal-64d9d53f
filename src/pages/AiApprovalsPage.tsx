import AppLayout from '@/components/AppLayout';
import AiApprovalsList from '@/components/ai-approvals/AiApprovalsList';

export default function AiApprovalsPage() {
  return (
    <AppLayout>
      <div className="space-y-4 max-w-4xl">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold">Aprovações AI</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Emails e links de pagamento propostos pelos agentes. Nada é enviado sem aprovação.</p>
        </div>
        <AiApprovalsList />
      </div>
    </AppLayout>
  );
}
