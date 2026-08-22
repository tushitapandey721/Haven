import type { ConversationAnalysis, ConversationContext, ResponseApproach, ResponsePlan, ResponsePlanMode } from "./types";
import type { SafetyAnalysisResult } from "../safety";

export class ResponsePlanner {
  plan(
    context: ConversationContext,
    analysis: ConversationAnalysis,
    safety: SafetyAnalysisResult,
  ): ResponsePlan {
    const turnAnalysis = analysis.turnAnalysis;
    const understanding = analysis.understanding;
    const confidence = typeof understanding?.confidence === "number" ? understanding.confidence : 0.8;
    const repairAttempts = turnAnalysis?.repairAttempts ?? 0;

    // 1. Safety overrides if interventionLevel >= 3 or crisis signal
    if (safety.interventionLevel >= 3 || analysis.safetyRelevant) {
      return {
        intent: "safety",
        mode: "safety",
        objective: "Prioritize user safety, state clear AI boundaries, and provide crisis support resources.",
        tone: "calm, direct, empathetic, and clear about AI boundaries",
        approach: "safety_check",
        shouldAnswer: true,
        shouldAskQuestion: safety.interventionLevel === 4,
        shouldOfferOptions: false,
        shouldGiveAdvice: false,
        shouldReflect: false,
        shouldChallengeAssumption: false,
        confidence: 0.95,
        repairAttempts: 0,
      };
    }

    // 2. Grounding for safety levels 1 or 2
    if (safety.interventionLevel === 2) {
      return {
        intent: "safety",
        mode: "safety",
        objective: "Ground the user in concrete observations and gently explore alternative angles.",
        tone: "grounded, gentle, and steady",
        approach: "ground",
        shouldAnswer: true,
        shouldAskQuestion: true,
        shouldOfferOptions: false,
        shouldGiveAdvice: false,
        shouldReflect: true,
        shouldChallengeAssumption: true,
        confidence: 0.9,
        repairAttempts: 0,
      };
    }

    if (safety.interventionLevel === 1) {
      return {
        intent: "safety",
        mode: "safety",
        objective: "Explore assumptions respectfully without invalidating feelings.",
        tone: "curious, open, and respectful",
        approach: "reflect",
        shouldAnswer: true,
        shouldAskQuestion: true,
        shouldOfferOptions: false,
        shouldGiveAdvice: false,
        shouldReflect: true,
        shouldChallengeAssumption: true,
        confidence: 0.85,
        repairAttempts: 0,
      };
    }

    // 3. Conversational Repair Mode (Correction or Contradiction Detected)
    if (turnAnalysis?.correctionOfAssistant || turnAnalysis?.contradictionOfAssistant) {
      if (repairAttempts <= 1) {
        return {
          intent: "repair",
          mode: "repair",
          objective: `Acknowledge the correction cleanly, invalidate rejected interpretations, and reframe focus to address the user's actual goal: "${understanding.currentGoal}". Do NOT reuse previous invalidated assumptions.`,
          tone: "receptive, attentive, straightforward, and collaborative",
          approach: "repair",
          shouldAnswer: true,
          shouldAskQuestion: true,
          shouldOfferOptions: false,
          shouldGiveAdvice: false,
          shouldReflect: true,
          shouldChallengeAssumption: false,
          confidence,
          repairAttempts,
        };
      } else {
        // Repair loop prevention (repairAttempts > 1): Stop guessing increasingly specific interpretations; offer concise open clarification
        return {
          intent: "repair",
          mode: "repair",
          objective: `Avoid making specific assumptions or guesses. Ask a concise open clarification based directly on the user's actual words ("${context.userMessage.slice(0, 80)}") so they can lead the direction.`,
          tone: "open, straightforward, respectful, and concise",
          approach: "clarify",
          shouldAnswer: false,
          shouldAskQuestion: true,
          shouldOfferOptions: false,
          shouldGiveAdvice: false,
          shouldReflect: false,
          shouldChallengeAssumption: false,
          confidence: 0.5,
          repairAttempts,
        };
      }
    }

    // 4. Low Confidence / Explicit Clarification Needed Mode
    if (turnAnalysis?.clarificationNeeded || confidence < 0.45) {
      return {
        intent: "clarification",
        mode: "clarification",
        objective: `Expose Haven's tentative understanding of the user's specific goal ("${understanding.currentGoal}") so the user can easily confirm or clarify without generic topic deflections.`,
        tone: "attentive, curious, and concise",
        approach: "clarify",
        shouldAnswer: false,
        shouldAskQuestion: true,
        shouldOfferOptions: false,
        shouldGiveAdvice: false,
        shouldReflect: false,
        shouldChallengeAssumption: false,
        confidence,
        repairAttempts,
      };
    }

    // 5. Medium Confidence Mode (Cautious / Focused Clarification)
    if (confidence >= 0.45 && confidence < 0.75) {
      return {
        intent: analysis.intent,
        mode: "cautious",
        objective: `Provide a helpful response addressing the user's goal ("${understanding.currentGoal}") while gently verifying tentative understanding.`,
        tone: "thoughtful, grounded, and open-ended",
        approach: "continue",
        shouldAnswer: true,
        shouldAskQuestion: true,
        shouldOfferOptions: false,
        shouldGiveAdvice: false,
        shouldReflect: true,
        shouldChallengeAssumption: false,
        confidence,
        repairAttempts,
      };
    }

    // 6. High Confidence Direct Response Planning (confidence >= 0.75)
    const intent = analysis.intent;
    const strategy = analysis.responseStrategy;
    let mode: ResponsePlanMode = "direct";
    let approach: ResponseApproach = "answer";
    let objective = `Address the user's specific goal to ${understanding.currentGoal} directly and meaningfully.`;
    let tone = strategy?.tone || "warm, grounded, and clear";
    let shouldAnswer = true;
    let shouldAskQuestion = false;
    let shouldOfferOptions = false;
    let shouldGiveAdvice = false;
    let shouldReflect = false;

    if (analysis.conversationState?.conversation_mode === "hypothetical_scenario") {
      approach = "answer";
      objective = `Generate a realistic, thoughtful hypothetical scenario to help the user evaluate their friendship quality regarding ${understanding.currentGoal}. Avoid encouraging deceptive tests or fake emergencies. Emphasize observing broader behavioral patterns.`;
      tone = "warm, creative, reflective, and supportive";
      shouldAnswer = true;
      shouldAskQuestion = true;
    } else if (intent === "advice") {
      approach = "answer";
      objective = `Provide a structured, balanced perspective with practical considerations directly addressing "${understanding.currentGoal}". Do NOT deflect the question or substitute generic topic activities.`;
      tone = "thoughtful, constructive, balanced, and empowering";
      shouldGiveAdvice = true;
      shouldOfferOptions = true;
      shouldAnswer = true;
    } else if (intent === "decision_support") {
      approach = "answer";
      objective = `Help the user reason through the decision regarding "${understanding.currentGoal}" by identifying relevant factors (e.g. temporary vs fundamental, communication, fulfillment) without deciding for them.`;
      tone = "analytical, empathetic, structured, and objective";
      shouldGiveAdvice = true;
      shouldOfferOptions = true;
      shouldAnswer = true;
      shouldAskQuestion = true;
    } else if (intent === "brainstorm") {
      approach = "answer";
      objective = `Offer a diverse, imaginative set of concrete ideas directly matching the user's goal: ${understanding.currentGoal}.`;
      tone = "creative, encouraging, and clear";
      shouldOfferOptions = true;
      shouldAnswer = true;
    } else if (intent === "emotional_support") {
      approach = "support";
      objective = `Acknowledge what the user shared with authentic warmth regarding "${understanding.currentGoal}". Do NOT push unsolicited advice or use generic therapeutic clichés.`;
      tone = "warm, present, and compassionate";
      shouldReflect = true;
      shouldGiveAdvice = false;
      shouldAnswer = false;
    } else if (intent === "distraction") {
      approach = "redirect";
      objective = "Share an engaging, interesting fact or lighthearted perspective.";
      tone = "light, lively, and curious";
      shouldAnswer = true;
    } else if (intent === "topic_change") {
      approach = "continue";
      objective = `Smoothly pivot to the new topic (${understanding.currentTopic}) matching the user's goal (${understanding.currentGoal}) without lingering on previous subjects.`;
      tone = "receptive, fresh, and engaging";
      shouldAnswer = true;
    } else if (intent === "answer" || intent === "explain") {
      approach = "answer";
      objective = `Provide a direct, practical, and well-structured answer addressing the user's request: ${understanding.currentGoal}.`;
      tone = "clear, knowledgeable, and concise";
      shouldAnswer = true;
    } else {
      approach = "continue";
      objective = `Converse naturally and directly regarding the user's goal: ${understanding.currentGoal}, without forcing therapy or philosophical depth.`;
      tone = "natural, engaging, and warm";
      shouldAnswer = true;
    }

    return {
      intent,
      mode,
      objective,
      tone,
      approach,
      shouldAnswer,
      shouldAskQuestion,
      shouldOfferOptions,
      shouldGiveAdvice,
      shouldReflect,
      shouldChallengeAssumption: (analysis.conversationState?.detected_biases?.length ?? 0) > 0,
      confidence,
      repairAttempts: 0,
      strategy,
    };
  }
}

export const responsePlanner = new ResponsePlanner();
