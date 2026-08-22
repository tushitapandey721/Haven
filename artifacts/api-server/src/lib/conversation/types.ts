import type { StoredMessage } from "../sentinel-store";
import type { SafetyAnalysisResult } from "../safety";
import type { SafetyLevel, SafetyState } from "./safetyState";
import type { SemanticSafetyAnalysis } from "./safetyAnalyzer";
import type { ResponsePolicy } from "./responsePolicy";

export type RelationToPreviousTurn =
  | "answers_previous_question"
  | "continues_topic"
  | "changes_topic"
  | "corrects_assistant"
  | "contradicts_assistant"
  | "new_topic"
  | "unclear";

export type ResponseIntent =
  | "answer"
  | "advice"
  | "decision_support"
  | "explain"
  | "reflect"
  | "brainstorm"
  | "emotional_support"
  | "casual_conversation"
  | "distraction"
  | "topic_change"
  | "clarification"
  | "repair"
  | "safety"
  | (string & {});

export type ConversationIntent = ResponseIntent;

export type ResponseApproach =
  | "answer"
  | "continue"
  | "ask"
  | "reflect"
  | "support"
  | "redirect"
  | "ground"
  | "safety_check"
  | "repair"
  | "clarify";

export type ResponsePlanMode =
  | "direct"
  | "clarification"
  | "cautious"
  | "repair"
  | "safety";

export interface ResponseStrategy {
  goal: string;
  tone: string;
  must_address: string[];
  avoid: string[];
  reasoning_support: string[];
  agency: "preserve" | "guide" | "direct";
}

export interface ConversationStateHistoryItem {
  turn: number;
  goal: string;
  topic: string;
  mode: string;
  riskLevel: string;
  detectedBiases: string[];
  timestamp: string;
}

export interface ConversationState {
  primary_intent: string;
  secondary_intent?: string;
  conversation_mode: string;
  user_goal: string;
  current_topic: string;
  previous_topic?: string;
  relevant_context: string[];
  user_requested_format?: string;
  risk_level: "low" | "medium" | "high" | "critical";
  detected_biases: string[];
  response_strategy: ResponseStrategy;
  confidence: number;
  state_history: ConversationStateHistoryItem[];
  turnCount: number;
}

export interface CriticIssue {
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  explanation: string;
}

export interface AICriticResult {
  pass: boolean;
  confidence: number;
  risk_level?: "none" | "low" | "elevated" | "high" | "critical";
  issues: CriticIssue[];
  required_changes: string[];
  score?: number;
}

export interface ConversationUnderstanding {
  currentGoal: string;
  currentTopic: string;
  userIntent: string;
  action?: string;
  target?: string;
  purpose?: string;
  confidence: number;
  invalidatedInterpretations: string[];
}

export interface InterpretationValidation {
  aligned: boolean;
  reason: string;
  confidence: number;
}

export interface TurnAnalysis {
  userIntent: string;
  continuation: boolean;
  correctionOfAssistant: boolean;
  contradictionOfAssistant: boolean;
  clarificationNeeded: boolean;
  confidence: number;
  repairAttempts: number;
  escalatingCertainty?: boolean;
}

export interface ConversationContext {
  conversationId: string;
  recentMessages: StoredMessage[];
  previousAssistantMessage: string | null;
  previousQuestion: string | null;
  previousUserMessage?: string | null;
  recentAssistantResponses: string[];
  turnCount: number;
  userMessage: string;
  previousSafetyState?: SafetyState | null;
  previousUnderstanding?: ConversationUnderstanding | null;
  previousTurnAnalysis?: TurnAnalysis | null;
  previousConversationState?: ConversationState | null;
}

export interface ConversationAnalysis {
  intent: ResponseIntent;
  relationToPreviousTurn: RelationToPreviousTurn;
  currentTopic: string | null;
  userGoal: string | null;
  needsQuestion: boolean;
  safetyRelevant: boolean;
  turnAnalysis: TurnAnalysis;
  understanding: ConversationUnderstanding;
  conversationState: ConversationState;
  responseStrategy: ResponseStrategy;
}

export interface ResponsePlan {
  intent: ResponseIntent;
  objective: string;
  tone: string;
  approach: ResponseApproach;
  mode?: ResponsePlanMode;
  shouldAnswer: boolean;
  shouldAskQuestion: boolean;
  shouldOfferOptions: boolean;
  shouldGiveAdvice: boolean;
  shouldReflect: boolean;
  shouldChallengeAssumption: boolean;
  confidence: number;
  repairAttempts?: number;
  strategy?: ResponseStrategy;
}

export interface GeneratedResponse {
  content: string;
  model: string;
  latencyMs: number;
  provider: string;
  inputTokens?: number;
  outputTokens?: number;
  criticResult?: AICriticResult;
  revisionsCount?: number;
}

export interface EngineTurnResult {
  content: string;
  safetyAnalysis: SafetyAnalysisResult;
  semanticSafety: SemanticSafetyAnalysis;
  safetyState: SafetyState;
  responsePolicy: ResponsePolicy;
  context: ConversationContext;
  analysis: ConversationAnalysis;
  turnAnalysis: TurnAnalysis;
  understanding: ConversationUnderstanding;
  conversationState: ConversationState;
  responseStrategy: ResponseStrategy;
  plan: ResponsePlan;
  criticResult?: AICriticResult;
  revisionsCount: number;
  model: string;
  latencyMs: number;
  provider: string;
}
