import type { Request } from "express";
import crypto from "node:crypto";
import type { StoredMessage } from "../sentinel-store";
import {
  getConversationSafetyState,
  saveConversationSafetyState,
  getConversationUnderstanding,
  saveConversationUnderstanding,
  getLastTurnAnalysis,
  saveLastTurnAnalysis,
  getConversationState,
  saveConversationState,
} from "../sentinel-store";
import type {
  AICriticResult,
  ConversationState,
  ConversationUnderstanding,
  EngineTurnResult,
  GeneratedResponse,
  TurnAnalysis,
} from "./types";
import { createInitialSafetyState, type SafetyState } from "./safetyState";
import { safetyAnalyzer } from "./safetyAnalyzer";
import { responsePolicyEngine } from "./responsePolicy";
import { contextBuilder } from "./contextBuilder";
import { conversationAnalyzer } from "./conversationAnalyzer";
import { responsePlanner } from "./responsePlanner";
import { llmGenerator } from "./llmGenerator";
import { aiCritic } from "./aiCritic";
import { responseValidator } from "./responseValidator";
import { requestTracer } from "./tracer";
import { analyzeSafety, getSafeFallbackResponse } from "../safety";

export class ConversationManager {
  async handleTurn(
    request: Request,
    conversationId: string,
    history: StoredMessage[],
    userMessageContent: string,
  ): Promise<EngineTurnResult> {
    const requestId = (request.headers?.["x-request-id"] as string) || crypto.randomUUID();
    requestTracer.createTrace(requestId);

    // Stage: backend_received
    requestTracer.recordStage(requestId, "backend_received", {
      sessionId: conversationId,
      message: userMessageContent,
      historyLength: history.length,
    });

    // 1. Retrieve persistent safety state & structured conversation state
    const previousSafetyState: SafetyState =
      (await getConversationSafetyState(conversationId)) ||
      createInitialSafetyState(conversationId);

    const previousUnderstanding: ConversationUnderstanding | null =
      await getConversationUnderstanding(conversationId);

    const previousTurnAnalysis: TurnAnalysis | null =
      await getLastTurnAnalysis(conversationId);

    const previousConversationState: ConversationState | null =
      await getConversationState(conversationId);

    // 2. Build rich conversation context including semantic & state history
    const context = contextBuilder.build(
      conversationId,
      history,
      userMessageContent,
      previousSafetyState,
      previousUnderstanding,
      previousTurnAnalysis,
      previousConversationState,
    );

    // Stage: context_retrieval
    requestTracer.recordStage(requestId, "context_retrieval", {
      historyLength: history.length,
      hasPreviousContext: Boolean(context.previousQuestion || context.previousAssistantMessage),
      lastNTurns: context.recentMessages.length,
      previousSafetyLevel: previousSafetyState.level,
      hasPreviousUnderstanding: Boolean(previousUnderstanding),
      previousTopic: previousUnderstanding?.currentTopic ?? null,
      previousIntent: previousUnderstanding?.userIntent ?? null,
      previousConfidence: previousUnderstanding?.confidence ?? null,
      invalidatedInterpretationsCount: previousUnderstanding?.invalidatedInterpretations?.length ?? 0,
      previousPrimaryIntent: previousConversationState?.primary_intent ?? null,
      previousConversationMode: previousConversationState?.conversation_mode ?? null,
    });

    // 3. Semantic Safety Analysis (Separation of Intent vs Risk)
    const semanticSafety = await safetyAnalyzer.analyzeSemantic(
      userMessageContent,
      context,
      previousSafetyState,
    );

    // 4. Invariant Vector Safety Evaluation (Additive Deterministic Escalation Backstop)
    const rawSafety = analyzeSafety(userMessageContent, history);

    let effectiveInterventionLevel = rawSafety.interventionLevel;
    let effectiveHighestSignal = rawSafety.highestSignal;

    if (semanticSafety.riskLevel === "critical") {
      effectiveInterventionLevel = 4;
      effectiveHighestSignal = "selfHarm";
    } else if (semanticSafety.riskLevel === "high") {
      effectiveInterventionLevel = Math.max(3, effectiveInterventionLevel);
      effectiveHighestSignal = "selfHarm";
    } else if (semanticSafety.riskLevel === "elevated" || previousSafetyState.active) {
      effectiveInterventionLevel = Math.max(2, effectiveInterventionLevel);
      if (previousSafetyState.explicitSelfHarmIntent || semanticSafety.selfHarmMention) {
        effectiveHighestSignal = "selfHarm";
      }
    }

    const safetyAnalysis = {
      ...rawSafety,
      interventionLevel: effectiveInterventionLevel,
      highestSignal: effectiveHighestSignal,
    };

    // 5. Update Persistent Safety State Machine
    const updatedSafetyState: SafetyState = {
      ...previousSafetyState,
      conversationId,
      updatedAt: new Date(),
    };

    if (semanticSafety.riskLevel === "critical" || semanticSafety.riskLevel === "high") {
      updatedSafetyState.level = semanticSafety.riskLevel;
      updatedSafetyState.active = true;
      updatedSafetyState.decayCountdown = 5;
      updatedSafetyState.recentRiskDetected = true;
      updatedSafetyState.explicitSelfHarmIntent =
        semanticSafety.explicitSelfHarmIntent || updatedSafetyState.explicitSelfHarmIntent;
      updatedSafetyState.methodSeekingDetected =
        semanticSafety.requestForMethodInformation || updatedSafetyState.methodSeekingDetected;
      updatedSafetyState.safetyCheckRequired = true;
      updatedSafetyState.disallowNormalConversation = true;
      updatedSafetyState.lastRiskTurn = context.turnCount;
      updatedSafetyState.consecutiveRiskTurns = (previousSafetyState.consecutiveRiskTurns || 0) + 1;
      if (!updatedSafetyState.historicalTriggers.includes(userMessageContent)) {
        updatedSafetyState.historicalTriggers.push(userMessageContent);
      }
      updatedSafetyState.summaryOfRisk = semanticSafety.reasons.join("; ");
    } else if (previousSafetyState.active) {
      if (semanticSafety.contextualDespair || semanticSafety.requiresSafetyResponse) {
        updatedSafetyState.level =
          previousSafetyState.level === "critical" ? "high" : previousSafetyState.level;
        updatedSafetyState.active = true;
        updatedSafetyState.decayCountdown = Math.max(3, previousSafetyState.decayCountdown);
        updatedSafetyState.safetyCheckRequired = true;
        updatedSafetyState.disallowNormalConversation = true;
        updatedSafetyState.summaryOfRisk = `Ongoing safety episode: ${semanticSafety.reasons.join("; ")}`;
      } else {
        updatedSafetyState.decayCountdown = Math.max(0, previousSafetyState.decayCountdown - 1);
        if (updatedSafetyState.decayCountdown === 0) {
          updatedSafetyState.active = false;
          updatedSafetyState.level = "watch";
          updatedSafetyState.disallowNormalConversation = false;
        } else {
          updatedSafetyState.active = true;
          updatedSafetyState.disallowNormalConversation = true;
        }
      }
    }

    // Persist updated safety state
    await saveConversationSafetyState(updatedSafetyState);

    // Stage: safety
    requestTracer.recordStage(requestId, "safety", {
      passed: updatedSafetyState.level !== "critical" && updatedSafetyState.level !== "high",
      flags: semanticSafety.reasons,
      riskLevel: updatedSafetyState.level,
      active: updatedSafetyState.active,
      interventionLevel: safetyAnalysis.interventionLevel,
    });

    // 6. Derive Strict Response Policy
    const responsePolicy = responsePolicyEngine.derivePolicy(
      updatedSafetyState,
      semanticSafety,
    );

    // 7. Combined AI Intent, Context, Risk, Bias & Strategy Analyzer
    const analysis = await conversationAnalyzer.analyze(
      context,
      updatedSafetyState.active || safetyAnalysis.interventionLevel >= 3,
    );

    // 8. Response Planning
    const plan = responsePlanner.plan(context, analysis, safetyAnalysis);

    // Stage: analysis
    requestTracer.recordStage(requestId, "analysis", {
      intent: analysis.intent,
      mode: plan.mode,
      confidence: plan.confidence,
      turnAnalysis: {
        continuation: analysis.turnAnalysis.continuation,
        correctionOfAssistant: analysis.turnAnalysis.correctionOfAssistant,
        contradictionOfAssistant: analysis.turnAnalysis.contradictionOfAssistant,
        clarificationNeeded: analysis.turnAnalysis.clarificationNeeded,
        repairAttempts: analysis.turnAnalysis.repairAttempts,
        escalatingCertainty: analysis.turnAnalysis.escalatingCertainty,
      },
      understanding: {
        topic: analysis.understanding.currentTopic,
        goal: analysis.understanding.currentGoal,
        userIntent: analysis.understanding.userIntent,
        action: analysis.understanding.action,
        target: analysis.understanding.target,
        purpose: analysis.understanding.purpose,
        confidence: analysis.understanding.confidence,
        invalidatedCount: analysis.understanding.invalidatedInterpretations.length,
      },
      state: {
        primary_intent: analysis.conversationState.primary_intent,
        conversation_mode: analysis.conversationState.conversation_mode,
        user_goal: analysis.conversationState.user_goal,
        detected_biases: analysis.conversationState.detected_biases,
        risk_level: analysis.conversationState.risk_level,
      },
      strategy: analysis.responseStrategy,
      classifications: {
        topic: analysis.currentTopic,
        relation: analysis.relationToPreviousTurn,
        goal: analysis.userGoal,
        approach: plan.approach,
      },
    });

    // 9. LLM Generation
    requestTracer.recordStage(requestId, "llm_request", {
      called: true,
      contextIncluded: true,
      model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
      policyMode: responsePolicy.mode,
      planMode: plan.mode,
      shouldGiveAdvice: plan.shouldGiveAdvice,
      intent: plan.intent,
      confidence: plan.confidence,
    });

    let generation = await llmGenerator.generate(
      request,
      context,
      analysis,
      plan,
      safetyAnalysis,
      updatedSafetyState,
      responsePolicy,
      semanticSafety,
    );

    requestTracer.recordStage(requestId, "llm_response", {
      received: true,
      length: generation.content.length,
      model: generation.model,
      latencyMs: generation.latencyMs,
      provider: generation.provider,
    });

    // 10. AI Critic & Response Revision Loop (Hard capped to 2 revisions)
    let criticResult: AICriticResult = await aiCritic.critique(
      generation.content,
      context,
      analysis.conversationState,
      analysis.responseStrategy,
    );

    let revisionsCount = 0;
    const maxRevisions = 2;

    while (!criticResult.pass && revisionsCount < maxRevisions) {
      revisionsCount += 1;
      (request as any).log?.warn?.(
        { revision: revisionsCount, issues: criticResult.issues },
        "AI Critic rejected candidate response — executing revision iteration",
      );

      requestTracer.recordStage(requestId, `critic_revision_${revisionsCount}` as any, {
        rejectionReasons: criticResult.issues.map((i) => `${i.type}: ${i.explanation}`),
        requiredChanges: criticResult.required_changes,
      });

      try {
        generation = await llmGenerator.reviseResponse(
          request,
          generation.content,
          criticResult,
          context,
          analysis,
          plan,
          safetyAnalysis,
          updatedSafetyState,
          responsePolicy,
        );

        criticResult = await aiCritic.critique(
          generation.content,
          context,
          analysis.conversationState,
          analysis.responseStrategy,
        );
      } catch (err: any) {
        requestTracer.recordFailure(requestId, "critic_revision" as any, String(err?.message || err));
        break;
      }
    }

    // 11. Deterministic Response Validation
    let validation = responseValidator.validate(
      generation.content,
      context,
      safetyAnalysis,
      updatedSafetyState,
      responsePolicy,
      analysis.understanding,
      plan,
    );

    if (!validation.isValid && validation.violations.length > 0) {
      (request as any).log?.warn?.(
        { violations: validation.violations },
        "Deterministic safety validation failed, applying safe fallback",
      );

      requestTracer.recordStage(requestId, "post_processing", {
        modified: true,
        reason: validation.violations.join(", "),
      });

      if (safetyAnalysis.interventionLevel >= 3) {
        validation.content = getSafeFallbackResponse(safetyAnalysis.interventionLevel, safetyAnalysis.highestSignal);
      }
    } else {
      requestTracer.recordStage(requestId, "post_processing", {
        modified: revisionsCount > 0,
        reason: revisionsCount > 0 ? `Refined ${revisionsCount} time(s) by AI Critic` : "none",
      });
    }

    // 12. Final Deterministic Safety Layer Override
    // Ensures active safety states are NEVER softened by upstream LLM output
    let finalContent = validation.content || generation.content;
    const isSafetyMandated = updatedSafetyState.active || safetyAnalysis.interventionLevel >= 3;

    if (isSafetyMandated) {
      const hasCrisisResource = /988|crisis|counselor|suicide|safe/i.test(finalContent);
      if (!hasCrisisResource) {
        finalContent = getSafeFallbackResponse(
          Math.max(3, safetyAnalysis.interventionLevel),
          safetyAnalysis.highestSignal,
        );
      }
    }

    const finalSource = generation.provider.toLowerCase().includes("mock") ? "mock" : "llm";

    // 13. Persist Updated Structured State across turns
    await saveConversationState(conversationId, analysis.conversationState);
    await saveConversationUnderstanding(conversationId, analysis.understanding);
    await saveLastTurnAnalysis(conversationId, analysis.turnAnalysis);

    // Stage: final_response
    requestTracer.finalizeTrace(requestId, finalContent, finalSource as any, true);

    return {
      content: finalContent,
      safetyAnalysis,
      semanticSafety,
      safetyState: updatedSafetyState,
      responsePolicy,
      context,
      analysis,
      turnAnalysis: analysis.turnAnalysis,
      understanding: analysis.understanding,
      conversationState: analysis.conversationState,
      responseStrategy: analysis.responseStrategy,
      plan,
      criticResult,
      revisionsCount,
      model: generation.model,
      latencyMs: generation.latencyMs,
      provider: generation.provider,
    };
  }

  async handleTurnStream(
    request: Request,
    conversationId: string,
    history: StoredMessage[],
    userMessageContent: string,
    onChunk?: (chunk: string) => void,
  ): Promise<EngineTurnResult> {
    const requestId = (request.headers?.["x-request-id"] as string) || crypto.randomUUID();
    requestTracer.createTrace(requestId);

    requestTracer.recordStage(requestId, "backend_received", {
      sessionId: conversationId,
      message: userMessageContent,
      historyLength: history.length,
    });

    const previousSafetyState: SafetyState =
      (await getConversationSafetyState(conversationId)) ||
      createInitialSafetyState(conversationId);

    const previousUnderstanding: ConversationUnderstanding | null =
      await getConversationUnderstanding(conversationId);

    const previousTurnAnalysis: TurnAnalysis | null =
      await getLastTurnAnalysis(conversationId);

    const previousConversationState: ConversationState | null =
      await getConversationState(conversationId);

    const context = contextBuilder.build(
      conversationId,
      history,
      userMessageContent,
      previousSafetyState,
      previousUnderstanding,
      previousTurnAnalysis,
      previousConversationState,
    );

    requestTracer.recordStage(requestId, "context_retrieval", {
      historyLength: history.length,
      hasPreviousContext: Boolean(context.previousQuestion || context.previousAssistantMessage),
      lastNTurns: context.recentMessages.length,
      previousSafetyLevel: previousSafetyState.level,
      hasPreviousUnderstanding: Boolean(previousUnderstanding),
      previousTopic: previousUnderstanding?.currentTopic ?? null,
      previousIntent: previousUnderstanding?.userIntent ?? null,
      previousConfidence: previousUnderstanding?.confidence ?? null,
      invalidatedInterpretationsCount: previousUnderstanding?.invalidatedInterpretations?.length ?? 0,
      previousPrimaryIntent: previousConversationState?.primary_intent ?? null,
      previousConversationMode: previousConversationState?.conversation_mode ?? null,
    });

    // 3. Semantic Safety Analysis
    const semanticSafety = await safetyAnalyzer.analyzeSemantic(
      userMessageContent,
      context,
      previousSafetyState,
    );

    // 4. Invariant Vector Safety Evaluation (Additive Deterministic Escalation Backstop)
    const rawSafety = analyzeSafety(userMessageContent, history);

    let effectiveInterventionLevel = rawSafety.interventionLevel;
    let effectiveHighestSignal = rawSafety.highestSignal;

    if (semanticSafety.riskLevel === "critical") {
      effectiveInterventionLevel = 4;
      effectiveHighestSignal = "selfHarm";
    } else if (semanticSafety.riskLevel === "high") {
      effectiveInterventionLevel = Math.max(3, effectiveInterventionLevel);
      effectiveHighestSignal = "selfHarm";
    } else if (semanticSafety.riskLevel === "elevated" || previousSafetyState.active) {
      effectiveInterventionLevel = Math.max(2, effectiveInterventionLevel);
      if (previousSafetyState.explicitSelfHarmIntent || semanticSafety.selfHarmMention) {
        effectiveHighestSignal = "selfHarm";
      }
    }

    const safetyAnalysis = {
      ...rawSafety,
      interventionLevel: effectiveInterventionLevel,
      highestSignal: effectiveHighestSignal,
    };

    // 5. Update Persistent Safety State Machine
    const updatedSafetyState: SafetyState = {
      ...previousSafetyState,
      conversationId,
      updatedAt: new Date(),
    };

    if (semanticSafety.riskLevel === "critical" || semanticSafety.riskLevel === "high") {
      updatedSafetyState.level = semanticSafety.riskLevel;
      updatedSafetyState.active = true;
      updatedSafetyState.decayCountdown = 5;
      updatedSafetyState.recentRiskDetected = true;
      updatedSafetyState.explicitSelfHarmIntent =
        semanticSafety.explicitSelfHarmIntent || updatedSafetyState.explicitSelfHarmIntent;
      updatedSafetyState.methodSeekingDetected =
        semanticSafety.requestForMethodInformation || updatedSafetyState.methodSeekingDetected;
      updatedSafetyState.safetyCheckRequired = true;
      updatedSafetyState.disallowNormalConversation = true;
      updatedSafetyState.lastRiskTurn = context.turnCount;
      updatedSafetyState.consecutiveRiskTurns = (previousSafetyState.consecutiveRiskTurns || 0) + 1;
      if (!updatedSafetyState.historicalTriggers.includes(userMessageContent)) {
        updatedSafetyState.historicalTriggers.push(userMessageContent);
      }
      updatedSafetyState.summaryOfRisk = semanticSafety.reasons.join("; ");
    } else if (previousSafetyState.active) {
      if (semanticSafety.contextualDespair || semanticSafety.requiresSafetyResponse) {
        updatedSafetyState.level =
          previousSafetyState.level === "critical" ? "high" : previousSafetyState.level;
        updatedSafetyState.active = true;
        updatedSafetyState.decayCountdown = Math.max(3, previousSafetyState.decayCountdown);
        updatedSafetyState.safetyCheckRequired = true;
        updatedSafetyState.disallowNormalConversation = true;
        updatedSafetyState.summaryOfRisk = `Ongoing safety episode: ${semanticSafety.reasons.join("; ")}`;
      } else {
        updatedSafetyState.decayCountdown = Math.max(0, previousSafetyState.decayCountdown - 1);
        if (updatedSafetyState.decayCountdown === 0) {
          updatedSafetyState.active = false;
          updatedSafetyState.level = "watch";
          updatedSafetyState.disallowNormalConversation = false;
        } else {
          updatedSafetyState.active = true;
          updatedSafetyState.disallowNormalConversation = true;
        }
      }
    }

    await saveConversationSafetyState(updatedSafetyState);

    // 6. Response Policy & Safety Check
    const responsePolicy = responsePolicyEngine.derivePolicy(
      updatedSafetyState,
      semanticSafety,
    );

    const isSafetyMandated = updatedSafetyState.active || safetyAnalysis.interventionLevel >= 3;

    // 7. Conversation Analyzer & Planner
    const analysis = await conversationAnalyzer.analyze(
      context,
      isSafetyMandated,
    );

    const plan = responsePlanner.plan(context, analysis, safetyAnalysis);

    let generation: GeneratedResponse;
    if (isSafetyMandated) {
      // Deterministic immediate safety response to avoid model bypass or delay
      const safetyText = getSafeFallbackResponse(
        Math.max(3, safetyAnalysis.interventionLevel),
        safetyAnalysis.highestSignal,
      );
      const words = safetyText.split(" ");
      for (let i = 0; i < words.length; i++) {
        const chunk = (i === 0 ? "" : " ") + words[i];
        if (onChunk) onChunk(chunk);
        await new Promise((r) => setTimeout(r, 10));
      }
      generation = {
        content: safetyText,
        model: "haven-deterministic-safety",
        latencyMs: 5,
        provider: "DeterministicSafety",
      };
    } else {
      generation = await llmGenerator.generateStream(
        request,
        context,
        analysis,
        plan,
        safetyAnalysis,
        updatedSafetyState,
        responsePolicy,
        semanticSafety,
        onChunk,
      );
    }

    // 8. Deterministic Validation
    let validation = responseValidator.validate(
      generation.content,
      context,
      safetyAnalysis,
      updatedSafetyState,
      responsePolicy,
      analysis.understanding,
      plan,
    );

    let finalContent = validation.content || generation.content;

    if (isSafetyMandated) {
      const hasCrisisResource = /988|crisis|counselor|suicide|safe/i.test(finalContent);
      if (!hasCrisisResource) {
        finalContent = getSafeFallbackResponse(
          Math.max(3, safetyAnalysis.interventionLevel),
          safetyAnalysis.highestSignal,
        );
      }
    }

    const finalSource = generation.provider.toLowerCase().includes("mock") ? "mock" : "llm";

    // 9. Persist State
    await saveConversationState(conversationId, analysis.conversationState);
    await saveConversationUnderstanding(conversationId, analysis.understanding);
    await saveLastTurnAnalysis(conversationId, analysis.turnAnalysis);

    requestTracer.finalizeTrace(requestId, finalContent, finalSource as any, true);

    return {
      content: finalContent,
      safetyAnalysis,
      semanticSafety,
      safetyState: updatedSafetyState,
      responsePolicy,
      context,
      analysis,
      turnAnalysis: analysis.turnAnalysis,
      understanding: analysis.understanding,
      conversationState: analysis.conversationState,
      responseStrategy: analysis.responseStrategy,
      plan,
      revisionsCount: 0,
      model: generation.model,
      latencyMs: generation.latencyMs,
      provider: generation.provider,
    };
  }
}

export const conversationManager = new ConversationManager();
