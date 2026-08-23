import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireInternalUser } from "../_shared/require-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// "Nova Pasta FSES - claudio yt 2026 2027"
// Estrutura: REGIÃO > DISTRITO > CATEGORIA > FORNECEDOR > ficheiros
// Madeira/Açores não têm distrito: REGIÃO > CATEGORIA > FORNECEDOR
const ROOT_FSE_FOLDER = "1qHOJ1-przDPoSHyYTJ3ZsvzbUBhpG8fK";
const MAX_LEVEL = 6;
const FOLDER_MIME = "application/vnd.google-apps.folder";
const CONCURRENCY = 12;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const restHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  parents?: string[];
  trashed?: boolean;
}

const driveHeaders = () => ({
  Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
  "X-Connection-Api-Key": Deno.env.get("GOOGLE_DRIVE_API_KEY")!,
});

const GW = "https://connector-gateway.lovable.dev/google_drive/drive/v3";

async function listFolder(folderId: string): Promise<DriveFile[]> {
  const url = new URL(`${GW}/files`);
  url.searchParams.set("q", `'${folderId}' in parents and trashed=false`);
  url.searchParams.set("fields", "files(id,name,mimeType,webViewLink,parents)");
  url.searchParams.set("pageSize", "500");
  url.searchParams.set("supportsAllDrives", "true");
  url.searchParams.set("includeItemsFromAllDrives", "true");
  const r = await fetch(url, { headers: driveHeaders() });
  if (!r.ok) throw new Error(`Drive list ${folderId}: ${r.status} ${await r.text()}`);
  return (await r.json()).files || [];
}

const fileCache = new Map<string, DriveFile | null>();
async function getFile(id: string): Promise<DriveFile | null> {
  if (fileCache.has(id)) return fileCache.get(id)!;
  const url = new URL(`${GW}/files/${id}`);
  url.searchParams.set("fields", "id,name,mimeType,parents,trashed,webViewLink");
  url.searchParams.set("supportsAllDrives", "true");
  const r = await fetch(url, { headers: driveHeaders() });
  const v = r.ok ? ((await r.json()) as DriveFile) : null;
  fileCache.set(id, v);
  return v;
}

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

// Categorias FSE — usadas para detetar regiões sem nível de distrito (Madeira, Açores)
const CATEGORY_KEYS = [
  "alojamento", "barcos", "animacao turistica", "guias externos",
  "monumentos museus", "quintas caves", "restauracao", "transportadoras",
  "experiencias", "rent a car", "eventos", "espacos", "outros",
];
const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ").trim();
const isCategoryName = (clean: string) => CATEGORY_KEYS.includes(norm(clean));

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

interface Ctx {
  level: number; // nível lógico dos FILHOS desta pasta (0 = regiões)
  pathParts: string[];
  region: string | null;
  district: string | null;
  category: string | null;
  supplier: string | null;
}

/** Classifica um filho segundo o nível lógico. */
function classify(child: DriveFile, parentId: string, t: Ctx, rootId: string): { node: Node; next: Ctx | null } {
  const isFolder = child.mimeType === FOLDER_MIME;
  const clean = cleanName(child.name);
  const newPath = [...t.pathParts, child.name];

  let region = t.region, district = t.district, category = t.category, supplier = t.supplier;
  let depth = t.level;
  let childLevel = t.level + 1;

  if (isFolder) {
    if (t.level === 0) {
      region = clean; district = null; category = null; supplier = null;
      depth = 0; childLevel = 1;
    } else if (t.level === 1) {
      if (isCategoryName(clean)) {
        // região sem distrito (Madeira / Açores): distrito = região
        district = t.region; category = clean;
        depth = 2; childLevel = 3;
      } else {
        district = clean; category = null;
        depth = 1; childLevel = 2;
      }
    } else if (t.level === 2) {
      category = clean;
      depth = 2; childLevel = 3;
    } else {
      supplier = t.supplier ?? clean;
      depth = t.level; childLevel = t.level + 1;
    }
  } else {
    supplier = t.supplier ?? (t.level >= 3 ? stripExt(child.name) : null);
    depth = t.level;
  }

  const node: Node = {
    drive_id: child.id,
    parent_drive_id: parentId === rootId ? null : parentId,
    name: child.name,
    mime_type: child.mimeType,
    category, region, district,
    supplier_name: supplier,
    path: newPath.join(" / "),
    web_view_link: child.webViewLink || null,
    depth,
  };

  const next: Ctx | null = isFolder && childLevel <= MAX_LEVEL
    ? { level: childLevel, pathParts: newPath, region, district, category, supplier }
    : null;

  return { node, next };
}

/** Percurso em largura, em paralelo. */
async function walk(startId: string, startCtx: Ctx, out: Node[], rootId: string) {
  let level: { id: string; ctx: Ctx }[] = [{ id: startId, ctx: startCtx }];

  while (level.length) {
    const next: { id: string; ctx: Ctx }[] = [];
    for (let i = 0; i < level.length; i += CONCURRENCY) {
      const batch = level.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map(async ({ id, ctx }) => {
        let children: DriveFile[];
        try { children = await listFolder(id); } catch (e) { console.warn("skip", id, e); return; }
        for (const child of children) {
          const { node, next: nc } = classify(child, id, ctx, rootId);
          out.push(node);
          if (nc) next.push({ id: child.id, ctx: nc });
        }
      }));
    }
    level = next;
  }
}

async function upsertNodes(nodes: Node[]) {
  const CHUNK = 200;
  for (let i = 0; i < nodes.length; i += CHUNK) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/fse_drive_index?on_conflict=drive_id`, {
      method: "POST",
      headers: { ...restHeaders, Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify(nodes.slice(i, i + CHUNK).map(n => ({ ...n, indexed_at: new Date().toISOString() }))),
    });
    if (!r.ok) console.warn("upsert chunk failed", r.status, await r.text());
  }
}

async function deleteIds(ids: string[]) {
  for (let i = 0; i < ids.length; i += 100) {
    const list = ids.slice(i, i + 100).map(id => `"${id}"`).join(",");
    await fetch(`${SUPABASE_URL}/rest/v1/fse_drive_index?drive_id=in.(${list})`, {
      method: "DELETE", headers: restHeaders,
    });
  }
}

/** Apaga recursivamente (item + descendentes) usando parent_drive_id. */
async function deleteSubtree(rootIds: string[]) {
  let frontier = rootIds;
  const all = new Set(rootIds);
  for (let hop = 0; hop < 6 && frontier.length; hop++) {
    const list = frontier.map(id => `"${id}"`).join(",");
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/fse_drive_index?select=drive_id&parent_drive_id=in.(${list})`,
      { headers: restHeaders },
    );
    const rows = r.ok ? await r.json() : [];
    frontier = (rows as { drive_id: string }[]).map(x => x.drive_id).filter(id => !all.has(id));
    frontier.forEach(id => all.add(id));
  }
  await deleteIds([...all]);
}

async function getState() {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/fse_sync_state?id=eq.1&select=*`, { headers: restHeaders });
  const rows = r.ok ? await r.json() : [];
  return rows[0] || null;
}

async function saveState(patch: Record<string, unknown>) {
  await fetch(`${SUPABASE_URL}/rest/v1/fse_sync_state?id=eq.1`, {
    method: "PATCH", headers: restHeaders, body: JSON.stringify(patch),
  });
}

async function getStartPageToken(): Promise<string | null> {
  const url = new URL(`${GW}/changes/startPageToken`);
  url.searchParams.set("supportsAllDrives", "true");
  const r = await fetch(url, { headers: driveHeaders() });
  if (!r.ok) return null;
  return (await r.json()).startPageToken ?? null;
}

const rootCtx: Ctx = { level: 0, pathParts: [], region: null, district: null, category: null, supplier: null };

async function fullSync() {
  const token = await getStartPageToken();
  const out: Node[] = [];
  await walk(ROOT_FSE_FOLDER, rootCtx, out, ROOT_FSE_FOLDER);

  const keep = new Set(out.map(n => n.drive_id));
  await upsertNodes(out);

  // remove registos que já não existem no Drive
  const r = await fetch(`${SUPABASE_URL}/rest/v1/fse_drive_index?select=drive_id`, { headers: restHeaders });
  const existing: { drive_id: string }[] = r.ok ? await r.json() : [];
  const stale = existing.map(x => x.drive_id).filter(id => !keep.has(id));
  if (stale.length) await deleteIds(stale);

  const now = new Date().toISOString();
  await saveState({ change_token: token, last_full_sync_at: now, last_sync_at: now, root_folder_id: ROOT_FSE_FOLDER });

  return { mode: "full", total: out.length, upserted: out.length, removed: stale.length };
}

/** Constrói o contexto de um item a partir da cadeia de antepassados até à raiz FSE. */
async function ctxForParent(parentId: string): Promise<{ ctx: Ctx; parentId: string } | null> {
  const chain: DriveFile[] = [];
  let cur = parentId;
  for (let i = 0; i < 8; i++) {
    if (cur === ROOT_FSE_FOLDER) {
      chain.reverse();
      // reconstrói o contexto descendo a cadeia
      let ctx = { ...rootCtx };
      let pid = ROOT_FSE_FOLDER;
      for (const folder of chain) {
        const { node, next } = classify(folder, pid, ctx, ROOT_FSE_FOLDER);
        if (!next) return null;
        ctx = next;
        pid = node.drive_id;
      }
      return { ctx, parentId };
    }
    const f = await getFile(cur);
    if (!f || !f.parents?.length) return null;
    chain.push(f);
    cur = f.parents[0];
  }
  return null;
}

async function incrementalSync(startToken: string) {
  let pageToken: string | null = startToken;
  let newStartToken: string | null = null;
  const changed: DriveFile[] = [];
  const removed: string[] = [];
  let pages = 0;

  while (pageToken && pages < 20) {
    const url = new URL(`${GW}/changes`);
    url.searchParams.set("pageToken", pageToken);
    url.searchParams.set("pageSize", "1000");
    url.searchParams.set("restrictToMyDrive", "false");
    url.searchParams.set("supportsAllDrives", "true");
    url.searchParams.set("includeItemsFromAllDrives", "true");
    url.searchParams.set("fields", "nextPageToken,newStartPageToken,changes(fileId,removed,file(id,name,mimeType,trashed,parents,webViewLink))");
    const r = await fetch(url, { headers: driveHeaders() });
    if (!r.ok) throw new Error(`Drive changes: ${r.status} ${await r.text()}`);
    const d = await r.json();
    for (const c of d.changes || []) {
      if (c.removed || c.file?.trashed || !c.file) removed.push(c.fileId);
      else changed.push(c.file as DriveFile);
    }
    pageToken = d.nextPageToken ?? null;
    newStartToken = d.newStartPageToken ?? newStartToken;
    pages++;
  }

  if (removed.length) await deleteSubtree(removed);

  const nodes: Node[] = [];
  for (const f of changed) {
    const parentId = f.parents?.[0];
    if (!parentId) continue;
    const resolved = await ctxForParent(parentId);
    if (!resolved) continue; // fora da árvore FSE
    const { node, next } = classify(f, parentId, resolved.ctx, ROOT_FSE_FOLDER);
    nodes.push(node);
    if (next) await walk(f.id, next, nodes, ROOT_FSE_FOLDER); // ramo novo/movido
  }

  const unique = new Map(nodes.map(n => [n.drive_id, n]));
  if (unique.size) await upsertNodes([...unique.values()]);

  const now = new Date().toISOString();
  await saveState({ change_token: newStartToken ?? startToken, last_sync_at: now });

  return { mode: "incremental", changes: changed.length + removed.length, upserted: unique.size, removed: removed.length };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const __auth = await requireInternalUser(req, { adminOnly: true });
  if (!__auth.ok) return __auth.response;

  try {
    let mode = "incremental";
    try { mode = (await req.json())?.mode ?? "incremental"; } catch { /* body vazio */ }

    const state = await getState();
    const canIncremental = mode !== "full" && state?.change_token && state?.root_folder_id === ROOT_FSE_FOLDER;

    const result = canIncremental
      ? await incrementalSync(state.change_token as string)
      : await fullSync();

    return new Response(JSON.stringify({ ok: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("index-drive-fses error", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
