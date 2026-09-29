// TEMPORARY diagnostic — removed after use.
import { nh, updateRecord, fetchRecord, DEALS_FOLDER } from "../_shared/nethunt.ts";
Deno.serve(async () => {
  const rid = "6aadc3bbfb6dac1f37d0436f";
  const out: any[] = [];
  try { await updateRecord(rid, [{ field: "Close date", value: "2026-10-01" }]); out.push({ arrayCloseDate: "ok" }); } catch (e) { out.push({ arrayCloseDate: (e as Error).message }); }
  try {
    await nh(`/actions/update-record/${rid}?overwrite=true`, { method: "POST", body: { fieldActions: { "Potential Booking Value": { overwrite: true, add: 570.01 } } } });
    out.push({ objectValue: "ok" });
  } catch (e) { out.push({ objectValue: (e as Error).message }); }
  const rec = await fetchRecord(DEALS_FOLDER, rid);
  out.push({ value: rec?.fields?.["Potential Booking Value"] });
  return new Response(JSON.stringify(out), { headers: { "Content-Type": "application/json" } });
});
