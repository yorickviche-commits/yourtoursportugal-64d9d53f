import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireInternalUser } from "../_shared/require-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// "Nova pasta comercial claudio yt 2026 2027"
// Structure: REGIÃO > DISTRITO > CATEGORIA > FORNECEDOR > ficheiros
const ROOT_FSE_FOLDER = "1qHOJ1-przDPoSHyYTJ3ZsvzbUBhpG8fK";
const MAX_DEPTH = 6;

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
}

async function listFolder(folderId: string): Promise<DriveFile[]> {
  const url = new URL("https://connector-gateway.lovable.dev/google_drive/drive/v3/files");
  url.searchParams.set("q", `'${folderId}' in parents and trashed=false`);
  url.searchParams.set("fields", "files(id,name,mimeType,webViewLink)");
  url.searchParams.set("pageSize", "500");
  url.searchParams.set("supportsAllDrives", "true");
  url.searchParams.set("includeItemsFromAllDrives", "true");
  const r = await fetch(url, {
    headers: {
      Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
      "X-Connection-Api-Key": Deno.env.get("GOOGLE_DRIVE_API_KEY")!,
    },
  });
  if (!r.ok) throw new Error(`Drive list ${folderId}: ${r.status} ${await r.text()}`);
  const d = await r.json();
  return d.files || [];
}

const FOLDER_MIME = "application/vnd.google-apps.folder";

/** "1. PORTO E NORTE" → "Porto e Norte"; "1.1 Porto" → "Porto"; "5 - Restauração" → "Restauração" */
function cleanName(raw: string): string {
  const stripped = raw.replace(/^\s*\d+(\.\d+)*\s*[.\-–)]?\s*/, "").trim() || raw.trim();
  const letters = stripped.replace(/[^A-Za-zÀ-ÿ]/g, "");
  const isAllCaps = letters.length > 2 && letters === letters.toUpperCase();
  if (!isAllCaps) return stripped;
  const small = new Set(["e", "de", "da", "do", "das", "dos", "&", "a", "o"]);
  return stripped
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => (i > 0 && small.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

const stripExt = (name: string) => name.replace(/\.(xlsx|xls|pdf|docx|doc|pptx|csv|txt)$/i, "");

interface Node {
  drive_id: string;
  parent_drive_id: string | null;
  name: string;
  mime_type: string;
  category: string | null;
  region: string | null;
  district: string | null;
  supplier_name: string | null;
  path: string;
  web_view_link: string | null;
  depth: number;
}

interface Task {
  folderId: string;
  depth: number;
  pathParts: string[];
  region: string | null;
  district: string | null;
  category: string | null;
  supplier: string | null;
}

const CONCURRENCY = 12;

/**
 * Breadth-first, parallel walk (sequential recursion timed out at 150s).
 * depth 0 = Região, depth 1 = Distrito, depth 2 = Categoria,
 * depth >= 3 = Fornecedor (pasta) e respetivos ficheiros.
 */
async function walkAll(rootId: string, out: Node[]) {
  let level: Task[] = [{
    folderId: rootId, depth: 0, pathParts: [],
    region: null, district: null, category: null, supplier: null,
  }];

  while (level.length) {
    const next: Task[] = [];

    for (let i = 0; i < level.length; i += CONCURRENCY) {
      const batch = level.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map(async (t) => {
        let children: DriveFile[];
        try { children = await listFolder(t.folderId); } catch (e) { console.warn("skip", t.folderId, e); return; }

        for (const f of children) {
          const isFolder = f.mimeType === FOLDER_MIME;
          const newPath = [...t.pathParts, f.name];
          const clean = cleanName(f.name);

          const nextRegion = t.depth === 0 && isFolder ? clean : t.region;
          const nextDistrict = t.depth === 1 && isFolder ? clean : t.district;
          const nextCategory = t.depth === 2 && isFolder ? clean : t.category;

          let nextSupplier = t.supplier;
          if (isFolder && t.depth >= 3) nextSupplier = t.supplier ?? clean;
          const nodeSupplier = isFolder
            ? nextSupplier
            : (t.supplier ?? (t.depth >= 3 ? stripExt(f.name) : null));

          out.push({
            drive_id: f.id,
            parent_drive_id: t.folderId === rootId ? null : t.folderId,
            name: f.name,
            mime_type: f.mimeType,
            category: nextCategory,
            region: nextRegion,
            district: nextDistrict,
            supplier_name: nodeSupplier,
            path: newPath.join(" / "),
            web_view_link: f.webViewLink || null,
            depth: t.depth,
          });

          if (isFolder && t.depth < MAX_DEPTH) {
            next.push({
              folderId: f.id, depth: t.depth + 1, pathParts: newPath,
              region: nextRegion, district: nextDistrict,
              category: nextCategory, supplier: nextSupplier,
            });
          }
        }
      }));
    }

    level = next;
  }
}


serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const __auth = await requireInternalUser(req, { adminOnly: true });
  if (!__auth.ok) return __auth.response;

  try {
    const out: Node[] = [];
    await walk(ROOT_FSE_FOLDER, null, 0, [], null, null, null, null, out);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Wipe + reinsert (simpler than upsert by drive_id when names move)
    await fetch(`${supabaseUrl}/rest/v1/fse_drive_index?drive_id=neq.__never__`, {
      method: "DELETE",
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });

    const CHUNK = 200;
    for (let i = 0; i < out.length; i += CHUNK) {
      const chunk = out.slice(i, i + CHUNK);
      const r = await fetch(`${supabaseUrl}/rest/v1/fse_drive_index`, {
        method: "POST",
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
          Prefer: "resolution=ignore-duplicates",
        },
        body: JSON.stringify(chunk),
      });
      if (!r.ok) console.warn("insert chunk failed", r.status, await r.text());
    }

    return new Response(
      JSON.stringify({
        ok: true,
        total: out.length,
        regions: [...new Set(out.filter(n => n.depth === 0).map(n => n.region).filter(Boolean))],
        districts: [...new Set(out.map(n => n.district).filter(Boolean))].length,
        categories: [...new Set(out.map(n => n.category).filter(Boolean))].length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("index-drive-fses error", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
