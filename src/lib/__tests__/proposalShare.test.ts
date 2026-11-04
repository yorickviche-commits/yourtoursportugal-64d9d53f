import { describe, it, expect } from "vitest";
import { getProposalAppUrl } from "../proposalShare";

describe("client proposal links", () => {
  it("never point at the company's main website", () => {
    expect(getProposalAppUrl("abc")).toBe("https://yourtoursportugal.lovable.app/proposal/abc");
  });
});
