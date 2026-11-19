import { describe, expect, it } from "vitest";
import {
  ageDays,
  crmStage,
  crmPvp,
  CRM_LIMITS,
  pipelineStages,
  matchesCrmFilters,
  EMPTY_CRM_FILTERS,
} from "./crmPipeline";
describe("CRM Phase A rules", () => {
  it("has four Sales and seven Operations stages", () => {
    expect(pipelineStages("sales")).toHaveLength(4);
    expect(pipelineStages("operations")).toHaveLength(7);
  });
  it("excludes historical won imports without an active stage", () => {
    expect(
      crmStage({ nethunt_stage: null, status: "won", source: "fareharbor" }),
    ).toBeNull();
  });
  it("keeps won leads with an exact active stage", () => {
    expect(
      crmStage({
        nethunt_stage: "OPERATIONS - Deposit/Payment Received",
        status: "won",
        source: "fareharbor",
      }),
    ).toBe("OPERATIONS - Deposit/Payment Received");
  });
  it("measures stage age from the stage timestamp", () => {
    expect(
      ageDays("2026-11-01T12:00:00Z", Date.parse("2026-11-19T12:00:00Z")),
    ).toBe(18);
  });
  it("warns after 14 stage days and 7 email days", () => {
    expect(CRM_LIMITS.stageWarningDays).toBe(14);
    expect(CRM_LIMITS.emailWarningDays).toBe(7);
  });
  it("starts each column with 30 cards", () => {
    expect(CRM_LIMITS.cardsPerPage).toBe(30);
  });
  it("excludes optional and deleted amounts from potential PVP", () => {
    expect(
      crmPvp(null, [
        { pvpTotal: 100 },
        { status: "opcionais", pvpTotal: 200 },
        { status: "eliminar", pvpTotal: 50 },
      ]),
    ).toBe(100);
  });
  it("uses manual PVP including zero", () => {
    expect(crmPvp(0, [{ pvpTotal: 100 }])).toBe(0);
  });
  it("applies all saved view filters together", () => {
    const lead = {
      id: "1",
      yt_id: "YT5057",
      lead_code: "internal",
      client_name: "Cliente",
      program: "Douro",
      owner_id: "owner",
      sales_owner: null,
      client_type: "B2B",
      source: "direct",
      trip_start: "2026-11-20",
    };
    const f = {
      ...EMPTY_CRM_FILTERS,
      search: "Douro",
      owner: "owner",
      client_type: "B2B",
      source: "direct",
      from: "2026-11-20",
      to: "2026-11-20",
    };
    expect(matchesCrmFilters(lead, f)).toBe(true);
    expect(matchesCrmFilters(lead, { ...f, client_type: "B2C" })).toBe(false);
  });
});
