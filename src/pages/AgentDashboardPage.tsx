import { useState, useEffect, useCallback } from "react";

// ── Config ───────────────────────────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

// ── API client ────────────────────────────────────────────────────────────────
const api = {
  async post(path: string, body: any) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    return res.json();
  },
  async get(path: string) {
    const res = await fetch(`${API_BASE}${path}`);
    if (!res.ok) throw new Error(`API error ${res.status}`);
    return res.json();
  },
};

// ── Agent command → API endpoint map ─────────────────────────────────────────
const COMMAND_ENDPOINTS: Record<string, Record<string, (d: any) => Promise<any>>> = {
  "sales-tm": {
    "Process New Lead":   (d) => api.post("/orchestrator/event", { event_type: "new_lead", data: d }),
    "Push to Proposal":   (d) => api.post("/orchestrator/event", { event_type: "lead_qualified", data: d }),
    "Send Follow-up":     (d) => api.post("/sales/followup", d),
  },
  "sales-b2b": {
    "Send Net Rates":     (d) => api.post("/orchestrator/event", { event_type: "new_b2b_inquiry", data: d }),
    "Confirm Booking":    (d) => api.post("/sales/convert", d),
  },
  "proposal": {
    "Build Proposal":     (d) => api.post("/orchestrator/event", { event_type: "pricing_approved", data: d }),
    "Attach to CRM":      (d) => api.post("/crm/sync", { action: "attach_proposal", ...d }),
  },
  "itinerary": {
    "Generate Itinerary": (d) => api.post("/itinerary/generate", d),
    "Send to Pricing":    (d) => api.post("/orchestrator/event", { event_type: "itinerary_complete", data: d }),
    "Revise Day":         (d) => api.post("/itinerary/revise", d),
  },
  "pricing": {
    "Calculate Trip":     (d) => api.post("/pricing/calculate", d),
    "Approve & Lock Price": (d) => api.post("/pricing/approve", d),
  },
  "operations": {
    "Book Supplier":      (d) => api.post("/operations/book", d),
    "Generate Docs":      (d) => api.post("/operations/generate-docs", d),
    "Send Reminders":     (d) => api.post("/operations/send-reminders", d),
    "Confirm All & Close":(d) => api.post("/orchestrator/event", { event_type: "deposit_confirmed", data: d }),
  },
  "supplier": {
    "Draft Email":        (d) => api.post("/supplier/email", { action: "inquiry", ...d }),
    "Send Batch":         (d) => api.post("/supplier/email", { action: "booking", ...d }),
    "Chase Pending":      (d) => api.post("/supplier/email", { action: "chase", ...d }),
    "Sync to CRM":        (d) => api.post("/crm/sync", { action: "log_supplier", ...d }),
  },
  "crm": {
    "Sync CRM":           (d) => api.post("/crm/sync", { action: "sync", ...d }),
    "Auto-tag Leads":     (d) => api.post("/crm/sync", { action: "auto_tag", ...d }),
    "Clean Stale Records":() => api.get("/crm/clean-stale"),
    "Stage Report":       () => api.get("/ceo/kpi"),
  },
  "payment": {
    "Send Pay Link":      (d) => api.post("/payment/send-link", d),
    "Check Webhooks":     (d) => api.get("/payment/status/" + (d.trip_id || "latest")),
    "Chase Overdue":      () => api.post("/payment/chase-overdue", {}),
    "Mark as Paid & Trigger Ops": (d) => api.post("/orchestrator/event", { event_type: "payment_received", data: d }),
  },
  "support": {
    "View Tickets":       () => api.get("/orchestrator/agents"),
    "Send Info Pack":     (d) => api.post("/support/pretrip", d),
    "Mark Resolved":      (d) => api.post("/support/pretrip", { ...d, resolved: true }),
  },
  "review": {
    "Send Review Request":(d) => api.post("/review/request", d),
    "Draft Response":     (d) => api.post("/review/respond", d),
    "Reputation Report":  () => api.get("/ceo/kpi"),
  },
  "marketing": {
    "Write Social Post":  (d) => api.post("/marketing/generate", { type: "instagram", topic: d.topic || "Portugal travel" }),
    "Email Campaign":     (d) => api.post("/marketing/generate", { type: "email", topic: d.topic || "Seasonal promo" }),
    "Blog Post":          (d) => api.post("/marketing/generate", { type: "blog", topic: d.topic || "Hidden Portugal" }),
    "Schedule & Publish": (d) => api.post("/marketing/generate", { type: "instagram", topic: d.topic || "Portugal", schedule: true }),
  },
  "ceo": {
    "KPI Dashboard":      () => api.get("/ceo/kpi"),
    "Weekly Digest":      () => api.get("/ceo/kpi"),
    "Risk Alerts":        () => api.get("/ceo/approvals/pending"),
  },
};

// ── Scoped styles ────────────────────────────────────────────────────────────
const agentStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Mono:wght@300;400;500&family=DM+Sans:wght@300;400;500;600&display=swap');
  .agent-dashboard{--ag-bg:#09100f;--ag-surface:#0f1a18;--ag-surface2:#162320;--ag-border:#1e3530;--ag-gold:#c9a84c;--ag-gold2:#e8c97a;--ag-teal:#2dd4be;--ag-teal-dim:rgba(45,212,190,0.12);--ag-red:#f05252;--ag-green:#34d399;--ag-amber:#fbbf24;--ag-text:#e8ede8;--ag-text-dim:#7a9490;--ag-text-muted:#3d5550}
  .agent-dashboard{display:flex;min-height:100vh;background:var(--ag-bg);color:var(--ag-text);font-family:'DM Sans',sans-serif}
  .agent-dashboard ::-webkit-scrollbar{width:4px}.agent-dashboard ::-webkit-scrollbar-track{background:var(--ag-bg)}.agent-dashboard ::-webkit-scrollbar-thumb{background:var(--ag-border);border-radius:2px}
  .ag-sidebar{width:240px;min-width:240px;background:var(--ag-surface);border-right:1px solid var(--ag-border);display:flex;flex-direction:column;position:sticky;top:0;height:100vh;overflow-y:auto}
  .ag-logo{padding:24px 20px 16px;border-bottom:1px solid var(--ag-border)}
  .ag-logo-title{font-family:'Playfair Display',serif;font-size:14px;color:var(--ag-gold);letter-spacing:.04em;line-height:1.3}
  .ag-logo-sub{font-size:10px;color:var(--ag-text-muted);letter-spacing:.12em;text-transform:uppercase;margin-top:2px}
  .ag-nav-section{padding:12px 0;border-bottom:1px solid var(--ag-border)}
  .ag-nav-label{font-size:9px;color:var(--ag-text-muted);letter-spacing:.14em;text-transform:uppercase;padding:0 20px 8px}
  .ag-nav-item{display:flex;align-items:center;gap:10px;padding:9px 20px;cursor:pointer;font-size:12px;color:var(--ag-text-dim);transition:all .15s;border-left:2px solid transparent;font-family:'DM Mono',monospace}
  .ag-nav-item:hover{color:var(--ag-text);background:var(--ag-teal-dim)}
  .ag-nav-item.active{color:var(--ag-teal);border-left-color:var(--ag-teal);background:var(--ag-teal-dim)}
  .ag-nav-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
  .ag-badge{margin-left:auto;font-size:9px;background:var(--ag-gold);color:#000;border-radius:8px;padding:1px 6px;font-family:'DM Sans',sans-serif;font-weight:600}
  .ag-orch-btn{margin:16px;padding:10px;background:linear-gradient(135deg,var(--ag-gold) 0%,#a07830 100%);border:none;border-radius:6px;color:#000;font-size:11px;font-weight:600;cursor:pointer;letter-spacing:.06em;text-transform:uppercase;font-family:'DM Sans',sans-serif;transition:opacity .15s}
  .ag-orch-btn:hover{opacity:.85}
  .ag-main{flex:1;overflow-y:auto}
  .ag-topbar{position:sticky;top:0;z-index:10;background:rgba(9,16,15,.85);backdrop-filter:blur(12px);border-bottom:1px solid var(--ag-border);padding:14px 28px;display:flex;align-items:center;justify-content:space-between}
  .ag-topbar-title{font-family:'Playfair Display',serif;font-size:18px;color:var(--ag-gold2)}
  .ag-topbar-meta{font-size:11px;color:var(--ag-text-muted);font-family:'DM Mono',monospace}
  .ag-status-pills{display:flex;gap:8px}
  .ag-pill{display:flex;align-items:center;gap:5px;font-size:10px;font-family:'DM Mono',monospace;padding:4px 10px;border-radius:20px;border:1px solid}
  .ag-pill.green{color:var(--ag-green);border-color:rgba(52,211,153,.3);background:rgba(52,211,153,.06)}
  .ag-pill.gold{color:var(--ag-gold);border-color:rgba(201,168,76,.3);background:rgba(201,168,76,.06)}
  .ag-pill.red{color:var(--ag-red);border-color:rgba(240,82,82,.3);background:rgba(240,82,82,.06)}
  .ag-pill-dot{width:5px;height:5px;border-radius:50%;background:currentColor;animation:ag-pulse 2s infinite}
  @keyframes ag-pulse{0%,100%{opacity:1}50%{opacity:.3}}
  .ag-content{padding:28px}
  .ag-kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:28px}
  .ag-kpi-card{background:var(--ag-surface);border:1px solid var(--ag-border);border-radius:8px;padding:18px;position:relative;overflow:hidden}
  .ag-kpi-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,var(--ag-gold),transparent)}
  .ag-kpi-label{font-size:10px;color:var(--ag-text-muted);letter-spacing:.1em;text-transform:uppercase}
  .ag-kpi-value{font-family:'Playfair Display',serif;font-size:28px;color:var(--ag-gold2);margin:6px 0 2px}
  .ag-kpi-delta{font-size:11px;color:var(--ag-green);font-family:'DM Mono',monospace}
  .ag-agent-panel{background:var(--ag-surface);border:1px solid var(--ag-border);border-radius:8px;overflow:hidden;cursor:pointer;transition:border-color .15s}
  .ag-agent-panel:hover{border-color:rgba(45,212,190,.3)}
  .ag-agent-header{padding:20px 24px;border-bottom:1px solid var(--ag-border);display:flex;align-items:center;gap:14px}
  .ag-agent-icon{width:40px;height:40px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}
  .ag-agent-info h2{font-family:'Playfair Display',serif;font-size:17px;color:var(--ag-text)}
  .ag-agent-info p{font-size:11px;color:var(--ag-text-dim);margin-top:2px;font-family:'DM Mono',monospace}
  .ag-status-badge{font-size:10px;font-family:'DM Mono',monospace;padding:4px 10px;border-radius:4px;border:1px solid;text-transform:uppercase;letter-spacing:.08em}
  .ag-status-badge.active{color:var(--ag-green);border-color:rgba(52,211,153,.4);background:rgba(52,211,153,.08)}
  .ag-status-badge.idle{color:var(--ag-text-muted);border-color:var(--ag-border)}
  .ag-tabs{display:flex;border-bottom:1px solid var(--ag-border)}
  .ag-tab{padding:14px 20px;font-size:11px;cursor:pointer;color:var(--ag-text-muted);border-bottom:2px solid transparent;transition:all .15s;font-family:'DM Mono',monospace;letter-spacing:.06em;text-transform:uppercase}
  .ag-tab.active{color:var(--ag-teal);border-bottom-color:var(--ag-teal)}
  .ag-tab:hover:not(.active){color:var(--ag-text-dim)}
  .ag-section-label{font-size:9px;color:var(--ag-text-muted);letter-spacing:.14em;text-transform:uppercase;margin-bottom:12px}
  .ag-log-list{display:flex;flex-direction:column;gap:8px}
  .ag-log-item{display:flex;align-items:flex-start;gap:10px;padding:8px 10px;border-radius:5px;background:var(--ag-surface2);font-size:11px}
  .ag-log-time{font-family:'DM Mono',monospace;color:var(--ag-text-muted);flex-shrink:0}
  .ag-log-msg{color:var(--ag-text-dim);line-height:1.5}
  .ag-log-msg strong{color:var(--ag-teal);font-weight:500}
  .ag-cmd-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .ag-cmd-btn{padding:10px 12px;border-radius:5px;border:1px solid var(--ag-border);background:var(--ag-surface2);color:var(--ag-text-dim);font-size:11px;cursor:pointer;text-align:left;transition:all .15s;font-family:'DM Mono',monospace;display:flex;align-items:center;gap:7px}
  .ag-cmd-btn:hover{border-color:var(--ag-teal);color:var(--ag-teal);background:var(--ag-teal-dim)}
  .ag-cmd-btn.primary{grid-column:span 2;background:var(--ag-teal-dim);border-color:rgba(45,212,190,.4);color:var(--ag-teal);font-weight:500}
  .ag-cmd-btn:disabled{opacity:.4;cursor:not-allowed}
  .ag-cmd-btn.loading{animation:ag-shimmer 1.2s infinite}
  @keyframes ag-shimmer{0%,100%{opacity:.6}50%{opacity:1}}
  .ag-metrics-row{display:flex;gap:16px;padding:16px 24px;background:var(--ag-surface2)}
  .ag-metric{text-align:center}
  .ag-metric-val{font-family:'DM Mono',monospace;font-size:16px;color:var(--ag-gold2)}
  .ag-metric-key{font-size:9px;color:var(--ag-text-muted);text-transform:uppercase;letter-spacing:.1em;margin-top:2px}
  .ag-progress-bar-wrap{margin:10px 0}
  .ag-progress-bar-label{display:flex;justify-content:space-between;font-size:10px;color:var(--ag-text-dim);margin-bottom:5px;font-family:'DM Mono',monospace}
  .ag-progress-bar-bg{background:var(--ag-surface2);border-radius:3px;height:5px}
  .ag-progress-bar-fill{height:5px;border-radius:3px;background:linear-gradient(90deg,var(--ag-teal),var(--ag-gold));transition:width .8s ease}
  .ag-pipe-stage{flex:1;min-width:80px;padding:10px 8px;border:1px solid var(--ag-border);border-radius:5px;text-align:center;background:var(--ag-surface2)}
  .ag-pipe-stage.active{border-color:rgba(45,212,190,.4);background:var(--ag-teal-dim)}
  .ag-pipe-stage.done{border-color:rgba(52,211,153,.3);background:rgba(52,211,153,.05)}
  .ag-pipe-count{font-family:'Playfair Display',serif;font-size:20px;color:var(--ag-gold2)}
  .ag-pipe-label{font-size:9px;color:var(--ag-text-muted);text-transform:uppercase;letter-spacing:.08em;margin-top:3px}
  .ag-pipe-stage.active .ag-pipe-label{color:var(--ag-teal)}
  .ag-json-preview{background:#050c0b;border:1px solid var(--ag-border);border-radius:5px;padding:12px;font-family:'DM Mono',monospace;font-size:10px;color:var(--ag-text-dim);line-height:1.7;max-height:300px;overflow-y:auto;white-space:pre-wrap}
  .ag-approval-card{padding:14px;border-radius:6px;border:1px solid rgba(251,191,36,.4);background:rgba(251,191,36,.06);display:flex;align-items:center;gap:12px}
  .ag-btn-approve,.ag-btn-reject{padding:6px 12px;border-radius:4px;border:1px solid;font-size:10px;font-weight:600;cursor:pointer;font-family:'DM Mono',monospace;letter-spacing:.06em;text-transform:uppercase}
  .ag-btn-approve{color:var(--ag-green);border-color:rgba(52,211,153,.4);background:rgba(52,211,153,.08)}
  .ag-btn-reject{color:var(--ag-red);border-color:rgba(240,82,82,.4);background:rgba(240,82,82,.08)}
  .ag-result-panel{margin:16px 24px;padding:14px;border-radius:6px;border:1px solid rgba(45,212,190,.3);background:rgba(45,212,190,.06)}
  .ag-result-title{font-size:10px;color:var(--ag-teal);font-family:'DM Mono',monospace;letter-spacing:.1em;text-transform:uppercase;margin-bottom:8px}
  .ag-error-panel{margin:16px 24px;padding:14px;border-radius:6px;border:1px solid rgba(240,82,82,.3);background:rgba(240,82,82,.06)}
  .ag-error-title{font-size:10px;color:var(--ag-red);font-family:'DM Mono',monospace;letter-spacing:.1em;text-transform:uppercase;margin-bottom:6px}
  @media(max-width:900px){.ag-sidebar{display:none}.ag-kpi-row{grid-template-columns:repeat(2,1fr)}.ag-cmd-btn.primary{grid-column:span 1}}
`;

// ── Types ─────────────────────────────────────────────────────────────────────
interface AgentMetric { k: string; v: string }
interface AgentPipeline { label: string; count: number; state: string }
interface AgentProgress { label: string; pct: number }
interface AgentLog { t: string; msg: string }
interface AgentCmd { icon: string; label: string; primary?: boolean }
interface Agent {
  id: string; label: string; icon: string; color: string; status: string;
  mission: string; metrics: AgentMetric[]; pipeline: AgentPipeline[];
  progress: AgentProgress[]; logs: AgentLog[]; cmds: AgentCmd[];
  approval: false | { msg: string };
}

// ── Agent data ────────────────────────────────────────────────────────────────
const AGENTS: Agent[] = [
  { id:"sales-tm", label:"Sales · Tailor-Made", icon:"🧭", color:"#2dd4be", status:"active",
    mission:"Qualify & convert inbound leads for custom multi-day trips",
    metrics:[{k:"Leads/wk",v:"24"},{k:"Qualified",v:"18"},{k:"Conv.%",v:"31%"},{k:"Avg.Value",v:"€3.8k"}],
    pipeline:[{label:"Inbound",count:24,state:"done"},{label:"Qualify",count:18,state:"done"},{label:"Proposal",count:9,state:"active"},{label:"Closed",count:5,state:""}],
    progress:[{label:"Weekly quota",pct:75},{label:"Response SLA < 2h",pct:91}],
    logs:[{t:"10:42",msg:"Lead <strong>NH-2041</strong> qualified → budget €4,200 · 5 pax · Douro"},{t:"10:18",msg:"Follow-up sent to <strong>NH-2038</strong> (48h no reply)"},{t:"09:55",msg:"Lead <strong>NH-2039</strong> disqualified → budget below floor"}],
    cmds:[{icon:"📥",label:"Process New Lead"},{icon:"📋",label:"View Queue"},{icon:"📤",label:"Send Follow-up"},{icon:"⛔",label:"Disqualify"},{icon:"➡️",label:"Push to Proposal",primary:true}],
    approval:false },
  { id:"sales-b2b", label:"Sales · B2B / Agencies", icon:"🤝", color:"#c9a84c", status:"active",
    mission:"Manage agency & partner accounts, net rates, volume contracts",
    metrics:[{k:"Partners",v:"12"},{k:"Bookings/m",v:"34"},{k:"Net Margin",v:"22%"},{k:"Pipeline",v:"€28k"}],
    pipeline:[{label:"Inquiry",count:8,state:"done"},{label:"Rate Sent",count:6,state:"done"},{label:"Negotiation",count:3,state:"active"},{label:"Contracted",count:2,state:""}],
    progress:[{label:"Partner SLA 4h",pct:87},{label:"Net rate accuracy",pct:99}],
    logs:[{t:"11:05",msg:"Net rate sheet sent to <strong>Nomadic Travel Agency</strong>"},{t:"10:33",msg:"Contract renewal triggered for <strong>Lisbon Tours Ltd</strong>"}],
    cmds:[{icon:"📑",label:"Send Net Rates"},{icon:"📊",label:"Volume Report"},{icon:"📝",label:"Draft Contract"},{icon:"📞",label:"Schedule Call"},{icon:"✅",label:"Confirm Booking",primary:true}],
    approval:{msg:"Contracts >€10k require CEO signature before sending."} },
  { id:"proposal", label:"Proposal Builder", icon:"📄", color:"#a78bfa", status:"active",
    mission:"Generate branded proposals from itinerary + pricing data",
    metrics:[{k:"Built today",v:"3"},{k:"Avg build",v:"4 min"},{k:"Accept rate",v:"68%"},{k:"Pending",v:"2"}],
    pipeline:[{label:"Draft",count:3,state:"done"},{label:"Review",count:2,state:"active"},{label:"Sent",count:1,state:""},{label:"Accepted",count:0,state:""}],
    progress:[{label:"On-brand compliance",pct:100},{label:"Margin lock ≥20%",pct:95}],
    logs:[{t:"11:20",msg:"Proposal <strong>PROP-341</strong> generated · 5 days Porto + Douro"},{t:"10:58",msg:"PDF exported · linked to <strong>NH-2041</strong>"}],
    cmds:[{icon:"🔨",label:"Build Proposal"},{icon:"👁️",label:"Preview PDF"},{icon:"✏️",label:"Edit Draft"},{icon:"📬",label:"Send to Client"},{icon:"📎",label:"Attach to CRM",primary:true}],
    approval:{msg:"Proposals over €8,000 require CEO review before dispatch."} },
  { id:"itinerary", label:"Itinerary Architect", icon:"🗺️", color:"#34d399", status:"active",
    mission:"Build day-by-day itineraries from brief, interests & region data",
    metrics:[{k:"Built/wk",v:"11"},{k:"Avg days",v:"5.2"},{k:"Revisions",v:"1.3x"},{k:"Regions",v:"7"}],
    pipeline:[{label:"Brief In",count:11,state:"done"},{label:"Draft",count:8,state:"done"},{label:"Pricing",count:5,state:"active"},{label:"Approved",count:3,state:""}],
    progress:[{label:"Knowledge base coverage",pct:88},{label:"Supplier availability check",pct:76}],
    logs:[{t:"11:35",msg:"Itinerary <strong>IT-211</strong> built: 6 days Alentejo wine focus"},{t:"11:10",msg:"Day 3 revised — Évora Cathedral slot confirmed"}],
    cmds:[{icon:"✨",label:"Generate Itinerary"},{icon:"📅",label:"Check Availability"},{icon:"🔄",label:"Revise Day"},{icon:"📍",label:"Optimize Route"},{icon:"➡️",label:"Send to Pricing",primary:true}],
    approval:false },
  { id:"pricing", label:"Pricing & Margin Control", icon:"💶", color:"#fbbf24", status:"active",
    mission:"Calculate net cost, apply markup rules, enforce minimum margins",
    metrics:[{k:"Avg margin",v:"27%"},{k:"Floor rule",v:"≥20%"},{k:"Calc today",v:"6"},{k:"Blocked",v:"1"}],
    pipeline:[{label:"Input",count:6,state:"done"},{label:"Calculate",count:6,state:"done"},{label:"Flagged",count:1,state:"active"},{label:"Approved",count:5,state:""}],
    progress:[{label:"Margin floor compliance",pct:83},{label:"Supplier rate freshness",pct:94}],
    logs:[{t:"11:40",msg:"<strong>TRIP-098</strong> margin: 24.6% ✓ — passed floor check"},{t:"11:15",msg:"<strong>TRIP-097</strong> BLOCKED — margin 17.2% below 20% floor"}],
    cmds:[{icon:"🧮",label:"Calculate Trip"},{icon:"📊",label:"Margin Report"},{icon:"🔧",label:"Edit Markup Rules"},{icon:"⚠️",label:"View Blocked"},{icon:"✅",label:"Approve & Lock Price",primary:true}],
    approval:{msg:"Margin exceptions below 20% require CEO override."} },
  { id:"operations", label:"Operations Coordinator", icon:"⚙️", color:"#60a5fa", status:"active",
    mission:"Book suppliers, generate docs, coordinate trip logistics",
    metrics:[{k:"Active trips",v:"8"},{k:"Bookings/wk",v:"19"},{k:"Docs issued",v:"12"},{k:"Alerts",v:"1"}],
    pipeline:[{label:"Deposit paid",count:8,state:"done"},{label:"Supplier booked",count:6,state:"done"},{label:"Docs sent",count:4,state:"active"},{label:"Complete",count:2,state:""}],
    progress:[{label:"Supplier confirmation rate",pct:97},{label:"Doc delivery 48h before trip",pct:90}],
    logs:[{t:"11:50",msg:"Hotel booked: <strong>Bairro Alto Hotel</strong> · 2 nights · TRIP-094"},{t:"11:22",msg:"Driver assigned: <strong>Carlos M.</strong> · Porto airport pickup"}],
    cmds:[{icon:"📋",label:"Book Supplier"},{icon:"📄",label:"Generate Docs"},{icon:"🚗",label:"Assign Driver"},{icon:"🔔",label:"Send Reminders"},{icon:"✅",label:"Confirm All & Close",primary:true}],
    approval:false },
  { id:"supplier", label:"Supplier Communication", icon:"📡", color:"#f472b6", status:"active",
    mission:"Draft & send supplier emails, track confirmations, log responses",
    metrics:[{k:"Emails/wk",v:"42"},{k:"Resp. rate",v:"94%"},{k:"Avg resp.",v:"3.2h"},{k:"Pending",v:"3"}],
    pipeline:[{label:"Drafted",count:42,state:"done"},{label:"Sent",count:42,state:"done"},{label:"Confirmed",count:39,state:"active"},{label:"Logged",count:39,state:""}],
    progress:[{label:"Auto-confirm rate",pct:78},{label:"CRM log sync",pct:100}],
    logs:[{t:"11:55",msg:"Confirmation received from <strong>Quinta do Crasto</strong> — logged"},{t:"11:30",msg:"Reminder sent to <strong>Pena Palace Guide</strong> (no reply 24h)"}],
    cmds:[{icon:"✉️",label:"Draft Email"},{icon:"📬",label:"Send Batch"},{icon:"🔄",label:"Chase Pending"},{icon:"📝",label:"Log Response"},{icon:"🔗",label:"Sync to CRM",primary:true}],
    approval:false },
  { id:"crm", label:"CRM Manager (NetHunt)", icon:"🗃️", color:"#2dd4be", status:"active",
    mission:"Keep NetHunt records clean, staged, tagged and synced in real-time",
    metrics:[{k:"Records",v:"412"},{k:"Updated today",v:"28"},{k:"Stale alerts",v:"4"},{k:"Accuracy",v:"98%"}],
    pipeline:[{label:"New",count:6,state:"done"},{label:"Updated",count:28,state:"done"},{label:"Stale",count:4,state:"active"},{label:"Archived",count:2,state:""}],
    progress:[{label:"Field completion rate",pct:92},{label:"Duplicate check pass",pct:100}],
    logs:[{t:"12:00",msg:"<strong>NH-2041</strong> updated: stage → Proposal Sent · tag → Luxury"},{t:"11:48",msg:"4 stale records flagged (>7 days no activity)"}],
    cmds:[{icon:"➕",label:"Create Record"},{icon:"🔄",label:"Sync CRM"},{icon:"🏷️",label:"Auto-tag Leads"},{icon:"🧹",label:"Clean Stale Records"},{icon:"📊",label:"Stage Report",primary:true}],
    approval:false },
  { id:"payment", label:"Payment Monitoring", icon:"💳", color:"#fbbf24", status:"active",
    mission:"Track Stripe & WeTravel payments, match to trips, trigger ops",
    metrics:[{k:"Received/wk",v:"€18.4k"},{k:"Pending",v:"€6.2k"},{k:"Overdue",v:"2"},{k:"Disputes",v:"0"}],
    pipeline:[{label:"Invoiced",count:12,state:"done"},{label:"Deposit rcv",count:9,state:"done"},{label:"Balance due",count:4,state:"active"},{label:"Full paid",count:5,state:""}],
    progress:[{label:"On-time payment rate",pct:83},{label:"Webhook match accuracy",pct:100}],
    logs:[{t:"12:05",msg:"Stripe €1,200 matched → <strong>TRIP-094</strong> deposit confirmed"},{t:"11:30",msg:"WeTravel link sent to <strong>NH-2039</strong> — balance €3,400 due 14 Mar"}],
    cmds:[{icon:"🔗",label:"Send Pay Link"},{icon:"📥",label:"Check Webhooks"},{icon:"⚠️",label:"Chase Overdue"},{icon:"📊",label:"Revenue Report"},{icon:"✅",label:"Mark as Paid & Trigger Ops",primary:true}],
    approval:false },
  { id:"support", label:"Customer Support · Pre-Trip", icon:"💬", color:"#34d399", status:"idle",
    mission:"Answer client questions, send pre-trip info packs, handle changes",
    metrics:[{k:"Open tickets",v:"3"},{k:"Avg resp.",v:"22 min"},{k:"CSAT",v:"4.9/5"},{k:"Escalated",v:"0"}],
    pipeline:[{label:"Received",count:8,state:"done"},{label:"Auto-resolved",count:5,state:"done"},{label:"Escalated",count:0,state:"active"},{label:"Closed",count:5,state:""}],
    progress:[{label:"Auto-resolution rate",pct:63},{label:"< 1h response SLA",pct:95}],
    logs:[{t:"10:30",msg:"Info pack sent to <strong>NH-2030</strong> (trip departs 5 Mar)"},{t:"09:15",msg:"Luggage query answered: checked KB → auto-reply sent"}],
    cmds:[{icon:"📩",label:"View Tickets"},{icon:"📦",label:"Send Info Pack"},{icon:"↩️",label:"Handle Change Req"},{icon:"🚨",label:"Escalate to CEO"},{icon:"✅",label:"Mark Resolved",primary:true}],
    approval:false },
  { id:"review", label:"Review & Reputation", icon:"⭐", color:"#f472b6", status:"idle",
    mission:"Request reviews post-trip, monitor platforms, flag negative sentiment",
    metrics:[{k:"Reviews/m",v:"19"},{k:"Avg rating",v:"4.92"},{k:"TripAdvisor",v:"#3"},{k:"Responded",v:"100%"}],
    pipeline:[{label:"Trip ended",count:6,state:"done"},{label:"Request sent",count:6,state:"done"},{label:"Review rcvd",count:4,state:"active"},{label:"Responded",count:4,state:""}],
    progress:[{label:"Review request rate",pct:100},{label:"Response within 24h",pct:100}],
    logs:[{t:"09:00",msg:"Review request sent to <strong>NH-2025</strong> (trip ended 28 Feb)"},{t:"Yesterday",msg:"5★ review received on Google — response drafted"}],
    cmds:[{icon:"📧",label:"Send Review Request"},{icon:"🔍",label:"Monitor Platforms"},{icon:"💬",label:"Draft Response"},{icon:"🚨",label:"Flag Negative Review"},{icon:"📊",label:"Reputation Report",primary:true}],
    approval:{msg:"Responses to negative reviews (≤3★) require CEO approval."} },
  { id:"marketing", label:"Marketing Content", icon:"📣", color:"#a78bfa", status:"idle",
    mission:"Generate social posts, email sequences, campaigns from trip data",
    metrics:[{k:"Posts/wk",v:"5"},{k:"Emails/m",v:"3"},{k:"Open rate",v:"38%"},{k:"Leads gen'd",v:"6"}],
    pipeline:[{label:"Brief",count:3,state:"done"},{label:"Drafted",count:3,state:"done"},{label:"Review",count:2,state:"active"},{label:"Published",count:1,state:""}],
    progress:[{label:"Brand voice compliance",pct:96},{label:"SEO keyword match",pct:74}],
    logs:[{t:"09:40",msg:"Instagram caption drafted: Douro Valley spring collection"},{t:"Yesterday",msg:"Email newsletter scheduled: March wine tours promo"}],
    cmds:[{icon:"✍️",label:"Write Social Post"},{icon:"📧",label:"Email Campaign"},{icon:"📝",label:"Blog Post"},{icon:"📸",label:"Caption for Photo"},{icon:"🚀",label:"Schedule & Publish",primary:true}],
    approval:{msg:"All external content requires review before publishing."} },
  { id:"ceo", label:"CEO Strategic Advisor", icon:"🎯", color:"#c9a84c", status:"idle",
    mission:"Surface KPIs, margin trends, conversion data & strategic alerts",
    metrics:[{k:"MTD Revenue",v:"€48.2k"},{k:"Avg margin",v:"27%"},{k:"Conv. rate",v:"31%"},{k:"Leads",v:"89"}],
    pipeline:[{label:"Data pull",count:1,state:"done"},{label:"Analysis",count:1,state:"done"},{label:"Insights",count:1,state:"active"},{label:"Reported",count:0,state:""}],
    progress:[{label:"Revenue vs target",pct:81},{label:"Margin vs target (30%)",pct:90}],
    logs:[{t:"08:00",msg:"Weekly KPI digest sent: 31% conv. rate (+4pp MoM)"},{t:"Mon",msg:"Margin drop alert: B2B segment fell to 19.8%"}],
    cmds:[{icon:"📊",label:"KPI Dashboard"},{icon:"📈",label:"Revenue Forecast"},{icon:"⚠️",label:"Risk Alerts"},{icon:"💡",label:"Strategic Insight"},{icon:"📋",label:"Weekly Digest",primary:true}],
    approval:false },
];

const NAV_GROUPS = [
  { label:"Sales", agents:["sales-tm","sales-b2b"] },
  { label:"Build", agents:["proposal","itinerary","pricing"] },
  { label:"Operations", agents:["operations","supplier"] },
  { label:"Systems", agents:["crm","payment"] },
  { label:"Client", agents:["support","review"] },
  { label:"Growth", agents:["marketing","ceo"] },
];

const GLOBAL_KPI = [
  {label:"MTD Revenue",value:"€48.2k",delta:"+12% vs last month"},
  {label:"Active Leads",value:"89",delta:"+6 this week"},
  {label:"Avg. Margin",value:"27%",delta:"↑ 2pp MoM"},
  {label:"Agents Online",value:"9/13",delta:"4 on standby"},
];

// ── AgentPage ─────────────────────────────────────────────────────────────────
function AgentPage({ agent, onBack }: { agent: Agent; onBack: () => void }) {
  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [approvalState, setApprovalState] = useState<string | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);

  useEffect(() => {
    if (agent.id === "ceo") {
      api.get("/ceo/approvals/pending")
        .then(d => setPendingApprovals(d.approvals || []))
        .catch(() => {});
    }
  }, [agent.id]);

  const runCommand = useCallback(async (cmdLabel: string) => {
    const endpoints = COMMAND_ENDPOINTS[agent.id] || {};
    const fn = endpoints[cmdLabel];
    if (!fn) {
      setResult({ note: `Command "${cmdLabel}" — wire up in COMMAND_ENDPOINTS with real trip/lead data` });
      return;
    }
    setLoading(cmdLabel);
    setResult(null);
    setError(null);
    try {
      const data = await fn({ trip_id: "TRIP-098", lead_id: "NH-2041", crm_id: "NH-2041", topic: "Portugal spring travel" });
      setResult(data);
      setTab("output");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(null);
    }
  }, [agent.id]);

  const decideApproval = useCallback(async (id: string, decision: string) => {
    try {
      await api.post(`/ceo/approvals/${id}/decide`, { decision });
      setPendingApprovals(p => p.filter(a => a.id !== id));
      setApprovalState(decision);
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  return (
    <div>
      <div className="ag-topbar">
        <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
          <button onClick={onBack} style={{background:"none",border:"1px solid var(--ag-border)",borderRadius:"4px",color:"var(--ag-text-dim)",cursor:"pointer",padding:"5px 10px",fontSize:"11px",fontFamily:"'DM Mono',monospace"}}>← Back</button>
          <span className="ag-topbar-title">{agent.icon} {agent.label}</span>
        </div>
        <div className="ag-status-pills">
          <div className="ag-pill green"><span className="ag-pill-dot"/>API Connected</div>
          <div className="ag-pill gold"><span className="ag-pill-dot"/>NetHunt Synced</div>
        </div>
      </div>

      <div className="ag-tabs">
        {["overview","commands","output","logs"].map(t => (
          <div key={t} className={`ag-tab ${tab===t?"active":""}`} onClick={() => setTab(t)}>{t}</div>
        ))}
        {agent.id === "ceo" && pendingApprovals.length > 0 && (
          <div className={`ag-tab ${tab==="approvals"?"active":""}`} onClick={() => setTab("approvals")} style={{color:"var(--ag-amber)"}}>
            Approvals <span className="ag-badge" style={{background:"var(--ag-red)"}}>{pendingApprovals.length}</span>
          </div>
        )}
      </div>

      {tab === "overview" && (
        <>
          <div className="ag-metrics-row" style={{borderBottom:"1px solid var(--ag-border)"}}>
            {agent.metrics.map(m => (
              <div className="ag-metric" key={m.k}>
                <div className="ag-metric-val">{m.v}</div>
                <div className="ag-metric-key">{m.k}</div>
              </div>
            ))}
          </div>
          <div style={{padding:"16px 24px",borderBottom:"1px solid var(--ag-border)"}}>
            <div className="ag-section-label">Pipeline</div>
            <div style={{display:"flex",gap:"2px"}}>
              {agent.pipeline.map((p,i) => (
                <div key={i} className={`ag-pipe-stage ${p.state}`}>
                  <div className="ag-pipe-count">{p.count}</div>
                  <div className="ag-pipe-label">{p.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr"}}>
            <div style={{padding:"20px 24px",borderRight:"1px solid var(--ag-border)"}}>
              <div className="ag-section-label">Progress</div>
              {agent.progress.map(p => (
                <div className="ag-progress-bar-wrap" key={p.label}>
                  <div className="ag-progress-bar-label"><span>{p.label}</span><span>{p.pct}%</span></div>
                  <div className="ag-progress-bar-bg"><div className="ag-progress-bar-fill" style={{width:`${p.pct}%`}}/></div>
                </div>
              ))}
              {agent.approval && !approvalState && (
                <div className="ag-approval-card" style={{marginTop:"16px"}}>
                  <div style={{fontSize:"20px"}}>🔐</div>
                  <div style={{flex:1,fontSize:"11px",color:"var(--ag-text-dim)",lineHeight:1.5}}>
                    <strong style={{color:"var(--ag-amber)",display:"block",marginBottom:"2px"}}>CEO Approval Required</strong>
                    {agent.approval.msg}
                  </div>
                </div>
              )}
              {approvalState && (
                <div style={{marginTop:"12px",fontSize:"11px",fontFamily:"'DM Mono',monospace",color:approvalState==="approve"?"var(--ag-green)":"var(--ag-red)"}}>
                  ✓ {approvalState === "approve" ? "Approved" : "Rejected"}
                </div>
              )}
            </div>
            <div style={{padding:"20px 24px"}}>
              <div className="ag-section-label">Activity Log</div>
              <div className="ag-log-list">
                {agent.logs.map((l,i) => (
                  <div className="ag-log-item" key={i}>
                    <span className="ag-log-time">{l.t}</span>
                    <span className="ag-log-msg" dangerouslySetInnerHTML={{__html:l.msg}}/>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {tab === "commands" && (
        <div style={{padding:"24px"}}>
          <div className="ag-section-label" style={{marginBottom:"16px"}}>Command Center</div>
          <div className="ag-cmd-grid">
            {agent.cmds.map((c,i) => (
              <button
                key={i}
                className={`ag-cmd-btn ${c.primary?"primary":""} ${loading===c.label?"loading":""}`}
                disabled={!!loading}
                onClick={() => runCommand(c.label)}
              >
                <span style={{fontSize:"14px"}}>{c.icon}</span>
                {loading === c.label ? "Running…" : c.label}
              </button>
            ))}
          </div>
          <div style={{marginTop:"20px",padding:"14px",background:"var(--ag-surface2)",borderRadius:"6px",border:"1px solid var(--ag-border)"}}>
            <div className="ag-section-label" style={{marginBottom:"8px"}}>API Endpoint</div>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:"11px",color:"var(--ag-teal)"}}>
              POST {API_BASE}/orchestrator/event<br/>
              <span style={{color:"var(--ag-text-muted)"}}>{"{ "}"agent_id": "{agent.id}", "command": "..."{"}"}</span>
            </div>
          </div>
        </div>
      )}

      {tab === "output" && (
        <div style={{padding:"24px"}}>
          {error && (
            <div className="ag-error-panel">
              <div className="ag-error-title">⚠ API Error</div>
              <div style={{fontSize:"11px",color:"var(--ag-red)",fontFamily:"'DM Mono',monospace"}}>{error}</div>
            </div>
          )}
          {result && (
            <div className="ag-result-panel">
              <div className="ag-result-title">✓ Agent Response</div>
              <div className="ag-json-preview">{JSON.stringify(result, null, 2)}</div>
            </div>
          )}
          {!result && !error && (
            <div style={{color:"var(--ag-text-muted)",fontSize:"12px",fontFamily:"'DM Mono',monospace",padding:"20px 0"}}>
              Run a command to see the agent output here.
            </div>
          )}
        </div>
      )}

      {tab === "logs" && (
        <div style={{padding:"24px"}}>
          <div className="ag-section-label" style={{marginBottom:"12px"}}>Activity Log</div>
          <div className="ag-log-list">
            {[...agent.logs,...agent.logs].map((l,i) => (
              <div className="ag-log-item" key={i}>
                <span className="ag-log-time">{l.t}</span>
                <span className="ag-log-msg" dangerouslySetInnerHTML={{__html:l.msg}}/>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "approvals" && (
        <div style={{padding:"24px"}}>
          <div className="ag-section-label" style={{marginBottom:"16px"}}>Pending CEO Approvals — {pendingApprovals.length} items</div>
          {pendingApprovals.length === 0 && <div style={{color:"var(--ag-text-muted)",fontSize:"12px",fontFamily:"'DM Mono',monospace"}}>No pending approvals.</div>}
          <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
            {pendingApprovals.map((a: any) => (
              <div key={a.id} className="ag-approval-card">
                <div style={{fontSize:"20px"}}>🔐</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:"12px",color:"var(--ag-amber)",fontWeight:600,marginBottom:"4px"}}>{a.type.replace(/_/g," ").toUpperCase()}</div>
                  <div style={{fontSize:"11px",color:"var(--ag-text-dim)",lineHeight:1.5}}>{a.description}</div>
                  <div style={{fontSize:"10px",color:"var(--ag-text-muted)",fontFamily:"'DM Mono',monospace",marginTop:"4px"}}>Agent: {a.agent} · Ref: {a.reference}</div>
                </div>
                <div style={{display:"flex",gap:"6px"}}>
                  <button className="ag-btn-approve" onClick={() => decideApproval(a.id,"approve")}>Approve</button>
                  <button className="ag-btn-reject" onClick={() => decideApproval(a.id,"reject")}>Reject</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AgentDashboardPage() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [liveKpi, setLiveKpi] = useState<any>(null);
  const activeAgent = AGENTS.find(a => a.id === activeId);

  useEffect(() => {
    api.get("/ceo/kpi").then(d => setLiveKpi(d.kpis)).catch(() => {});
  }, []);

  return (
    <>
      <style>{agentStyles}</style>
      <div className="agent-dashboard">
        {/* SIDEBAR */}
        <nav className="ag-sidebar">
          <div className="ag-logo">
            <div className="ag-logo-title">Your Tours Portugal</div>
            <div className="ag-logo-sub">AI Agent Ecosystem</div>
          </div>
          <div className="ag-nav-section" style={{paddingTop:"12px",paddingBottom:"0"}}>
            <div className={`ag-nav-item ${!activeId?"active":""}`} onClick={() => setActiveId(null)}>
              <span style={{fontSize:"13px"}}>⬡</span> Orchestrator
              <span className="ag-badge">Live</span>
            </div>
          </div>
          {NAV_GROUPS.map(g => (
            <div className="ag-nav-section" key={g.label}>
              <div className="ag-nav-label">{g.label}</div>
              {g.agents.map(id => {
                const a = AGENTS.find(x => x.id === id)!;
                return (
                  <div key={id} className={`ag-nav-item ${activeId===id?"active":""}`} onClick={() => setActiveId(id)}>
                    <span className="ag-nav-dot" style={{background:a.color}}/>
                    {a.label.split(" · ")[0]}
                    {a.status==="active" && <span className="ag-badge">On</span>}
                  </div>
                );
              })}
            </div>
          ))}
          <button className="ag-orch-btn" onClick={() => setActiveId(null)}>⬡ Orchestrator View</button>
        </nav>

        {/* MAIN */}
        <main className="ag-main">
          {activeAgent ? (
            <AgentPage agent={activeAgent} onBack={() => setActiveId(null)}/>
          ) : (
            <>
              <div className="ag-topbar">
                <div>
                  <div className="ag-topbar-title">⬡ Orchestrator — All Agents</div>
                  <div className="ag-topbar-meta">Sunday 01 March 2026 · {API_BASE}</div>
                </div>
                <div className="ag-status-pills">
                  <div className="ag-pill green"><span className="ag-pill-dot"/>9 Agents Active</div>
                  <div className="ag-pill gold"><span className="ag-pill-dot"/>NetHunt Live</div>
                </div>
              </div>
              <div className="ag-content">
                <div className="ag-kpi-row">
                  {GLOBAL_KPI.map(k => (
                    <div className="ag-kpi-card" key={k.label}>
                      <div className="ag-kpi-label">{k.label}</div>
                      <div className="ag-kpi-value">
                        {k.label === "MTD Revenue" && liveKpi ? `€${(liveKpi.revenue_mtd_eur/1000).toFixed(1)}k` : k.value}
                      </div>
                      <div className="ag-kpi-delta">{k.delta}</div>
                    </div>
                  ))}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(340px,1fr))",gap:"14px"}}>
                  {AGENTS.map(agent => (
                    <div key={agent.id} className="ag-agent-panel" onClick={() => setActiveId(agent.id)}>
                      <div className="ag-agent-header">
                        <div className="ag-agent-icon" style={{background:agent.color+"22",border:`1px solid ${agent.color}44`}}>{agent.icon}</div>
                        <div className="ag-agent-info">
                          <h2>{agent.label}</h2>
                          <p>{agent.mission.slice(0,52)}…</p>
                        </div>
                        <div style={{marginLeft:"auto"}}>
                          <div className={`ag-status-badge ${agent.status}`}>{agent.status}</div>
                        </div>
                      </div>
                      <div style={{padding:"12px 20px",display:"flex",gap:"12px",borderBottom:"1px solid var(--ag-border)"}}>
                        {agent.metrics.slice(0,2).map(m => (
                          <div key={m.k} style={{flex:1}}>
                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:"15px",color:"var(--ag-gold2)"}}>{m.v}</div>
                            <div style={{fontSize:"9px",color:"var(--ag-text-muted)",textTransform:"uppercase",letterSpacing:".1em"}}>{m.k}</div>
                          </div>
                        ))}
                        <div style={{flex:2,display:"flex",flexDirection:"column",gap:"6px",justifyContent:"center"}}>
                          {agent.progress.slice(0,1).map(p => (
                            <div key={p.label}>
                              <div className="ag-progress-bar-label" style={{margin:"0 0 3px"}}><span style={{fontSize:"9px"}}>{p.label}</span><span style={{fontSize:"9px"}}>{p.pct}%</span></div>
                              <div className="ag-progress-bar-bg"><div className="ag-progress-bar-fill" style={{width:`${p.pct}%`}}/></div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div style={{padding:"10px 20px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <span style={{fontSize:"10px",color:"var(--ag-text-muted)",fontFamily:"'DM Mono',monospace"}} dangerouslySetInnerHTML={{__html:agent.logs[0].msg.replace(/<[^>]*>/g,'').slice(0,45)+"…"}}/>
                        <span style={{fontSize:"10px",color:"var(--ag-teal)",fontFamily:"'DM Mono',monospace",whiteSpace:"nowrap"}}>Open →</span>
                      </div>
                      {agent.approval && (
                        <div style={{padding:"0 20px 10px"}}>
                          <span style={{fontSize:"9px",color:"var(--ag-amber)",fontFamily:"'DM Mono',monospace",background:"rgba(251,191,36,.08)",padding:"2px 8px",borderRadius:"4px",border:"1px solid rgba(251,191,36,.25)"}}>
                            🔐 CEO Approval Required
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </>
  );
}
