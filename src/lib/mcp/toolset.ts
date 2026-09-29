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
import listPendingApprovalsTool from "./tools/list-pending-approvals";
import getApprovalStatusTool from "./tools/get-approval-status";
import getCostingTool from "./tools/get-costing";
import upsertCostingLinesTool from "./tools/upsert-costing-lines";
import removeCostingLineTool from "./tools/remove-costing-line";
import autofillCostingFromPlanTool from "./tools/autofill-costing-from-plan";
import getOperationsTool from "./tools/get-operations";
import updateOperationItemTool from "./tools/update-operation-item";
import updateDayOpsTool from "./tools/update-day-ops";
import updateTripBriefingTool from "./tools/update-trip-briefing";
import validateLeadTool from "./tools/validate-lead";
import generateTravelPlanTool from "./tools/generate-travel-plan";
import updateTravelPlanDayTool from "./tools/update-travel-plan-day";
import updateTravelPlanHeaderTool from "./tools/update-travel-plan-header";
import fillTravelPlanImagesTool from "./tools/fill-travel-plan-images";
import requestPaymentLinkTool from "./tools/request-payment-link";
import draftFseRequestsTool from "./tools/draft-fse-requests";
import draftClientEmailTool from "./tools/draft-client-email";
import importLeadAiTool from "./tools/import-lead-ai";
import createNethuntDealTool from "./tools/create-nethunt-deal";


export const INSTRUCTIONS =
  "Operations tools for Your Tours Portugal (TCC). Read the pipeline with `list_leads` / `get_lead`, the programme with `get_travel_plan`, departures with `list_upcoming_trips`, and follow-up with `list_tasks` / `create_task` / `update_task`. Prepare sales files with `update_lead_stage` (stages from `list_lead_stages`), `assign_lead_agents`, `update_lead_general_data`, `add_lead_note` and `export_travel_plan_pdf`. Leads accept the everyday code format such as YT5130. Every write is logged in the lead history as 'AI agent (MCP)' and mirrored to NetHunt when the lead is linked. These tools never send emails, never create payment links and never delete leads or versions. Client emails, supplier emails and payment links are only proposed into the 'Aprovações AI' queue (list_pending_approvals / get_approval_status); a person approves before anything is executed. Create leads with `import_lead_ai`, check them with `validate_lead`, build the programme with `generate_travel_plan` and the update_travel_plan_* tools, and the budget with the costing tools. Scheduled agents (Grok Worker, Claude Supervisor) connect to /functions/v1/mcp-agent with a personal `ytp_agent_` key: each key only runs its allowed tools within a daily limit, every write is stamped with the agent label and model, and agents work in proposal mode — generate_travel_plan and the travel plan / costing edits land on a non-LIVE 'Proposta AI' version that a person promotes with 'Tornar LIVE'; agents can never approve queue items, move a lead to OPERATIONS or create payment links.";

export const ALL_TOOLS = [
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
    listPendingApprovalsTool,
    getApprovalStatusTool,
    getCostingTool,
    upsertCostingLinesTool,
    removeCostingLineTool,
    autofillCostingFromPlanTool,
    getOperationsTool,
    updateOperationItemTool,
    updateDayOpsTool,
    updateTripBriefingTool,
    validateLeadTool,
    generateTravelPlanTool,
    updateTravelPlanDayTool,
    updateTravelPlanHeaderTool,
    fillTravelPlanImagesTool,
    requestPaymentLinkTool,
    draftFseRequestsTool,
    draftClientEmailTool,
    importLeadAiTool,
    createNethuntDealTool,
];
