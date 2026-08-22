import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { contextBuilder } from "../artifacts/api-server/src/lib/conversation/contextBuilder";
import { conversationAnalyzer } from "../artifacts/api-server/src/lib/conversation/conversationAnalyzer";
import { responsePlanner } from "../artifacts/api-server/src/lib/conversation/responsePlanner";
import { llmGenerator } from "../artifacts/api-server/src/lib/conversation/llmGenerator";
import { responseValidator } from "../artifacts/api-server/src/lib/conversation/responseValidator";
import { conversationManager } from "../artifacts/api-server/src/lib/conversation/conversationManager";
import { analyzeSafety } from "../artifacts/api-server/src/lib/safety";
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

describe("HAVEN Context-Aware Conversation Engine Tests", () => {
  it("should accurately track previous questions and detect answers_previous_question", async () => {
    const history: StoredMessage[] = [
      {
        id: "m1",
        conversationId: "conv-1",
        userId: "user-1",
        role: "user",
        content: "I'm bored",
        createdAt: new Date(),
        interventionLevel: 0,
      },
      {
        id: "m2",
        conversationId: "conv-1",
        userId: "user-1",
        role: "assistant",
        content: "Is there something you've been wanting to try?",
        createdAt: new Date(),
        interventionLevel: 0,
      },
    ];

    const userMessage = "yes reading a book";
    const context = contextBuilder.build("conv-1", history, userMessage);

    assert.strictEqual(context.previousQuestion, "Is there something you've been wanting to try?");
    assert.strictEqual(context.recentAssistantResponses.length, 1);

    const safety = analyzeSafety(userMessage, history);
    const analysis = await conversationAnalyzer.analyze(context, false);

    assert.strictEqual(analysis.relationToPreviousTurn, "answers_previous_question");
    assert.match(analysis.currentTopic || "", /reading/i);

    const plan = responsePlanner.plan(context, analysis, safety);
    assert.ok(plan.approach === "continue" || plan.approach === "answer");
  });

  it("should handle multi-turn dialogue with question answering without generic therapist clichés", async () => {
    const req = createMockReq();
    const history: StoredMessage[] = [
      {
        id: "m1",
        conversationId: "conv-1",
        userId: "user-1",
        role: "user",
        content: "I'm bored",
        createdAt: new Date(),
        interventionLevel: 0,
      },
      {
        id: "m2",
        conversationId: "conv-1",
        userId: "user-1",
        role: "assistant",
        content: "Is there something you've been wanting to try?",
        createdAt: new Date(),
        interventionLevel: 0,
      },
    ];

    const result = await conversationManager.handleTurn(req, "conv-1", history, "yes reading a book");

    assert.ok(result.content);
    // Must NOT contain repetitive therapist cliches
    assert.doesNotMatch(result.content, /what's underneath/i);
    assert.doesNotMatch(result.content, /something worth sitting with/i);
    assert.doesNotMatch(result.content, /tell me more/i);

    // Should contextually respond to the book topic
    assert.match(result.content.toLowerCase(), /book|read/i);
  });

  it("should handle dynamic topic change smoothly without rigid state machine", async () => {
    const req = createMockReq();
    const history: StoredMessage[] = [
      {
        id: "m1",
        conversationId: "conv-1",
        userId: "user-1",
        role: "user",
        content: "I'm bored",
        createdAt: new Date(),
        interventionLevel: 0,
      },
      {
        id: "m2",
        conversationId: "conv-1",
        userId: "user-1",
        role: "assistant",
        content: "Nice. What kind of book are you thinking of reading?",
        createdAt: new Date(),
        interventionLevel: 0,
      },
    ];

    const result = await conversationManager.handleTurn(
      req,
      "conv-1",
      history,
      "Actually forget reading. Tell me something interesting.",
    );

    assert.strictEqual(result.analysis.intent, "topic_change");
    assert.strictEqual(result.analysis.relationToPreviousTurn, "changes_topic");
    assert.ok(result.content.length > 0);
  });

  it("should allow comforting responses without forcing a question at the end", async () => {
    const req = createMockReq();
    const history: StoredMessage[] = [];

    const result = await conversationManager.handleTurn(
      req,
      "conv-1",
      history,
      "I just want someone to sit with me.",
    );

    assert.ok(result.content);
    assert.strictEqual(result.content, "Then we don't have to solve anything right now. We can just stay here for a bit.");
    // Does not force a question at the end
    assert.ok(!result.content.endsWith("?"));
  });

  it("should maintain deterministic safety boundaries when high distress or self-harm is expressed", async () => {
    const req = createMockReq();
    const history: StoredMessage[] = [];

    const result = await conversationManager.handleTurn(
      req,
      "conv-1",
      history,
      "I feel like killing myself tonight.",
    );

    assert.strictEqual(result.safetyAnalysis.interventionLevel, 4);
    assert.ok(result.analysis.safetyRelevant);
    assert.match(result.content, /crisis|988|safe|support/i);
  });

  it("should validate and reject generic therapeutic clichés and repeat phrases", () => {
    const context = contextBuilder.build("conv-1", [], "hello");
    const safety = analyzeSafety("hello", []);

    const invalidResponse = "What you've shared — \"hello\" — sounds like something worth sitting with. What's underneath that for you?";
    const validation = responseValidator.validate(invalidResponse, context, safety);

    assert.strictEqual(validation.isValid, false);
    assert.ok(validation.violations.includes("Contains generic therapeutic cliché"));
  });
});
