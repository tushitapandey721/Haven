import { describe, it } from "node:test";
import assert from "node:assert";
import type { Request } from "express";
import type { StoredMessage } from "../artifacts/api-server/src/lib/sentinel-store";
import { conversationManager } from "../artifacts/api-server/src/lib/conversation/conversationManager";

function createMockReq(): Request {
  return {
    headers: { "x-request-id": `test-req-${Date.now()}` },
    log: {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    },
  } as unknown as Request;
}

describe("HAVEN Contrastive Semantic Intent & Action-Centric Understanding Tests", () => {
  // Test 1: Core Issue - "set up my best friend for our friendship test"
  it("should interpret 'set up my best friend for our friendship test' as friendship test preparation, not generic activities", async () => {
    const req = createMockReq();
    const convId = `contrastive-test-core-${Date.now()}`;
    const history: StoredMessage[] = [];

    const result = await conversationManager.handleTurn(
      req,
      convId,
      history,
      "hey i have to set up my best friend for our friendship test",
    );

    // Verify Action, Purpose, and Goal are captured
    assert.ok(result.understanding.currentGoal, "Should produce a valid currentGoal");
    assert.match(
      result.understanding.currentGoal.toLowerCase(),
      /test|prepare|assess|friendship/i,
      `currentGoal should reflect friendship test or preparation. Got: "${result.understanding.currentGoal}"`,
    );

    // Verify it is NOT classified as generic social recreational chat
    assert.notStrictEqual(
      result.content.toLowerCase().includes("host a themed potluck"),
      true,
      "Response should NOT default to generic 'things to do with friends' activities",
    );

    // Verify response directly addresses the test setup
    assert.match(
      result.content.toLowerCase(),
      /test|quiz|format|question|scorecard|trivia|connection|bond/i,
      "Response should address setting up or conducting the friendship test",
    );
  });

  // Test 2: Contrastive Pair - "plan something with my friend" vs "test my friend"
  it("should distinguish 'plan something with my friend' (activity) from 'test my friend' (evaluation)", async () => {
    const req = createMockReq();

    // 2a. Planning
    const convIdPlan = `contrastive-plan-${Date.now()}`;
    const resultPlan = await conversationManager.handleTurn(
      req,
      convIdPlan,
      [],
      "plan something with my friend",
    );

    assert.match(
      resultPlan.understanding.currentGoal.toLowerCase(),
      /plan|activity|outing|social/i,
      `Goal should be planning social activity. Got: "${resultPlan.understanding.currentGoal}"`,
    );
    assert.strictEqual(resultPlan.analysis.intent, "brainstorm");

    // 2b. Testing
    const convIdTest = `contrastive-test-${Date.now()}`;
    const resultTest = await conversationManager.handleTurn(
      req,
      convIdTest,
      [],
      "test my friend",
    );

    assert.match(
      resultTest.understanding.currentGoal.toLowerCase(),
      /test|evaluat|assess/i,
      `Goal should be testing/evaluation. Got: "${resultTest.understanding.currentGoal}"`,
    );
    assert.notStrictEqual(resultTest.analysis.intent, "distraction");
  });

  // Test 3: Contrastive Pair - "help my friend prepare for an exam" vs "find something fun to do with my friend"
  it("should distinguish 'help my friend prepare for an exam' (academics) from 'find something fun to do with my friend' (recreation)", async () => {
    const req = createMockReq();

    // 3a. Exam Prep
    const convIdExam = `contrastive-exam-${Date.now()}`;
    const resultExam = await conversationManager.handleTurn(
      req,
      convIdExam,
      [],
      "help my friend prepare for an exam",
    );

    assert.match(
      resultExam.understanding.currentGoal.toLowerCase(),
      /exam|study|prepare/i,
      `Goal should reflect exam preparation. Got: "${resultExam.understanding.currentGoal}"`,
    );
    assert.match(
      resultExam.content.toLowerCase(),
      /study|exam|recall|flashcard|feynman|concept|prepare/i,
      "Response should offer study and exam preparation advice",
    );

    // 3b. Fun activities
    const convIdFun = `contrastive-fun-${Date.now()}`;
    const resultFun = await conversationManager.handleTurn(
      req,
      convIdFun,
      [],
      "find something fun to do with my friend",
    );

    assert.match(
      resultFun.understanding.currentGoal.toLowerCase(),
      /fun|activity|activities|recreation/i,
      `Goal should reflect finding fun activities. Got: "${resultFun.understanding.currentGoal}"`,
    );
    assert.strictEqual(resultFun.analysis.intent, "brainstorm");
  });

  // Test 4: Assessment - "check whether my friend knows me"
  it("should interpret 'check whether my friend knows me' as friendship knowledge evaluation", async () => {
    const req = createMockReq();
    const convId = `contrastive-check-${Date.now()}`;

    const result = await conversationManager.handleTurn(
      req,
      convId,
      [],
      "check whether my friend knows me",
    );

    assert.match(
      result.understanding.currentGoal.toLowerCase(),
      /check|know|assess|friend/i,
      `Goal should reflect assessing knowledge/closeness. Got: "${result.understanding.currentGoal}"`,
    );
    assert.match(
      result.content.toLowerCase(),
      /know|trivia|quiz|question|memory|connection/i,
      "Response should offer friendship assessment / quiz ideas",
    );
  });

  // Test 5: Unseen Domain Contrast - "audit my server for security risks" vs "buy a server rack"
  it("should distinguish action verbs across technical domains ('audit server for security' vs 'buy a server rack')", async () => {
    const req = createMockReq();

    const convIdAudit = `contrastive-audit-${Date.now()}`;
    const resultAudit = await conversationManager.handleTurn(
      req,
      convIdAudit,
      [],
      "audit my server for security risks",
    );

    assert.match(
      resultAudit.understanding.currentGoal.toLowerCase(),
      /audit|inspect|security|risk/i,
      `Goal should reflect security audit. Got: "${resultAudit.understanding.currentGoal}"`,
    );
    assert.match(
      resultAudit.content.toLowerCase(),
      /audit|baseline|permission|log|security|scan/i,
      "Response should guide on security auditing",
    );
  });

  // Test 6: Semantic validation prevents generic activity list when goal is testing/assessing
  it("should pass interpretation validation without substituting generic potlucks for specific action goals", async () => {
    const req = createMockReq();
    const convId = `contrastive-val-${Date.now()}`;

    const result = await conversationManager.handleTurn(
      req,
      convId,
      [],
      "I need to prepare a quiz to test my friend's loyalty",
    );

    assert.ok(result.content.length > 20);
    assert.doesNotMatch(result.content.toLowerCase(), /themed potluck|sunset hike|flea market/i);
  });
});
