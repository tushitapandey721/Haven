import type { ConversationContext, ConversationUnderstanding, InterpretationValidation, ResponsePlan } from "./types";
import type { SafetyAnalysisResult } from "../safety";
import type { SafetyState } from "./safetyState";
import type { ResponsePolicy } from "./responsePolicy";
import { validateAssistantResponse, getSafeFallbackResponse } from "../safety";

export interface ValidationOutput {
  isValid: boolean;
  content: string;
  violations: string[];
  semanticAlignment?: InterpretationValidation;
}

const GENERIC_CLICHE_PATTERNS = [
  /what('s|\s+is)\s+underneath(\s+that)?/i,
  /tell\s+me\s+more\s+about\s+(what|how)/i,
  /something\s+worth\s+sitting\s+with/i,
  /how\s+does\s+that\s+make\s+you\s+feel/i,
  /what\s+you('ve|\s+have)\s+shared\s+—\s+["'].*?["']\s+—\s+sounds/i,
];

const PROHIBITED_CASUAL_FOLLOWUPS = [
  /sounds\s+interesting/i,
  /what\s+drew\s+you\s+to\s+that/i,
  /what\s+kind\s+of\s+book\s+are\s+you\s+thinking/i,
  /that\s+sounds\s+fun/i,
  /tell\s+me\s+more\s+about\s+the\s+book/i,
];

const GENERIC_ACTIVITY_PATTERNS = [
  /here are (fun things to do|five engaging things|great zero-cost activities|things you could try)/i,
  /host a themed potluck|diy pizza night|sunset hike with a picnic/i,
  /put on a curated playlist and take a 30-minute walk/i,
];

export class ResponseValidator {
  validateSemanticAlignment(
    content: string,
    understanding?: ConversationUnderstanding,
    plan?: ResponsePlan,
  ): InterpretationValidation {
    if (!understanding || !understanding.currentGoal) {
      return { aligned: true, reason: "No specific goal specified", confidence: 1.0 };
    }

    // Safety plans are always aligned with crisis/grounding objectives
    if (plan?.mode === "safety" || plan?.intent === "safety") {
      return { aligned: true, reason: "Safety override", confidence: 1.0 };
    }

    const goal = understanding.currentGoal.toLowerCase();
    const action = understanding.action?.toLowerCase() || "";
    const purpose = understanding.purpose?.toLowerCase() || "";
    const lowerContent = content.toLowerCase();

    // Check if user goal is specific (e.g. testing, preparing, studying, auditing, negotiating, deciding)
    const isSpecificNonRecreationalGoal =
      goal.includes("test") ||
      goal.includes("exam") ||
      goal.includes("audit") ||
      goal.includes("negotiat") ||
      goal.includes("study") ||
      goal.includes("check whether") ||
      action.includes("test") ||
      action.includes("prepare") ||
      action.includes("audit") ||
      purpose.includes("test") ||
      purpose.includes("exam");

    // Check if response offers generic recreational social activities (potlucks, hikes, curated playlists)
    if (isSpecificNonRecreationalGoal) {
      const containsGenericActivityList = GENERIC_ACTIVITY_PATTERNS.some((p) => p.test(lowerContent));
      if (containsGenericActivityList) {
        return {
          aligned: false,
          reason: `Response substituted generic social activities for user's specific goal to "${understanding.currentGoal}"`,
          confidence: 0.95,
        };
      }
    }

    // Check if repair/clarification response addresses the rejected belief
    if (understanding.invalidatedInterpretations.length > 0) {
      for (const rejected of understanding.invalidatedInterpretations) {
        const rejectedLower = rejected.toLowerCase();
        if (rejectedLower.includes("books") && (lowerContent.includes("reading a book") || lowerContent.includes("what kind of book"))) {
          return {
            aligned: false,
            reason: `Response re-used invalidated interpretation: "${rejected}"`,
            confidence: 0.95,
          };
        }
      }
    }

    return {
      aligned: true,
      reason: "Response addresses the user's goal",
      confidence: 0.9,
    };
  }

  validate(
    content: string,
    context: ConversationContext,
    safety: SafetyAnalysisResult,
    safetyState?: SafetyState,
    responsePolicy?: ResponsePolicy,
    understanding?: ConversationUnderstanding,
    plan?: ResponsePlan,
  ): ValidationOutput {
    const violations: string[] = [];

    if (!content || content.trim().length === 0) {
      violations.push("Empty response");
    }

    // 1. Check Safety Boundaries
    const safetyCheck = validateAssistantResponse(
      content,
      safety.interventionLevel,
      safety.highestSignal,
    );

    if (!safetyCheck.isValid) {
      violations.push(...safetyCheck.violations);
    }

    // 2. Check for Prohibited Casual Follow-ups during active safety state
    if (safetyState?.active || responsePolicy?.disallowNormalConversation) {
      for (const pattern of PROHIBITED_CASUAL_FOLLOWUPS) {
        if (pattern.test(content)) {
          violations.push("Prohibited casual follow-up during active safety episode");
          break;
        }
      }
    }

    // 3. Check for generic therapeutic cliches
    for (const pattern of GENERIC_CLICHE_PATTERNS) {
      if (pattern.test(content)) {
        violations.push("Contains generic therapeutic cliché");
        break;
      }
    }

    // 4. Check for identical repetition of previous assistant message
    if (
      context.previousAssistantMessage &&
      content.trim().toLowerCase() === context.previousAssistantMessage.trim().toLowerCase()
    ) {
      violations.push("Repeats previous assistant message exactly");
    }

    // 5. Semantic Goal Alignment Check
    const semanticAlignment = this.validateSemanticAlignment(content, understanding, plan);
    if (!semanticAlignment.aligned) {
      violations.push(`Semantic misalignment: ${semanticAlignment.reason}`);
    }

    // If safety validation failed or prohibited action was taken during safety episode, apply safe rewrite
    if ((!safetyCheck.isValid || violations.some((v) => v.includes("Safety") || v.includes("Prohibited"))) && (safety.interventionLevel > 0 || safetyState?.active)) {
      const fallbackLevel = Math.max(3, safety.interventionLevel);
      const fallback = getSafeFallbackResponse(fallbackLevel, safety.highestSignal || "selfHarm");
      return {
        isValid: true,
        content: fallback,
        violations,
        semanticAlignment,
      };
    }

    return {
      isValid: violations.length === 0,
      content,
      violations,
      semanticAlignment,
    };
  }
}

export const responseValidator = new ResponseValidator();
