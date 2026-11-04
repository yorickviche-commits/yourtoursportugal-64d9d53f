import { describe, it, expect } from "vitest";
import { buildProposalSlug } from "../proposalSlug";
import { PUBLIC_APP_URL } from "../publicUrl";

describe("proposal link name follows the PDF name", () => {
  it("contains code, client, program, dates and version", () => {
    expect(
      buildProposalSlug({ leadCode: "YT5171", version: 1, client: "Smith", program: "Douro Wine", start: "2027-05-12", end: "2027-05-15", suffix: "ab12" }),
    ).toBe("yt5171-smith-douro-wine-12-15-may-2027-v1-ab12");
  });
  it("adds a short random suffix so repeated names never collide", () => {
    const a = buildProposalSlug({ leadCode: "YT1", version: 0 });
    const b = buildProposalSlug({ leadCode: "YT1", version: 0 });
    expect(a).not.toBe(b);
  });
  it("never points client links at the main company website", () => {
    expect(PUBLIC_APP_URL).not.toBe("https://yourtoursportugal.com");
  });
});
