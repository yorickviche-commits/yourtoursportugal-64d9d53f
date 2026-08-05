import { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import AssistantPanel from './AssistantPanel';

const AssistantLauncher = () => {
  const [open, setOpen] = useState(false);

  if (open) {
    return <AssistantPanel onClose={() => setOpen(false)} onMinimize={() => setOpen(false)} />;
  }

  return (
    <button
      onClick={() => setOpen(true)}
      title="YT Copilot — assistente AI"
      className="fixed bottom-6 right-[236px] z-40 h-12 w-12 bg-[#0a2540] hover:bg-[#0e3357] text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95"
    >
      <MessageSquare className="h-5 w-5" />
    </button>
  );
};

export default AssistantLauncher;
