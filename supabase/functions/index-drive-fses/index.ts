import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireInternalUser } from "../_shared/require-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ROOT_FSE_FOLDER = "1HAjGSOKdgPQU3F3QPK6945OyeZMCJORN"; // "2 - FSE's"

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

interface Node {
  drive_id: string;
  parent_drive_id: string | null;
  name: string;
  mime_type: string;
  category: string | null;
  region: string | null;
  supplier_name: string | null;
  path: string;
  web_view_link: string | null;
  depth: number;
}

async function walk(
  folderId: string,
  parentId: string | null,
  depth: number,
  pathParts: string[],
  category: string | null,
  region: string | null,
  out: Node[],
) {
  let children: DriveFile[];
  try { children = await listFolder(folderId); } catch (e) { console.warn("skip", folderId, e); return; }
  for (const f of children) {
    const isFolder = f.mimeType === FOLDER_MIME;
    const newPath = [...pathParts, f.name];
    // Category at depth 0 (children of root)
    const nextCategory = depth === 0 && isFolder ? f.name : category;
    // Region at depth 1 (children of category) — only if folder
    const nextRegion = depth === 1 && isFolder ? f.name : region;
    // Supplier name: leaf folder (depth >=2) OR file with parent region/category
    let supplier: string | null = null;
    if (isFolder && depth >= 2) supplier = f.name;
    else if (!isFolder && depth >= 1) supplier = f.name.replace(/\.(xlsx|pdf|docx|pptx)$/i, "");

    out.push({
      drive_id: f.id,
      parent_drive_id: parentId,
      name: f.name,
      mime_type: f.mimeType,
      category: nextCategory,
      region: nextRegion,
      supplier_name: supplier,
      path: newPath.join(" / "),
      web_view_link: f.webViewLink || null,
      depth,
    });

    // Recurse into folders, max depth 4 to avoid runaway
    if (isFolder && depth < 4) {
      await walk(f.id, f.id, depth + 1, newPath, nextCategory, nextRegion, out);
    }
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const __auth = await requireInternalUser(req, { adminOnly: true });
  if (!__auth.ok) return __auth.response;

  try {
    const out: Node[] = [];
    await walk(ROOT_FSE_FOLDER, null, 0, [], null, null, out);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Wipe + reinsert (simpler than upsert by drive_id when names move)
    await fetch(`${supabaseUrl}/rest/v1/fse_drive_index?drive_id=neq.__never__`, {
      method: "DELETE",
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });

    // Chunk inserts
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
      JSON.stringify({ ok: true, total: out.length, categories: [...new Set(out.filter(n => n.depth === 0).map(n => n.name))] }),
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
