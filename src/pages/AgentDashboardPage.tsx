import { useState, useEffect, useCallback } from "react";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Zap, CheckCircle, XCircle } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

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

const COMMAND_ENDPOINTS: Record<string, Record<string, (d: any) => Promise<any>>> = {
  "sales-tm": {
    "Process New Lead": (d) => api.post("/orchestrator/event", { event_type: "new_lead", data: d }),
    "Push to Proposal": (d) => api.post("/orchestrator/event", { event_type: "lead_qualified", data: d }),
    "Send Follow-up": (d) => api.post("/sales/followup", d),
  },
  "sales-b2b": {
    "Send Net Rates": (d) => api.post("/orchestrator/event", { event_type: "new_b2b_inquiry", data: d }),
    "Confirm Booking": (d) => api.post("/sales/convert", d),
  },
  "proposal": {
    "Build Proposal": (d) => api.post("/orchestrator/event", { event_type: "pricing_approved", data: d }),
    "Attach to CRM": (d) => api.post("/crm/sync", { action: "attach_proposal", ...d }),
  },
  "itinerary": {
    "Generate Itinerary": (d) => api.post("/itinerary/generate", d),
    "Send to Pricing": (d) => api.post("/orchestrator/event", { event_type: "itinerary_complete", data: d }),
    "Revise Day": (d) => api.post("/itinerary/revise", d),
  },
  "pricing": {
    "Calculate Trip": (d) => api.post("/pricing/calculate", d),
    "Approve & Lock Price": (d) => api.post("/pricing/approve", d),
  },
  "operations": {
    "Book Supplier": (d) => api.post("/operations/book", d),
    "Generate Docs": (d) => api.post("/operations/generate-docs", d),
    "Send Reminders": (d) => api.post("/operations/send-reminders", d),
    "Confirm All & Close": (d) => api.post("/orchestrator/event", { event_type: "deposit_confirmed", data: d }),
  },
  "supplier": {
    "Draft Email": (d) => api.post("/supplier/email", { action: "inquiry", ...d }),
    "Send Batch": (d) => api.post("/supplier/email", { action: "booking", ...d }),
    "Chase Pending": (d) => api.post("/supplier/email", { action: "chase", ...d }),
    "Sync to CRM": (d) => api.post("/crm/sync", { action: "log_supplier", ...d }),
  },
  "crm": {
    "Sync CRM": (d) => api.post("/crm/sync", { action: "sync", ...d }),
    "Auto-tag Leads": (d) => api.post("/crm/sync", { action: "auto_tag", ...d }),
    "Clean Stale Records": () => api.get("/crm/clean-stale"),
    "Stage Report": () => api.get("/ceo/kpi"),
  },
  "payment": {
    "Send Pay Link": (d) => api.post("/payment/send-link", d),
    "Check Webhooks": (d) => api.get("/payment/status/" + (d.trip_id || "latest")),
    "Chase Overdue": () => api.post("/payment/chase-overdue", {}),
    "Mark as Paid & Trigger Ops": (d) => api.post("/orchestrator/event", { event_type: "payment_received", data: d }),
  },
  "support": {
    "View Tickets": () => api.get("/orchestrator/agents"),
    "Send Info Pack": (d) => api.post("/support/pretrip", d),
    "Mark Resolved": (d) => api.post("/support/pretrip", { ...d, resolved: true }),
  },
  "review": {
    "Send Review Request": (d) => api.post("/review/request", d),
    "Draft Response": (d) => api.post("/review/respond", d),
    "Reputation Report": () => api.get("/ceo/kpi"),
  },
  "marketing": {
    "Write Social Post": (d) => api.post("/marketing/generate", { type: "instagram", topic: d.topic || "Portugal travel" }),
    "Email Campaign": (d) => api.post("/marketing/generate", { type: "email", topic: d.topic || "Seasonal promo" }),
    "Blog Post": (d) => api.post("/marketing/generate", { type: "blog", topic: d.topic || "Hidden Portugal" }),
    "Schedule & Publish": (d) => api.post("/marketing/generate", { type: "instagram", topic: d.topic || "Portugal", schedule: true }),
  },
  "ceo": {
    "KPI Dashboard": () => api.get("/ceo/kpi"),
    "Weekly Digest": () => api.get("/ceo/kpi"),
    "Risk Alerts": () => api.get("/ceo/approvals/pending"),
  },
};

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

const AGENTS: Agent[] = [
  { id:"sales-tm", label:"Sales · Tailor-Made", icon:"🧭", color:"hsl(var(--primary))", status:"active",
    mission:"Qualify & convert inbound leads for custom multi-day trips",
    metrics:[{k:"Leads/wk",v:"24"},{k:"Qualified",v:"18"},{k:"Conv.%",v:"31%"},{k:"Avg.Value",v:"€3.8k"}],
    pipeline:[{label:"Inbound",count:24,state:"done"},{label:"Qualify",count:18,state:"done"},{label:"Proposal",count:9,state:"active"},{label:"Closed",count:5,state:""}],
    progress:[{label:"Weekly quota",pct:75},{label:"Response SLA < 2h",pct:91}],
    logs:[{t:"10:42",msg:"Lead <strong>NH-2041</strong> qualified → budget €4,200 · 5 pax · Douro"},{t:"10:18",msg:"Follow-up sent to <strong>NH-2038</strong> (48h no reply)"},{t:"09:55",msg:"Lead <strong>NH-2039</strong> disqualified → budget below floor"}],
    cmds:[{icon:"📥",label:"Process New Lead"},{icon:"📋",label:"View Queue"},{icon:"📤",label:"Send Follow-up"},{icon:"⛔",label:"Disqualify"},{icon:"➡️",label:"Push to Proposal",primary:true}],
    approval:false },
  { id:"sales-b2b", label:"Sales · B2B / Agencies", icon:"🤝", color:"hsl(var(--warning))", status:"active",
    mission:"Manage agency & partner accounts, net rates, volume contracts",
    metrics:[{k:"Partners",v:"12"},{k:"Bookings/m",v:"34"},{k:"Net Margin",v:"22%"},{k:"Pipeline",v:"€28k"}],
    pipeline:[{label:"Inquiry",count:8,state:"done"},{label:"Rate Sent",count:6,state:"done"},{label:"Negotiation",count:3,state:"active"},{label:"Contracted",count:2,state:""}],
    progress:[{label:"Partner SLA 4h",pct:87},{label:"Net rate accuracy",pct:99}],
    logs:[{t:"11:05",msg:"Net rate sheet sent to <strong>Nomadic Travel Agency</strong>"},{t:"10:33",msg:"Contract renewal triggered for <strong>Lisbon Tours Ltd</strong>"}],
    cmds:[{icon:"📑",label:"Send Net Rates"},{icon:"📊",label:"Volume Report"},{icon:"📝",label:"Draft Contract"},{icon:"📞",label:"Schedule Call"},{icon:"✅",label:"Confirm Booking",primary:true}],
    approval:{msg:"Contracts >€10k require CEO signature before sending."} },
  { id:"proposal", label:"Proposal Builder", icon:"📄", color:"hsl(270 60% 65%)", status:"active",
    mission:"Generate branded proposals from itinerary + pricing data",
    metrics:[{k:"Built today",v:"3"},{k:"Avg build",v:"4 min"},{k:"Accept rate",v:"68%"},{k:"Pending",v:"2"}],
    pipeline:[{label:"Draft",count:3,state:"done"},{label:"Review",count:2,state:"active"},{label:"Sent",count:1,state:""},{label:"Accepted",count:0,state:""}],
    progress:[{label:"On-brand compliance",pct:100},{label:"Margin lock ≥20%",pct:95}],
    logs:[{t:"11:20",msg:"Proposal <strong>PROP-341</strong> generated · 5 days Porto + Douro"},{t:"10:58",msg:"PDF exported · linked to <strong>NH-2041</strong>"}],
    cmds:[{icon:"🔨",label:"Build Proposal"},{icon:"👁️",label:"Preview PDF"},{icon:"✏️",label:"Edit Draft"},{icon:"📬",label:"Send to Client"},{icon:"📎",label:"Attach to CRM",primary:true}],
    approval:{msg:"Proposals over €8,000 require CEO review before dispatch."} },
  { id:"itinerary", label:"Itinerary Architect", icon:"🗺️", color:"hsl(var(--success))", status:"active",
    mission:"Build day-by-day itineraries from brief, interests & region data",
    metrics:[{k:"Built/wk",v:"11"},{k:"Avg days",v:"5.2"},{k:"Revisions",v:"1.3x"},{k:"Regions",v:"7"}],
    pipeline:[{label:"Brief In",count:11,state:"done"},{label:"Draft",count:8,state:"done"},{label:"Pricing",count:5,state:"active"},{label:"Approved",count:3,state:""}],
    progress:[{label:"Knowledge base coverage",pct:88},{label:"Supplier availability check",pct:76}],
    logs:[{t:"11:35",msg:"Itinerary <strong>IT-211</strong> built: 6 days Alentejo wine focus"},{t:"11:10",msg:"Day 3 revised — Évora Cathedral slot confirmed"}],
    cmds:[{icon:"✨",label:"Generate Itinerary"},{icon:"📅",label:"Check Availability"},{icon:"🔄",label:"Revise Day"},{icon:"📍",label:"Optimize Route"},{icon:"➡️",label:"Send to Pricing",primary:true}],
    approval:false },
  { id:"pricing", label:"Pricing & Margin Control", icon:"💶", color:"hsl(var(--warning))", status:"active",
    mission:"Calculate net cost, apply markup rules, enforce minimum margins",
    metrics:[{k:"Avg margin",v:"27%"},{k:"Floor rule",v:"≥20%"},{k:"Calc today",v:"6"},{k:"Blocked",v:"1"}],
    pipeline:[{label:"Input",count:6,state:"done"},{label:"Calculate",count:6,state:"done"},{label:"Flagged",count:1,state:"active"},{label:"Approved",count:5,state:""}],
    progress:[{label:"Margin floor compliance",pct:83},{label:"Supplier rate freshness",pct:94}],
    logs:[{t:"11:40",msg:"<strong>TRIP-098</strong> margin: 24.6% ✓ — passed floor check"},{t:"11:15",msg:"<strong>TRIP-097</strong> BLOCKED — margin 17.2% below 20% floor"}],
    cmds:[{icon:"🧮",label:"Calculate Trip"},{icon:"📊",label:"Margin Report"},{icon:"🔧",label:"Edit Markup Rules"},{icon:"⚠️",label:"View Blocked"},{icon:"✅",label:"Approve & Lock Price",primary:true}],
    approval:{msg:"Margin exceptions below 20% require CEO override."} },
  { id:"operations", label:"Operations Coordinator", icon:"⚙️", color:"hsl(var(--info))", status:"active",
    mission:"Book suppliers, generate docs, coordinate trip logistics",
    metrics:[{k:"Active trips",v:"8"},{k:"Bookings/wk",v:"19"},{k:"Docs issued",v:"12"},{k:"Alerts",v:"1"}],
    pipeline:[{label:"Deposit paid",count:8,state:"done"},{label:"Supplier booked",count:6,state:"done"},{label:"Docs sent",count:4,state:"active"},{label:"Complete",count:2,state:""}],
    progress:[{label:"Supplier confirmation rate",pct:97},{label:"Doc delivery 48h before trip",pct:90}],
    logs:[{t:"11:50",msg:"Hotel booked: <strong>Bairro Alto Hotel</strong> · 2 nights · TRIP-094"},{t:"11:22",msg:"Driver assigned: <strong>Carlos M.</strong> · Porto airport pickup"}],
    cmds:[{icon:"📋",label:"Book Supplier"},{icon:"📄",label:"Generate Docs"},{icon:"🚗",label:"Assign Driver"},{icon:"🔔",label:"Send Reminders"},{icon:"✅",label:"Confirm All & Close",primary:true}],
    approval:false },
  { id:"supplier", label:"Supplier Communication", icon:"📡", color:"hsl(330 70% 60%)", status:"active",
    mission:"Draft & send supplier emails, track confirmations, log responses",
    metrics:[{k:"Emails/wk",v:"42"},{k:"Resp. rate",v:"94%"},{k:"Avg resp.",v:"3.2h"},{k:"Pending",v:"3"}],
    pipeline:[{label:"Drafted",count:42,state:"done"},{label:"Sent",count:42,state:"done"},{label:"Confirmed",count:39,state:"active"},{label:"Logged",count:39,state:""}],
    progress:[{label:"Auto-confirm rate",pct:78},{label:"CRM log sync",pct:100}],
    logs:[{t:"11:55",msg:"Confirmation received from <strong>Quinta do Crasto</strong> — logged"},{t:"11:30",msg:"Reminder sent to <strong>Pena Palace Guide</strong> (no reply 24h)"}],
    cmds:[{icon:"✉️",label:"Draft Email"},{icon:"📬",label:"Send Batch"},{icon:"🔄",label:"Chase Pending"},{icon:"📝",label:"Log Response"},{icon:"🔗",label:"Sync to CRM",primary:true}],
    approval:false },
  { id:"crm", label:"CRM Manager (NetHunt)", icon:"🗃️", color:"hsl(var(--primary))", status:"active",
    mission:"Keep NetHunt records clean, staged, tagged and synced in real-time",
    metrics:[{k:"Records",v:"412"},{k:"Updated today",v:"28"},{k:"Stale alerts",v:"4"},{k:"Accuracy",v:"98%"}],
    pipeline:[{label:"New",count:6,state:"done"},{label:"Updated",count:28,state:"done"},{label:"Stale",count:4,state:"active"},{label:"Archived",count:2,state:""}],
    progress:[{label:"Field completion rate",pct:92},{label:"Duplicate check pass",pct:100}],
    logs:[{t:"12:00",msg:"<strong>NH-2041</strong> updated: stage → Proposal Sent · tag → Luxury"},{t:"11:48",msg:"4 stale records flagged (>7 days no activity)"}],
    cmds:[{icon:"➕",label:"Create Record"},{icon:"🔄",label:"Sync CRM"},{icon:"🏷️",label:"Auto-tag Leads"},{icon:"🧹",label:"Clean Stale Records"},{icon:"📊",label:"Stage Report",primary:true}],
    approval:false },
  { id:"payment", label:"Payment Monitoring", icon:"💳", color:"hsl(var(--warning))", status:"active",
    mission:"Track Stripe & WeTravel payments, match to trips, trigger ops",
    metrics:[{k:"Received/wk",v:"€18.4k"},{k:"Pending",v:"€6.2k"},{k:"Overdue",v:"2"},{k:"Disputes",v:"0"}],
    pipeline:[{label:"Invoiced",count:12,state:"done"},{label:"Deposit rcv",count:9,state:"done"},{label:"Balance due",count:4,state:"active"},{label:"Full paid",count:5,state:""}],
    progress:[{label:"On-time payment rate",pct:83},{label:"Webhook match accuracy",pct:100}],
    logs:[{t:"12:05",msg:"Stripe €1,200 matched → <strong>TRIP-094</strong> deposit confirmed"},{t:"11:30",msg:"WeTravel link sent to <strong>NH-2039</strong> — balance €3,400 due 14 Mar"}],
    cmds:[{icon:"🔗",label:"Send Pay Link"},{icon:"📥",label:"Check Webhooks"},{icon:"⚠️",label:"Chase Overdue"},{icon:"📊",label:"Revenue Report"},{icon:"✅",label:"Mark as Paid & Trigger Ops",primary:true}],
    approval:false },
  { id:"support", label:"Customer Support · Pre-Trip", icon:"💬", color:"hsl(var(--success))", status:"idle",
    mission:"Answer client questions, send pre-trip info packs, handle changes",
    metrics:[{k:"Open tickets",v:"3"},{k:"Avg resp.",v:"22 min"},{k:"CSAT",v:"4.9/5"},{k:"Escalated",v:"0"}],
    pipeline:[{label:"Received",count:8,state:"done"},{label:"Auto-resolved",count:5,state:"done"},{label:"Escalated",count:0,state:"active"},{label:"Closed",count:5,state:""}],
    progress:[{label:"Auto-resolution rate",pct:63},{label:"< 1h response SLA",pct:95}],
    logs:[{t:"10:30",msg:"Info pack sent to <strong>NH-2030</strong> (trip departs 5 Mar)"},{t:"09:15",msg:"Luggage query answered: checked KB → auto-reply sent"}],
    cmds:[{icon:"📩",label:"View Tickets"},{icon:"📦",label:"Send Info Pack"},{icon:"↩️",label:"Handle Change Req"},{icon:"🚨",label:"Escalate to CEO"},{icon:"✅",label:"Mark Resolved",primary:true}],
    approval:false },
  { id:"review", label:"Review & Reputation", icon:"⭐", color:"hsl(330 70% 60%)", status:"idle",
    mission:"Request reviews post-trip, monitor platforms, flag negative sentiment",
    metrics:[{k:"Reviews/m",v:"19"},{k:"Avg rating",v:"4.92"},{k:"TripAdvisor",v:"#3"},{k:"Responded",v:"100%"}],
    pipeline:[{label:"Trip ended",count:6,state:"done"},{label:"Request sent",count:6,state:"done"},{label:"Review rcvd",count:4,state:"active"},{label:"Responded",count:4,state:""}],
    progress:[{label:"Review request rate",pct:100},{label:"Response within 24h",pct:100}],
    logs:[{t:"09:00",msg:"Review request sent to <strong>NH-2025</strong> (trip ended 28 Feb)"},{t:"Yesterday",msg:"5★ review received on Google — response drafted"}],
    cmds:[{icon:"📧",label:"Send Review Request"},{icon:"🔍",label:"Monitor Platforms"},{icon:"💬",label:"Draft Response"},{icon:"🚨",label:"Flag Negative Review"},{icon:"📊",label:"Reputation Report",primary:true}],
    approval:{msg:"Responses to negative reviews (≤3★) require CEO approval."} },
  { id:"marketing", label:"Marketing Content", icon:"📣", color:"hsl(270 60% 65%)", status:"idle",
    mission:"Generate social posts, email sequences, campaigns from trip data",
    metrics:[{k:"Posts/wk",v:"5"},{k:"Emails/m",v:"3"},{k:"Open rate",v:"38%"},{k:"Leads gen'd",v:"6"}],
    pipeline:[{label:"Brief",count:3,state:"done"},{label:"Drafted",count:3,state:"done"},{label:"Review",count:2,state:"active"},{label:"Published",count:1,state:""}],
    progress:[{label:"Brand voice compliance",pct:96},{label:"SEO keyword match",pct:74}],
    logs:[{t:"09:40",msg:"Instagram caption drafted: Douro Valley spring collection"},{t:"Yesterday",msg:"Email newsletter scheduled: March wine tours promo"}],
    cmds:[{icon:"✍️",label:"Write Social Post"},{icon:"📧",label:"Email Campaign"},{icon:"📝",label:"Blog Post"},{icon:"📸",label:"Caption for Photo"},{icon:"🚀",label:"Schedule & Publish",primary:true}],
    approval:{msg:"All external content requires review before publishing."} },
  { id:"ceo", label:"CEO Strategic Advisor", icon:"🎯", color:"hsl(var(--urgent))", status:"idle",
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

// ── Agent Detail Page ─────────────────────────────────────────────────────────
function AgentPage({ agent, onBack }: { agent: Agent; onBack: () => void }) {
  const [loading, setLoading] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
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
      setResult({ note: `Command "${cmdLabel}" — wire up endpoint` });
      return;
    }
    setLoading(cmdLabel); setResult(null); setError(null);
    try {
      const data = await fn({ trip_id: "TRIP-098", lead_id: "NH-2041", crm_id: "NH-2041", topic: "Portugal spring travel" });
      setResult(data);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(null); }
  }, [agent.id]);

  const decideApproval = useCallback(async (id: string, decision: string) => {
    try {
      await api.post(`/ceo/approvals/${id}/decide`, { decision });
      setPendingApprovals(p => p.filter(a => a.id !== id));
    } catch (e: any) { setError(e.message); }
  }, []);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" />Back</Button>
          <span className="text-2xl">{agent.icon}</span>
          <div>
            <h1 className="text-xl font-semibold text-foreground">{agent.label}</h1>
            <p className="text-xs text-muted-foreground font-mono">{agent.mission}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Badge variant={agent.status === "active" ? "default" : "secondary"} className="uppercase text-[10px] tracking-wider">
            {agent.status}
          </Badge>
          <Badge variant="outline" className="text-[10px] font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-success mr-1.5 animate-pulse" />API Connected
          </Badge>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="commands">Commands</TabsTrigger>
          <TabsTrigger value="output">Output</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          {agent.id === "ceo" && pendingApprovals.length > 0 && (
            <TabsTrigger value="approvals" className="text-destructive">
              Approvals <Badge variant="destructive" className="ml-1 text-[9px] px-1.5">{pendingApprovals.length}</Badge>
            </TabsTrigger>
          )}
        </TabsList>

        {/* OVERVIEW */}
        <TabsContent value="overview" className="space-y-4">
          {/* KPI metrics */}
          <div className="grid grid-cols-4 gap-3">
            {agent.metrics.map(m => (
              <Card key={m.k}>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-semibold text-primary">{m.v}</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">{m.k}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pipeline */}
          <Card>
            <CardHeader className="pb-2">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Pipeline</p>
            </CardHeader>
            <CardContent>
              <div className="flex gap-1">
                {agent.pipeline.map((p, i) => (
                  <div key={i} className={`flex-1 text-center rounded-md border p-3 ${
                    p.state === "active" ? "border-primary bg-primary/5" :
                    p.state === "done" ? "border-success/30 bg-success/5" :
                    "border-border"
                  }`}>
                    <p className="text-xl font-semibold text-foreground">{p.count}</p>
                    <p className={`text-[9px] uppercase tracking-wider mt-1 ${p.state === "active" ? "text-primary" : "text-muted-foreground"}`}>{p.label}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-4">
            {/* Progress */}
            <Card>
              <CardHeader className="pb-2">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Progress</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {agent.progress.map(p => (
                  <div key={p.label}>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1 font-mono">
                      <span>{p.label}</span><span>{p.pct}%</span>
                    </div>
                    <Progress value={p.pct} className="h-1.5" />
                  </div>
                ))}
                {agent.approval && (
                  <div className="mt-3 p-3 rounded-md border border-warning/40 bg-warning-muted flex items-start gap-3">
                    <span className="text-lg">🔐</span>
                    <div>
                      <p className="text-xs font-semibold text-warning">CEO Approval Required</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{agent.approval.msg}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Activity */}
            <Card>
              <CardHeader className="pb-2">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Activity Log</p>
              </CardHeader>
              <CardContent className="space-y-2">
                {agent.logs.map((l, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 rounded bg-muted/10 text-xs">
                    <span className="text-muted-foreground font-mono shrink-0">{l.t}</span>
                    <span className="text-muted-foreground [&_strong]:text-primary [&_strong]:font-medium" dangerouslySetInnerHTML={{__html: l.msg}} />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* COMMANDS */}
        <TabsContent value="commands" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Command Center</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {agent.cmds.map((c, i) => (
                  <Button
                    key={i}
                    variant={c.primary ? "default" : "outline"}
                    className={`justify-start font-mono text-xs ${c.primary ? "col-span-2" : ""} ${loading === c.label ? "animate-pulse" : ""}`}
                    disabled={!!loading}
                    onClick={() => runCommand(c.label)}
                  >
                    <span className="mr-2">{c.icon}</span>
                    {loading === c.label ? "Running…" : c.label}
                  </Button>
                ))}
              </div>
              <div className="mt-4 p-3 rounded-md bg-muted/10 border">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">API Endpoint</p>
                <p className="font-mono text-xs text-primary">POST {API_BASE}/orchestrator/event</p>
                <p className="font-mono text-[10px] text-muted-foreground mt-0.5">{`{ "agent_id": "${agent.id}", "command": "..." }`}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* OUTPUT */}
        <TabsContent value="output">
          {error && (
            <Card className="border-destructive/30 bg-destructive/5">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-destructive uppercase tracking-wider mb-1">⚠ API Error</p>
                <p className="font-mono text-xs text-destructive">{error}</p>
              </CardContent>
            </Card>
          )}
          {result && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">✓ Agent Response</p>
                <pre className="font-mono text-[10px] text-muted-foreground bg-card p-3 rounded border max-h-[300px] overflow-auto whitespace-pre-wrap">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
          {!result && !error && (
            <p className="text-muted-foreground text-xs font-mono py-8 text-center">Run a command to see the agent output here.</p>
          )}
        </TabsContent>

        {/* LOGS */}
        <TabsContent value="logs">
          <Card>
            <CardHeader className="pb-2">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Activity Log</p>
            </CardHeader>
            <CardContent className="space-y-2">
              {[...agent.logs, ...agent.logs].map((l, i) => (
                <div key={i} className="flex items-start gap-2 p-2 rounded bg-muted/10 text-xs">
                  <span className="text-muted-foreground font-mono shrink-0">{l.t}</span>
                  <span className="text-muted-foreground [&_strong]:text-primary [&_strong]:font-medium" dangerouslySetInnerHTML={{__html: l.msg}} />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* CEO APPROVALS */}
        {agent.id === "ceo" && (
          <TabsContent value="approvals">
            <Card>
              <CardHeader className="pb-2">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Pending CEO Approvals — {pendingApprovals.length} items</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {pendingApprovals.length === 0 && <p className="text-muted-foreground text-xs font-mono">No pending approvals.</p>}
                {pendingApprovals.map((a: any) => (
                  <div key={a.id} className="flex items-center gap-3 p-3 rounded-md border border-warning/40 bg-warning-muted">
                    <span className="text-xl">🔐</span>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-warning">{a.type?.replace(/_/g, " ").toUpperCase()}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{a.description}</p>
                      <p className="text-[10px] text-muted-foreground font-mono mt-1">Agent: {a.agent} · Ref: {a.reference}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="text-success border-success/40 hover:bg-success/10 text-[10px] h-7" onClick={() => decideApproval(a.id, "approve")}>
                        <CheckCircle className="h-3 w-3 mr-1" />Approve
                      </Button>
                      <Button size="sm" variant="outline" className="text-destructive border-destructive/40 hover:bg-destructive/10 text-[10px] h-7" onClick={() => decideApproval(a.id, "reject")}>
                        <XCircle className="h-3 w-3 mr-1" />Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
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
    <AppLayout>
      {activeAgent ? (
        <AgentPage agent={activeAgent} onBack={() => setActiveId(null)} />
      ) : (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />AI Agent Ecosystem
              </h1>
              <p className="text-xs text-muted-foreground font-mono mt-1">Orchestrator — 13 Agents · {API_BASE}</p>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline" className="text-[10px] font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-success mr-1.5 animate-pulse" />9 Active
              </Badge>
              <Badge variant="outline" className="text-[10px] font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-primary mr-1.5 animate-pulse" />NetHunt Live
              </Badge>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-4 gap-3">
            {GLOBAL_KPI.map(k => (
              <Card key={k.label} className="relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary to-transparent" />
                <CardContent className="p-4">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{k.label}</p>
                  <p className="text-2xl font-semibold text-primary mt-1">
                    {k.label === "MTD Revenue" && liveKpi ? `€${(liveKpi.revenue_mtd_eur / 1000).toFixed(1)}k` : k.value}
                  </p>
                  <p className="text-xs text-success font-mono mt-0.5">{k.delta}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Agent navigation by group */}
          {NAV_GROUPS.map(g => (
            <div key={g.label}>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">{g.label}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {g.agents.map(id => {
                  const agent = AGENTS.find(x => x.id === id)!;
                  return (
                    <Card key={id} className="cursor-pointer hover:border-primary/40 transition-colors" onClick={() => setActiveId(id)}>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg" style={{ background: agent.color + "15", border: `1px solid ${agent.color}30` }}>
                            {agent.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-semibold text-foreground truncate">{agent.label}</h3>
                            <p className="text-[10px] text-muted-foreground font-mono truncate">{agent.mission.slice(0, 50)}…</p>
                          </div>
                          <Badge variant={agent.status === "active" ? "default" : "secondary"} className="text-[9px] uppercase shrink-0">
                            {agent.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 mb-2">
                          {agent.metrics.slice(0, 2).map(m => (
                            <div key={m.k}>
                              <p className="text-sm font-semibold text-primary font-mono">{m.v}</p>
                              <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{m.k}</p>
                            </div>
                          ))}
                          <div className="flex-1">
                            {agent.progress.slice(0, 1).map(p => (
                              <div key={p.label}>
                                <div className="flex justify-between text-[9px] text-muted-foreground mb-0.5">
                                  <span>{p.label}</span><span>{p.pct}%</span>
                                </div>
                                <Progress value={p.pct} className="h-1" />
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t">
                          <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[70%]"
                            dangerouslySetInnerHTML={{__html: agent.logs[0].msg.replace(/<[^>]*>/g, '').slice(0, 45) + "…"}} />
                          <span className="text-[10px] text-primary font-mono shrink-0">Open →</span>
                        </div>
                        {agent.approval && (
                          <div className="mt-2">
                            <Badge variant="outline" className="text-[9px] text-warning border-warning/30 bg-warning-muted">🔐 CEO Approval Required</Badge>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
