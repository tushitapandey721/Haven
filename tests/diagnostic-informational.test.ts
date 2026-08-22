import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { conversationManager } from "../artifacts/api-server/src/lib/conversation/conversationManager";
import { requestTracer } from "../artifacts/api-server/src/lib/conversation/tracer";
import type { Request } from "express";

const createMockReq = (requestId: string): Request => {
  return {
    headers: {
      "x-request-id": requestId,
    },
    log: {
      info: () => {},
      warn: () => {},
      error: () => {},
    },
  } as unknown as Request;
};

const GENERIC_THERAPY_STRINGS = [
  /i'm listening\. how can i help you think through this/i,
  /got it\. what do you feel is the next step/i,
  /where would you like to take this thought from here/i,
  /what's been on your mind/i,
  /tell me more/i,
];

describe("HAVEN 11-Case Diagnostic & Informational Flow Test Suite", () => {
  const diagnosticCases = [
    { input: "tell me things i can do", expectedKeywords: /things|walk|skill|project|explore/i },
    { input: "what can I do this weekend?", expectedKeywords: /weekend|plan|market|bookstore|recipe/i },
    { input: "give me ideas for a solo trip", expectedKeywords: /trip|weekend|retreat|train|cities/i },
    { input: "I want to learn photography", expectedKeywords: /photography|exposure|thirds|lighting|camera/i },
    { input: "what are some fun things to do with friends?", expectedKeywords: /friends|potluck|escape room|hike|trivia/i },
    { input: "recommend something interesting to learn", expectedKeywords: /hobbies|printmaking|writing|astronomy|curiosity/i },
    { input: "I'm bored, give me five things I could try", expectedKeywords: /try|playlist|skill|documentary|tempting/i },
    { input: "help me plan a day out", expectedKeywords: /morning|afternoon|evening|coffee|market/i },
    { input: "what should I do tonight?", expectedKeywords: /evening|recipe|performance|film|plan/i },
    { input: "give me some creative hobbies", expectedKeywords: /hobbies|printmaking|watercolor|podcasting|curiosity/i },
    { input: "what can I do if I don't want to spend money?", expectedKeywords: /zero-cost|library|stargazing|yoga|pantry/i },
  ];

  for (let i = 0; i < diagnosticCases.length; i++) {
    const { input, expectedKeywords } = diagnosticCases[i]!;

    it(`Case ${i + 1}: "${input}" should return rich contextual suggestions without generic therapy deflections`, async () => {
      const requestId = `diag-req-${i + 1}`;
      const req = createMockReq(requestId);
      const convId = `diag-conv-${i + 1}`;

      const result = await conversationManager.handleTurn(req, convId, [], input);

      // Verify non-empty
      assert.ok(result.content && result.content.length > 30, `Response too short for: ${input}`);

      // Verify none of the generic therapy deflections are present
      for (const pattern of GENERIC_THERAPY_STRINGS) {
        assert.doesNotMatch(
          result.content,
          pattern,
          `Response for "${input}" contained generic therapy cliché: ${result.content}`,
        );
      }

      // Verify content relevance
      assert.match(
        result.content,
        expectedKeywords,
        `Response for "${input}" lacked relevant keywords. Got: ${result.content}`,
      );

      // Verify trace was recorded
      const trace = requestTracer.getTrace(requestId);
      assert.ok(trace, `Trace missing for request: ${requestId}`);
      assert.strictEqual(trace.result?.success, true);
      assert.ok(trace.pipeline.length >= 5, `Trace pipeline incomplete for: ${requestId}`);
    });
  }
});
