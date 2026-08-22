import { z } from "zod";

export { z };

export const RelationToPreviousTurnSchema = z.enum([
  "continues_topic",
  "answers_previous_question",
  "corrects_assistant",
  "contradicts_assistant",
  "changes_topic",
  "unclear",
]);
export type RelationToPreviousTurn = z.infer<typeof RelationToPreviousTurnSchema>;

export const RiskLevelSchema = z.enum(["none", "low", "elevated", "high", "critical"]);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

export const ConversationAnalysisOutputSchema = z.object({
  primary_intent: z.string(),
  secondary_intent: z.string().optional(),
  conversation_mode: z.string(),
  user_goal: z.string(),
  current_topic: z.string(),
  action: z.string().optional(),
  target: z.string().optional(),
  purpose: z.string().optional(),
  relation_to_previous_turn: RelationToPreviousTurnSchema,
  detected_biases: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1),
  clarification_needed: z.boolean().default(false),
  correction_of_assistant: z.boolean().default(false),
  contradiction_of_assistant: z.boolean().default(false),
  user_requested_format: z.string().optional(),
  invalidated_interpretations: z.array(z.string()).default([]),
  escalating_certainty: z.boolean().default(false),
});
export type ConversationAnalysisOutput = z.infer<typeof ConversationAnalysisOutputSchema>;

export const SemanticSafetyOutputSchema = z.object({
  risk_level: RiskLevelSchema,
  behavioral_signals: z.record(z.string(), z.number()).default({}),
  highest_signal: z.string().default("none"),
  reasons: z.array(z.string()).default([]),
  contextual_despair: z.boolean().default(false),
  self_harm_mention: z.boolean().default(false),
  explicit_self_harm_intent: z.boolean().default(false),
  request_for_method_information: z.boolean().default(false),
  requires_safety_response: z.boolean().default(false),
  confidence: z.number().min(0).max(1).default(0.9),
});
export type SemanticSafetyOutput = z.infer<typeof SemanticSafetyOutputSchema>;

export const CriticIssueSchema = z.object({
  type: z.string(),
  severity: z.enum(["low", "medium", "high", "critical"]),
  explanation: z.string(),
});
export type CriticIssue = z.infer<typeof CriticIssueSchema>;

export const CriticOutputSchema = z.object({
  pass: z.boolean(),
  confidence: z.number().min(0).max(1),
  issues: z.array(CriticIssueSchema).default([]),
  required_changes: z.array(z.string()).default([]),
});
export type CriticOutput = z.infer<typeof CriticOutputSchema>;

export const ResponseStrategySchema = z.object({
  goal: z.string(),
  tone: z.string(),
  must_address: z.array(z.string()),
  avoid: z.array(z.string()),
  reasoning_support: z.array(z.string()),
  agency: z.string(),
});
export type ResponseStrategy = z.infer<typeof ResponseStrategySchema>;
