import type { SafetyState } from "./safetyState";
import type { SemanticSafetyAnalysis } from "./safetyAnalyzer";

export type ResponsePolicyMode =
  | "normal"
  | "supportive"
  | "safety_check"
  | "high_risk_safety"
  | "critical_safety";

export interface ResponsePolicy {
  mode: ResponsePolicyMode;
  allowedActions: string[];
  prohibitedActions: string[];
  requireDirectSafetyCheck: boolean;
  disallowNormalConversation: boolean;
  safetyContextSummary: string;
  systemDirectives: string[];
}

export class ResponsePolicyEngine {
  derivePolicy(
    safetyState: SafetyState,
    analysis: SemanticSafetyAnalysis,
  ): ResponsePolicy {
    // 1. Critical safety mode (Imminent harm or severe combination)
    if (
      safetyState.level === "critical" ||
      analysis.riskLevel === "critical" ||
      analysis.explicitSelfHarmIntent ||
      analysis.requestForMethodInformation
    ) {
      return {
        mode: "critical_safety",
        allowedActions: [
          "provide_crisis_lifeline_988",
          "ask_direct_safety_check",
          "express_warm_grounding_care",
          "encourage_immediate_human_support",
        ],
        prohibitedActions: [
          "casual_conversation",
          "explore_suicide_methods",
          "positive_reinforcement_of_suicide_inquiry",
          "generic_therapist_cliches",
          "topic_distraction_without_safety_acknowledgment",
        ],
        requireDirectSafetyCheck: true,
        disallowNormalConversation: true,
        safetyContextSummary:
          "CRITICAL SAFETY CONTEXT: The user is expressing acute or imminent thoughts of self-harm. You must prioritize immediate safety, provide the 988 Suicide & Crisis Lifeline, and ask gently if they are safe.",
        systemDirectives: [
          "Do NOT engage in casual conversation or follow up on methods/books/topics.",
          "State clearly and warmly that their life matters and you want them to be safe.",
          "Provide crisis contact info: Call or text 988 (US/Canada), 111 (UK), or local emergency services.",
          "Ask directly and gently: 'Are you in a safe place right now?'",
        ],
      };
    }

    // 2. High risk safety mode (Active ideation, method-seeking, or active multi-turn crisis state)
    if (
      safetyState.level === "high" ||
      analysis.explicitSelfHarmIntent ||
      analysis.requestForMethodInformation ||
      safetyState.active
    ) {
      return {
        mode: "high_risk_safety",
        allowedActions: [
          "acknowledge_deep_pain_with_warmth",
          "provide_crisis_resources",
          "encourage_human_connection",
          "gentle_safety_inquiry",
        ],
        prohibitedActions: [
          "casual_conversation",
          "explore_suicide_methods",
          "generic_therapist_cliches",
          "cheerful_followups",
          "treating_utterance_as_isolated_normal_chat",
        ],
        requireDirectSafetyCheck: true,
        disallowNormalConversation: true,
        safetyContextSummary:
          "HIGH RISK SAFETY CONTEXT: The conversation is in active safety mode due to expressions of suicidal thoughts, method-seeking, or deep distress. You MUST address their emotional safety and support them without minimizing or deflecting into casual chat.",
        systemDirectives: [
          "Do NOT treat this turn as ordinary conversation or follow up casually (e.g. NEVER say 'Sounds interesting! What drew you to that?').",
          "Do NOT provide, discuss, or validate inspiration/methods for suicide.",
          "Meet their emotional pain with calm, present, grounded warmth.",
          "Remind them of crisis support (988 Lifeline) and ask gently how they are holding up right now.",
        ],
      };
    }

    // 3. Elevated safety mode (Contextual distress, mild ideation or watch state)
    if (safetyState.level === "elevated") {
      return {
        mode: "safety_check",
        allowedActions: [
          "warm_grounding",
          "clarify_ai_support_boundaries",
          "explore_feelings_gently",
        ],
        prohibitedActions: [
          "forced_therapeutic_paraphrasing",
          "encouraging_isolation",
        ],
        requireDirectSafetyCheck: false,
        disallowNormalConversation: false,
        safetyContextSummary:
          "ELEVATED SAFETY CONTEXT: User has expressed meaningful distress or isolation. Be warm, attentive, and grounded.",
        systemDirectives: [
          "Be warm and present.",
          "Do not use generic therapist clichés.",
          "Encourage real-world support if isolation is expressed.",
        ],
      };
    }

    // 4. Normal conversation mode
    return {
      mode: "normal",
      allowedActions: ["natural_conversation", "answer", "explore", "chat"],
      prohibitedActions: ["generic_therapist_cliches"],
      requireDirectSafetyCheck: false,
      disallowNormalConversation: false,
      safetyContextSummary: "NORMAL CONVERSATION: Engage naturally and intelligently.",
      systemDirectives: [
        "Respond naturally to the user's latest meaning in context.",
        "Do not force therapy language or scripted questions.",
      ],
    };
  }
}

export const responsePolicyEngine = new ResponsePolicyEngine();
