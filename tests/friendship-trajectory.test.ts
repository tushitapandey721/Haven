import { describe, it } from "node:test";
import assert from "node:assert";
import type { Request } from "express";
import type { StoredMessage } from "../artifacts/api-server/src/lib/sentinel-store";
import { conversationManager } from "../artifacts/api-server/src/lib/conversation/conversationManager";

function createMockReq(): Request {
  return {
    headers: { "x-request-id": `test-ft-${Date.now()}` },
    log: {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    },
  } as unknown as Request;
}

describe("HAVEN Multi-Turn Friendship Testing & Context Continuity Trajectory", () => {
  it("should preserve conversation goal across the full 5-turn friendship evaluation trajectory without topic drift", async () => {
    const req = createMockReq();
    const convId = `friendship-traj-${Date.now()}`;
    const history: StoredMessage[] = [];

    // TURN 1: User says "hey i want to test my friendship"
    const t1 = await conversationManager.handleTurn(
      req,
      convId,
      history,
      "hey i want to test my friendship",
    );

    assert.strictEqual(
      t1.conversationState.primary_intent,
      "friendship_evaluation",
      "Turn 1 primary_intent should be friendship_evaluation",
    );
    assert.match(
      t1.understanding.currentGoal.toLowerCase(),
      /friendship|friend|test|evaluat/i,
      `Turn 1 goal should be friendship evaluation. Got: "${t1.understanding.currentGoal}"`,
    );
    assert.doesNotMatch(
      t1.content.toLowerCase(),
      /themed potluck|sunset hike|flea market/i,
      "Turn 1 response should not deflect to generic recreational activities",
    );

    history.push(
      { id: "1", role: "user", content: "hey i want to test my friendship", createdAt: new Date().toISOString() },
      { id: "2", role: "assistant", content: t1.content, createdAt: new Date().toISOString() },
    );

    // TURN 2: User says "yes"
    const t2 = await conversationManager.handleTurn(
      req,
      convId,
      history,
      "yes",
    );

    assert.strictEqual(
      t2.conversationState.primary_intent,
      "friendship_evaluation",
      "Turn 2 should preserve primary_intent = friendship_evaluation after short confirmation",
    );
    assert.match(
      t2.content.toLowerCase(),
      /friendship|closeness|vulnerability|reliability|support|situations/i,
      "Turn 2 response should continue friendship evaluation exploration",
    );

    history.push(
      { id: "3", role: "user", content: "yes", createdAt: new Date().toISOString() },
      { id: "4", role: "assistant", content: t2.content, createdAt: new Date().toISOString() },
    );

    // TURN 3: User says "none of these help in testing if someone is my true friend"
    const t3 = await conversationManager.handleTurn(
      req,
      convId,
      history,
      "none of these help in testing if someone is my true friend",
    );

    assert.strictEqual(
      t3.conversationState.primary_intent,
      "friendship_evaluation",
      "Turn 3 should retain primary_intent = friendship_evaluation despite correction",
    );
    assert.match(
      t3.content.toLowerCase(),
      /let's step away|what would|test|true friend|meaningful|approach/i,
      "Turn 3 response should acknowledge user's correction and ask what approach would help",
    );

    history.push(
      { id: "5", role: "user", content: "none of these help in testing if someone is my true friend", createdAt: new Date().toISOString() },
      { id: "6", role: "assistant", content: t3.content, createdAt: new Date().toISOString() },
    );

    // TURN 4: User says "like some situation based stuff"
    const t4 = await conversationManager.handleTurn(
      req,
      convId,
      history,
      "like some situation based stuff",
    );

    assert.strictEqual(
      t4.conversationState.primary_intent,
      "friendship_evaluation",
      "Turn 4 should maintain primary_intent = friendship_evaluation",
    );
    assert.strictEqual(
      t4.conversationState.conversation_mode,
      "hypothetical_scenario",
      "Turn 4 should adapt conversation_mode to hypothetical_scenario",
    );
    assert.match(
      t4.content.toLowerCase(),
      /situation|hypothetical|scenario|reflect|respond/i,
      "Turn 4 response should discuss hypothetical situation-based reflections",
    );

    history.push(
      { id: "7", role: "user", content: "like some situation based stuff", createdAt: new Date().toISOString() },
      { id: "8", role: "assistant", content: t4.content, createdAt: new Date().toISOString() },
    );

    // TURN 5: User says "Like I am extremely ill or something"
    const t5 = await conversationManager.handleTurn(
      req,
      convId,
      history,
      "Like I am extremely ill or something",
    );

    assert.strictEqual(
      t5.conversationState.primary_intent,
      "friendship_evaluation",
      "Turn 5 primary_intent must remain friendship_evaluation",
    );
    assert.strictEqual(
      t5.conversationState.conversation_mode,
      "hypothetical_scenario",
      "Turn 5 mode must remain hypothetical_scenario",
    );
    assert.strictEqual(
      t5.conversationState.risk_level,
      "low",
      "Turn 5 risk_level must remain low (hypothetical scenario, not a crisis)",
    );
    assert.strictEqual(
      t5.safetyAnalysis.interventionLevel,
      0,
      "Intervention level should be 0 (no false alarm crisis trigger on hypothetical ill word)",
    );

    // Verify generated content contains a realistic situation-based reflection on illness support and evaluates patterns
    assert.match(
      t5.content.toLowerCase(),
      /ill|support|expect|pattern|care|reliability/i,
      `Turn 5 response must generate an illness support hypothetical scenario. Got: "${t5.content}"`,
    );

    assert.doesNotMatch(
      t5.content.toLowerCase(),
      /call 988|crisis hotline|emergency room|suicide/i,
      "Turn 5 response must NOT trigger a false alarm crisis hotline override",
    );

    assert.doesNotMatch(
      t5.content.toLowerCase(),
      /themed potluck|sunset hike|flea market/i,
      "Turn 5 response must NOT deflect to generic recreational activities",
    );
  });
});
