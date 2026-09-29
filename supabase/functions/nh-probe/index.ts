// TEMPORARY diagnostic — removed after use.
import { updateRecord, fetchRecord, DEALS_FOLDER } from "../_shared/nethunt.ts";
Deno.serve(async () => {
  const rid = "6aadc3bbfb6dac1f37d0436f";
  const out: any[] = [];
  const tries: [string, unknown, string?][] = [
    ["Potential Booking Value", 570.01],
    ["Potential Booking Value", "570.01"],
    ["Potential Booking Value", 570],
    ["Potential Booking Value", 570.01, "add"],
  ];
  for (const [f, v, action] of tries) {
    try { await updateRecord(rid, [{ field: f, value: v, ...(action ? { action } : {}) }]); out.push({ f, v, action, ok: true }); break; }
    catch (e) { out.push({ f, v, action, err: (e as Error).message }); }
  }
  const rec = await fetchRecord(DEALS_FOLDER, rid);
  out.push({ fields: rec?.fields });
  return new Response(JSON.stringify(out), { headers: { "Content-Type": "application/json" } });
});
