// Shared YT Brain retrieval helper for AI edge functions.
//
// FIREWALL RULE: with context === 'client_facing' confidential documents are
// excluded IN THE QUERY (never post-filtered), so net prices and supplier data
// can never reach client-facing output.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMS = 1536;

export async function embedText(text: string): Promise<number[] | null> {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: text.slice(0, 24000) }),
    });
    if (!res.ok) {
      console.warn("embedText failed", res.status, (await res.text()).slice(0, 200));
      return null;
    }
    const json = await res.json();
    return json?.data?.[0]?.embedding ?? null;
  } catch (e) {
    console.warn("embedText error", (e as Error).message);
    return null;
  }
}

export interface BrainChunk {
  document_id: string;
  title: string;
  chunk_text: string;
  similarity: number;
  metadata: Record<string, unknown>;
}

export async function retrieveKnowledge(
  query: string,
  context: "internal" | "client_facing" = "internal",
  matchCount = 8,
): Promise<BrainChunk[]> {
  try {
    if (!query?.trim()) return [];
    const embedding = await embedText(query);
    if (!embedding) return [];
    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data, error } = await svc.rpc("ytb_match_chunks", {
      query_embedding: embedding as unknown as string,
      match_count: matchCount,
      allow_confidential: context === "internal",
    });
    if (error) {
      console.warn("ytb_match_chunks error", error.message);
      return [];
    }
    return (data ?? []) as BrainChunk[];
  } catch (e) {
    console.warn("retrieveKnowledge error", (e as Error).message);
    return [];
  }
}

export const BRAIN_INSTRUCTION =
  "Baseia-te neste conhecimento oficial da empresa e respeita-o estritamente — tom, regras, termos e condições, inclusões e procedimentos. Em caso de conflito, o conhecimento da empresa prevalece.";

/** Returns a prompt block to append to the system prompt (empty string if nothing found). */
export async function knowledgeBlock(
  query: string,
  context: "internal" | "client_facing" = "internal",
  matchCount = 8,
): Promise<string> {
  const chunks = await retrieveKnowledge(query, context, matchCount);
  if (!chunks.length) return "";
  const body = chunks
    .map((c, i) => `[${i + 1}] ${c.title}\n${c.chunk_text}`)
    .join("\n\n");
  return `\n\n=== COMPANY KNOWLEDGE BASE (YT BRAIN) ===\n${BRAIN_INSTRUCTION}\n\n${body}\n=== END COMPANY KNOWLEDGE BASE ===\n`;
}
