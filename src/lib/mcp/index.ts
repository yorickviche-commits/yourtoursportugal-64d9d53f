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
  version: "0.1.0",
  instructions:
    "Operations tools for Your Tours Portugal. Use `list_leads` and `get_lead` for the sales pipeline, `list_upcoming_trips` for departures needing attention, and `list_tasks` / `create_task` / `update_task` for operational follow-up. All data is scoped to the signed-in user's access.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listLeadsTool, getLeadTool, listUpcomingTripsTool, listTasksTool, createTaskTool, updateTaskTool],
});
