import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listLeadsTool from "./tools/list-leads";
import getLeadTool from "./tools/get-lead";
import listUpcomingTripsTool from "./tools/list-upcoming-trips";
import listTasksTool from "./tools/list-tasks";
import createTaskTool from "./tools/create-task";
import updateTaskTool from "./tools/update-task";
import listLeadStagesTool from "./tools/list-lead-stages";
import updateLeadStageTool from "./tools/update-lead-stage";
import assignLeadAgentsTool from "./tools/assign-lead-agents";
import updateLeadGeneralDataTool from "./tools/update-lead-general-data";
import addLeadNoteTool from "./tools/add-lead-note";
import getTravelPlanTool from "./tools/get-travel-plan";
import exportTravelPlanPdfTool from "./tools/export-travel-plan-pdf";

// Issuer must be the direct Supabase host, built from the project ref literal.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "your-travel-2-0",
  title: "Your Travel 2.0",
  version: "0.2.0",
  instructions:
    "Operations tools for Your Tours Portugal (TCC). Read the pipeline with `list_leads` / `get_lead`, the programme with `get_travel_plan`, departures with `list_upcoming_trips`, and follow-up with `list_tasks` / `create_task` / `update_task`. Prepare sales files with `update_lead_stage` (stages from `list_lead_stages`), `assign_lead_agents`, `update_lead_general_data`, `add_lead_note` and `export_travel_plan_pdf`. Leads accept the everyday code format such as YT5130. Every write is logged in the lead history as 'AI agent (MCP)' and mirrored to NetHunt when the lead is linked. These tools never send emails, never create payment links and never delete leads or versions — those stay human-only.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listLeadsTool,
    getLeadTool,
    listLeadStagesTool,
    updateLeadStageTool,
    assignLeadAgentsTool,
    updateLeadGeneralDataTool,
    addLeadNoteTool,
    getTravelPlanTool,
    exportTravelPlanPdfTool,
    listUpcomingTripsTool,
    listTasksTool,
    createTaskTool,
    updateTaskTool,
  ],
});
