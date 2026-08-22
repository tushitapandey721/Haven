import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { conversationManager } from "../artifacts/api-server/src/lib/conversation/conversationManager";
import type { StoredMessage } from "../artifacts/api-server/src/lib/sentinel-store";
import type { Request } from "express";

const createMockReq = (): Request => {
  return {
    log: {
      info: () => {},
      warn: () => {},
      error: () => {},
    },
  } as unknown as Request;
};

describe("HAVEN Generalized Conversational Evaluation Suite (Unseen Domains)", () => {
  it("Scenario 1 [Career / Startup]: should provide balanced decision support and actionable advice on leaving a startup", async () => {
    const req = createMockReq();
    const convId = "eval-startup-1";

    let history: StoredMessage[] = [];

    // Turn 1: User shares startup dilemma
    const t1 = await conversationManager.handleTurn(
      req,
      convId,
      history,
      "I've been thinking about leaving my startup.",
    );
    assert.strictEqual(t1.plan.intent, "decision_support");
    assert.match(t1.content, /startup|mission|well-being|stay/i);

    history.push(
      { id: "1", conversationId: convId, userId: "u", role: "user", content: "I've been thinking about leaving my startup.", createdAt: new Date() },
      { id: "2", conversationId: convId, userId: "u", role: "assistant", content: t1.content, createdAt: new Date() },
    );

    // Turn 2: User explicitly asks for advice
    const t2 = await conversationManager.handleTurn(
      req,
      convId,
      history,
      "What do you suggest?",
    );
    assert.strictEqual(t2.plan.intent, "advice");
    assert.strictEqual(t2.plan.shouldGiveAdvice, true);
    // Must NOT deflect with "What do you feel is the next step?"
    assert.doesNotMatch(t2.content, /what do you feel is the next step/i);
    assert.match(t2.content, /runway|co-founders|burnout|milestone|decision/i);
  });

  it("Scenario 2 [Friendship Conflict]: should explore perspective and repair options for long-term friendship silence", async () => {
    const req = createMockReq();
    const convId = "eval-friendship-1";

    let history: StoredMessage[] = [];

    // Turn 1:
    const t1 = await conversationManager.handleTurn(
      req,
      convId,
      history,
      "My best friend and I haven't spoken in months.",
    );
    assert.ok(t1.plan.intent === "decision_support" || t1.plan.intent === "emotional_support");
    assert.match(t1.content, /friend|silence|connection|reach/i);

    history.push(
      { id: "1", conversationId: convId, userId: "u", role: "user", content: "My best friend and I haven't spoken in months.", createdAt: new Date() },
      { id: "2", conversationId: convId, userId: "u", role: "assistant", content: t1.content, createdAt: new Date() },
    );

    // Turn 2:
    const t2 = await conversationManager.handleTurn(
      req,
      convId,
      history,
      "How would you approach reaching out to them?",
    );
    assert.ok(t2.plan.intent === "advice" || t2.plan.intent === "answer");
    assert.match(t2.content, /message|repair|note|low-pressure|catch up/i);
  });

  it("Scenario 3 [Relocation / City]: should reason through moving to another city without forcing an arbitrary decision", async () => {
    const req = createMockReq();
    const convId = "eval-relocate-1";

    const t = await conversationManager.handleTurn(
      req,
      convId,
      [],
      "I don't know whether I should move to another city.",
    );

    assert.strictEqual(t.plan.intent, "decision_support");
    assert.match(t.content, /city|move|practical|cost|options/i);
  });

  it("Scenario 4 [Celebration / Milestone]: should celebrate dream university acceptance authentically without therapy clichés", async () => {
    const req = createMockReq();
    const convId = "eval-university-1";

    const t = await conversationManager.handleTurn(
      req,
      convId,
      [],
      "I just got accepted into my dream university!",
    );

    assert.match(t.content, /congratulations|milestone|hard work|dream university|next chapter/i);
    assert.doesNotMatch(t.content, /what's underneath/i);
    assert.doesNotMatch(t.content, /something worth sitting with/i);
  });

  it("Scenario 5 [Creative Block]: should provide practical techniques for overcoming creative project blocks", async () => {
    const req = createMockReq();
    const convId = "eval-creative-1";

    const t = await conversationManager.handleTurn(
      req,
      convId,
      [],
      "I'm stuck on chapter 4 of my screenplay.",
    );

    assert.match(t.content, /creative|editor|draft|scene|momentum/i);
  });

  it("Scenario 6 [Practical Negotiation]: should give concrete steps for lease renewal negotiation", async () => {
    const req = createMockReq();
    const convId = "eval-lease-1";

    const t = await conversationManager.handleTurn(
      req,
      convId,
      [],
      "How can I negotiate my lease renewal with my landlord?",
    );

    assert.strictEqual(t.plan.intent, "answer");
    assert.match(t.content, /rates|tenant|term|rent|negotiat/i);
  });

  it("Scenario 7 [Venting / No Advice]: should respect explicit request for listening without unsolicited problem-solving", async () => {
    const req = createMockReq();
    const convId = "eval-vent-1";

    const t = await conversationManager.handleTurn(
      req,
      convId,
      [],
      "I don't want advice, just stay here and talk to me. I had the worst day.",
    );

    assert.strictEqual(t.plan.intent, "emotional_support");
    assert.strictEqual(t.plan.shouldGiveAdvice, false);
    assert.match(t.content, /don't need advice|listening|hear you/i);
  });
});
