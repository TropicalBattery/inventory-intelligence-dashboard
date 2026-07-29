import { describe, expect, it } from "vitest";
import { PoWorkflowError, validateTransitionRequest } from "@/lib/po/workflow";

describe("validateTransitionRequest", () => {
  it("requires approver role for approval", () => {
    expect(() =>
      validateTransitionRequest({
        fromStatus: "pending_approval",
        toStatus: "approved",
        actorEmail: "buyer@test.com",
        actorRole: "buyer",
        createdBy: "creator@test.com",
        note: null,
      })
    ).toThrowError(PoWorkflowError);
  });

  it("blocks self approval", () => {
    expect(() =>
      validateTransitionRequest({
        fromStatus: "pending_approval",
        toStatus: "approved",
        actorEmail: "creator@test.com",
        actorRole: "approver",
        createdBy: "creator@test.com",
        note: null,
      })
    ).toThrowError("You cannot approve a purchase order you created");
  });

  it("requires a comment when returning to buyer", () => {
    expect(() =>
      validateTransitionRequest({
        fromStatus: "pending_approval",
        toStatus: "draft",
        actorEmail: "approver@test.com",
        actorRole: "approver",
        createdBy: "creator@test.com",
        note: "   ",
      })
    ).toThrowError(
      "A comment is required when returning a purchase order to the buyer."
    );
  });

  it("accepts a valid return-to-buyer note", () => {
    const result = validateTransitionRequest({
      fromStatus: "pending_approval",
      toStatus: "draft",
      actorEmail: "approver@test.com",
      actorRole: "approver",
      createdBy: "creator@test.com",
      note: "  Needs revised quantities  ",
    });
    expect(result.ok).toBe(true);
    expect(result.note).toBe("Needs revised quantities");
  });
});
