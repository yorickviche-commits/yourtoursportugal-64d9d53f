import { describe, it, expect } from "vitest";
import { getProposalShareUrl } from "../proposalShare";

describe("client proposal links", () => {
  it("use the yourtoursportugal.com domain", () => {
    expect(getProposalShareUrl("abc")).toBe("https://yourtoursportugal.com/proposal/abc");
  });
});
