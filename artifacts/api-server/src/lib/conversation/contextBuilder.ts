import type { StoredMessage } from "../sentinel-store";
import type {
  ConversationContext,
  ConversationUnderstanding,
  TurnAnalysis,
  ConversationState,
} from "./types";
import type { SafetyState } from "./safetyState";

/**
 * Extracts explicit questions from an assistant message string.
 */
export function extractQuestions(text: string): string[] {
  if (!text) return [];
  const sentences = text.split(/(?<=[.?!])\s+/);
  return sentences.filter((s) => s.trim().endsWith("?")).map((s) => s.trim());
}

/**
 * Scopes and filters message history using semantic relevance & recency.
 */
export function selectRelevantHistory(
  history: StoredMessage[],
  currentMessage: string,
  maxTurns: number = 10,
): StoredMessage[] {
  if (history.length <= maxTurns) {
    return [...history];
  }

  // Always keep the immediate recent turns for immediate conversational flow
  const recentSlice = history.slice(-6);
  const olderMessages = history.slice(0, -6);

  // Score older messages for semantic relevance to current topic keywords
  const keywords = currentMessage
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 3);

  const scoredOlder = olderMessages.map((msg) => {
    let score = 0;
    const contentLower = msg.content.toLowerCase();
    for (const kw of keywords) {
      if (contentLower.includes(kw)) score += 2;
    }
    return { msg, score };
  });

  const relevantOlder = scoredOlder
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxTurns - recentSlice.length)
    .map((item) => item.msg);

  // Merge, sort chronologically, and deduplicate
  const combined = [...relevantOlder, ...recentSlice];
  combined.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const seenIds = new Set<string>();
  return combined.filter((m) => {
    if (seenIds.has(m.id)) return false;
    seenIds.add(m.id);
    return true;
  });
}

export class ContextBuilder {
  build(
    conversationId: string,
    history: StoredMessage[],
    currentUserMessage: string,
    previousSafetyState?: SafetyState | null,
    previousUnderstanding?: ConversationUnderstanding | null,
    previousTurnAnalysis?: TurnAnalysis | null,
    previousConversationState?: ConversationState | null,
  ): ConversationContext {
    const recentMessages = selectRelevantHistory(history, currentUserMessage, 12);

    // Find the latest assistant message prior to this user turn
    const assistantMessages = history.filter((m) => m.role === "assistant");
    const lastAssistantMsg = assistantMessages.length
      ? assistantMessages[assistantMessages.length - 1]!.content
      : null;

    // Find the latest user message prior to this user turn
    const userMessages = history.filter((m) => m.role === "user");
    const lastUserMsg = userMessages.length
      ? userMessages[userMessages.length - 1]!.content
      : null;

    // Extract questions from the last assistant message
    const questions = lastAssistantMsg ? extractQuestions(lastAssistantMsg) : [];
    const previousQuestion = questions.length ? questions.join(" ") : null;

    // Last 3-4 assistant responses for repetition prevention
    const recentAssistantResponses = assistantMessages
      .slice(-4)
      .map((m) => m.content);

    return {
      conversationId,
      recentMessages,
      previousAssistantMessage: lastAssistantMsg,
      previousQuestion,
      previousUserMessage: lastUserMsg,
      recentAssistantResponses,
      turnCount: history.length + 1,
      userMessage: currentUserMessage,
      previousSafetyState: previousSafetyState ?? null,
      previousUnderstanding: previousUnderstanding ?? null,
      previousTurnAnalysis: previousTurnAnalysis ?? null,
      previousConversationState: previousConversationState ?? null,
    };
  }
}

export const contextBuilder = new ContextBuilder();
