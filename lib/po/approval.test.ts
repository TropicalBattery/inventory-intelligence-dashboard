import { describe, expect, it } from "vitest";
import { canTransition, transitionAction } from "@/lib/po/approval";

describe("PO approval transitions", () => {
  it("allows the documented status chain", () => {
    expect(canTransition("draft", "pending_approval")).toBe(true);
    expect(canTransition("draft", "suppressed")).toBe(true);
    expect(canTransition("pending_approval", "approved")).toBe(true);
    expect(canTransition("pending_approval", "draft")).toBe(true);
    expect(canTransition("approved", "sent")).toBe(true);
    expect(canTransition("suppressed", "draft")).toBe(true);
  });

  it("blocks illegal transitions including from sent", () => {
    expect(canTransition("sent", "draft")).toBe(false);
    expect(canTransition("draft", "approved")).toBe(false);
    expect(canTransition("approved", "suppressed")).toBe(false);
    expect(canTransition("draft", "sent")).toBe(false);
  });

  it("maps transitions to audit actions", () => {
    expect(transitionAction("draft", "pending_approval")).toBe(
      "submitted_for_approval"
    );
    expect(transitionAction("pending_approval", "draft")).toBe(
      "reverted_to_draft"
    );
    expect(transitionAction("approved", "sent")).toBe("sent");
    expect(transitionAction("draft", "suppressed")).toBe("suppressed");
  });
});
