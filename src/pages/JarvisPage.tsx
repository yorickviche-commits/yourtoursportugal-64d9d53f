import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

// JARVIS: o ecrã do Claude Design (igual ao Jarvis do claude.ai) servido de public/jarvis/index.html.
// Esta página só entrega ao iframe a ligação à edge function `jarvis` e o token da sessão;
// o ecrã não tem dados próprios e, sem esta ligação, mostra erro em vez de simulação.
const SRC = "/jarvis/index.html?host=tcc";

export default function JarvisPage() {
  const { session } = useAuth();
  const frame = useRef<HTMLIFrameElement>(null);
  const token = session?.access_token ?? "";

  useEffect(() => {
    const send = () => {
      const w = frame.current?.contentWindow;
      if (!w || !token) return;
      w.postMessage(
        {
          type: "jarvis:config",
          apiBase: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`,
          apiKey: token,
          anonKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        window.location.origin,
      );
    };
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== frame.current?.contentWindow) return;
      if (e.data?.type === "jarvis:ready") send();
    };
    window.addEventListener("message", onMessage);
    send(); // token renovado (TOKEN_REFRESHED) → reenviar ao ecrã
    return () => window.removeEventListener("message", onMessage);
  }, [token]);

  return (
    <div className="fixed inset-0 bg-[#04070f]">
      <iframe
        ref={frame}
        src={SRC}
        title="JARVIS"
        className="h-full w-full border-0"
        allow="microphone; clipboard-write"
      />
      <Link
        to="/leads"
        title="Voltar ao TCC"
        aria-label="Voltar ao TCC"
        className="absolute left-[18px] top-[14px] flex h-8 w-8 items-center justify-center rounded-full bg-[#12275a] text-white/90 shadow-[0_0_16px_rgba(77,141,255,.55)] hover:bg-[#1c4fd8] focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <ArrowLeft className="h-4 w-4" />
      </Link>
    </div>
  );
}
