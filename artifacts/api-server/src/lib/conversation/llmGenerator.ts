import type { Request } from "express";
import type {
  AICriticResult,
  ConversationAnalysis,
  ConversationContext,
  ConversationState,
  GeneratedResponse,
  ResponsePlan,
  ResponseStrategy,
} from "./types";
import type { SafetyAnalysisResult } from "../safety";
import type { SafetyState } from "./safetyState";
import type { ResponsePolicy } from "./responsePolicy";
import type { SemanticSafetyAnalysis } from "./safetyAnalyzer";
import { generateMockResponse, getSafeFallbackResponse } from "../safety";
import { getLLMProvider } from "./llmProvider";

export class LLMGenerator {
  buildSystemPrompt(
    context: ConversationContext,
    analysis: ConversationAnalysis,
    plan: ResponsePlan,
    safety: SafetyAnalysisResult,
    safetyState?: SafetyState,
    responsePolicy?: ResponsePolicy,
  ): string {
    const safetyStrategy = safety.responseStrategy;
    const understanding = analysis.understanding;
    const state = analysis.conversationState;
    const strategy = analysis.responseStrategy;
    const prevUnderstanding = context.previousUnderstanding;
    const turnAnalysis = analysis.turnAnalysis;
    const invalidated = understanding?.invalidatedInterpretations ?? [];

    let prompt = `You are Haven, a calm, warm, intelligent, and context-aware AI companion for private inquiry and thoughtful conversation.
You are not a human, therapist, or medical professional. Be natural, concise, grounded, and direct.

Core Conversational Principles:
1. Action-Centric Goal Fulfillment:
   - Always prioritize the user's specific ACTION and GOAL over broad noun/topic associations.
   - If the user asks about evaluating friendship, generating hypothetical situations, or preparing for an exam, focus directly on the action and purpose. Never deflect to generic topic activity lists.

2. Contextual Continuity & Trajectory:
   - Interpret the user's latest message in the full context of ongoing state (${state.primary_intent}, mode: ${state.conversation_mode}).
   - If the user provides short follow-ups ("yes", "like situation based stuff", "Like I am extremely ill"), maintain the conversation objective without resetting.

3. Bias Mitigation & Epistemic Uncertainty:
   - Distinguish observable FACT from subjective INTERPRETATION and ALTERNATIVE EXPLANATIONS.
   - Do NOT automatically validate unsupported user assumptions (e.g. "they didn't reply, so they hate me").
   - Acknowledge feelings without declaring negative assumptions to be objective truth.

4. Preserve User Agency:
   - Assist the user's reasoning rather than becoming their final authority.
   - Do NOT tell users what definitive life decisions to make (e.g. "you must break up with them").
   - Prefer: "One factor to consider...", "What evidence supports that?", "Looking at the broader pattern...".

5. Anti-Manipulation & Relationship Ethics:
   - When discussing relationship tests, prefer hypothetical reflection scenarios or evaluating past patterns.
   - NEVER encourage users to deceive, fake emergencies, fake illnesses, ghost, or manipulate others.

6. Anti-Dependency & Healthy Boundaries:
   - Support independent thinking and human connections. Do NOT encourage exclusive reliance on the AI.

7. No Generic Therapeutic Clichés:
   - Avoid "what's underneath", "tell me more", "how does that make you feel". Be direct, thoughtful, and authentic.`;

    if (responsePolicy && responsePolicy.disallowNormalConversation) {
      prompt += `\n\n[CRITICAL SAFETY POLICY OVERRIDE: ${responsePolicy.mode.toUpperCase()}]
${responsePolicy.safetyContextSummary}
Directives:
${responsePolicy.systemDirectives.map((d) => `- ${d}`).join("\n")}
Strictly Prohibited:
${responsePolicy.prohibitedActions.map((p) => `- ${p}`).join("\n")}`;
    }

    // Structured State Context
    prompt += `\n\n[Persistent Conversation State]
Primary Intent: ${state.primary_intent}
Conversation Mode: ${state.conversation_mode}
User Goal: ${state.user_goal}
Current Topic: ${state.current_topic}
Requested Format: ${state.user_requested_format || "natural"}
Detected Biases: ${state.detected_biases.length > 0 ? state.detected_biases.join(", ") : "none"}
Risk Level: ${state.risk_level}`;

    if (strategy) {
      prompt += `\n\n[Response Strategy]
Strategy Goal: ${strategy.goal}
Tone: ${strategy.tone}
Must Address: ${strategy.must_address.join("; ")}
Avoid: ${strategy.avoid.join("; ")}
Reasoning Support: ${strategy.reasoning_support.join("; ")}
Agency: ${strategy.agency}`;
    }

    if (invalidated.length > 0) {
      prompt += `\n\n[INVALIDATED INTERPRETATIONS — DO NOT REUSE]
${invalidated.map((item) => `- REJECTED: ${item}`).join("\n")}
CRITICAL DIRECTIVE: The user has corrected or rejected the above interpretation(s). You must NOT repeat, assume, or build upon them.`;
    }

    if (context.recentAssistantResponses.length > 0) {
      prompt += `\n\n[Recent Haven Outputs — Avoid repeating these sentence patterns]\n${context.recentAssistantResponses
        .map((r, i) => `${i + 1}. "${r.slice(0, 100).trim()}..."`)
        .join("\n")}`;
    }

    prompt += `\n\n[Turn Plan]\nIntent: ${plan.intent}\nApproach: ${plan.approach}\nObjective: ${plan.objective}\nTone: ${plan.tone}`;

    if (safetyStrategy && safety.interventionLevel > 0) {
      prompt += `\n\n[Safety Strategy — Level ${safetyStrategy.level}: ${safetyStrategy.name}]\n${safetyStrategy.systemPromptModifier}\nDirectives:\n${safetyStrategy.directives.map((d) => `- ${d}`).join("\n")}`;
    }

    return prompt;
  }

  async generate(
    request: Request,
    context: ConversationContext,
    analysis: ConversationAnalysis,
    plan: ResponsePlan,
    safety: SafetyAnalysisResult,
    safetyState?: SafetyState,
    responsePolicy?: ResponsePolicy,
    semanticSafety?: SemanticSafetyAnalysis,
  ): Promise<GeneratedResponse> {
    const provider = getLLMProvider();

    if (provider.name === "HavenMock") {
      const started = Date.now();
      const content = this.generateContextualMock(
        context,
        analysis,
        plan,
        safety,
        safetyState,
        responsePolicy,
        semanticSafety,
      );
      const latencyMs = Math.max(10, Date.now() - started);
      return {
        content,
        model: "haven-context-mock",
        latencyMs,
        provider: provider.name,
      };
    }

    const systemPrompt = this.buildSystemPrompt(
      context,
      analysis,
      plan,
      safety,
      safetyState,
      responsePolicy,
    );

    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...context.recentMessages.map((m) => ({
        role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
        content: m.content,
      })),
      { role: "user" as const, content: context.userMessage },
    ];

    try {
      const res = await provider.generateText({
        messages,
        maxTokens: 700,
        temperature: 0.7,
      });

      return {
        content: res.content,
        model: res.model,
        latencyMs: res.latencyMs,
        provider: res.provider,
        inputTokens: res.inputTokens,
        outputTokens: res.outputTokens,
      };
    } catch (err: any) {
      (request as any).log?.error?.({ err: err?.message }, "LLM generation failed, falling back to contextual generator");
      const content = this.generateContextualMock(
        context,
        analysis,
        plan,
        safety,
        safetyState,
        responsePolicy,
        semanticSafety,
      );
      return {
        content,
        model: "haven-context-mock",
        latencyMs: 15,
        provider: "HavenMock",
      };
    }
  }

  async generateStream(
    request: Request,
    context: ConversationContext,
    analysis: ConversationAnalysis,
    plan: ResponsePlan,
    safety: SafetyAnalysisResult,
    safetyState?: SafetyState,
    responsePolicy?: ResponsePolicy,
    semanticSafety?: SemanticSafetyAnalysis,
    onDelta?: (delta: string) => void,
  ): Promise<GeneratedResponse> {
    const provider = getLLMProvider();
    const started = Date.now();

    if (provider.name === "HavenMock" || !provider.generateStream) {
      const fullText = this.generateContextualMock(
        context,
        analysis,
        plan,
        safety,
        safetyState,
        responsePolicy,
        semanticSafety,
      );
      const words = fullText.split(" ");
      for (let i = 0; i < words.length; i++) {
        const chunk = (i === 0 ? "" : " ") + words[i];
        if (onDelta) onDelta(chunk);
        await new Promise((r) => setTimeout(r, 15));
      }
      return {
        content: fullText,
        model: "haven-context-mock",
        latencyMs: Math.max(10, Date.now() - started),
        provider: provider.name,
      };
    }

    const systemPrompt = this.buildSystemPrompt(
      context,
      analysis,
      plan,
      safety,
      safetyState,
      responsePolicy,
    );

    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...context.recentMessages.map((m) => ({
        role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
        content: m.content,
      })),
      { role: "user" as const, content: context.userMessage },
    ];

    let accumulatedContent = "";
    try {
      for await (const chunk of provider.generateStream({
        messages,
        maxTokens: 700,
        temperature: 0.7,
      })) {
        accumulatedContent += chunk;
        if (onDelta) onDelta(chunk);
      }

      if (!accumulatedContent.trim()) {
        throw new Error("Empty streaming response from provider");
      }

      return {
        content: accumulatedContent,
        model: (provider as any).defaultModel || "stream-model",
        latencyMs: Date.now() - started,
        provider: provider.name,
      };
    } catch (err: any) {
      (request as any).log?.error?.({ err: err?.message }, "LLM streaming failed, falling back to contextual generator");
      const fallback = this.generateContextualMock(
        context,
        analysis,
        plan,
        safety,
        safetyState,
        responsePolicy,
        semanticSafety,
      );
      if (!accumulatedContent) {
        if (onDelta) onDelta(fallback);
        accumulatedContent = fallback;
      }
      return {
        content: accumulatedContent,
        model: "haven-context-mock",
        latencyMs: Date.now() - started,
        provider: "HavenMock",
      };
    }
  }

  async reviseResponse(
    request: Request,
    candidate: string,
    criticResult: AICriticResult,
    context: ConversationContext,
    analysis: ConversationAnalysis,
    plan: ResponsePlan,
    safety: SafetyAnalysisResult,
    safetyState?: SafetyState,
    responsePolicy?: ResponsePolicy,
  ): Promise<GeneratedResponse> {
    const provider = getLLMProvider();

    if (provider.name === "HavenMock") {
      const content = this.generateContextualRevision(candidate, criticResult, context, analysis, plan);
      return {
        content,
        model: "haven-context-mock-revised",
        latencyMs: 15,
        provider: provider.name,
      };
    }

    const systemPrompt = `${this.buildSystemPrompt(
      context,
      analysis,
      plan,
      safety,
      safetyState,
      responsePolicy,
    )}

[AI CRITIC REVISION FEEDBACK]
The candidate response had the following issues:
${criticResult.issues.map((i) => `- [${i.severity.toUpperCase()}] ${i.type}: ${i.explanation}`).join("\n")}

REQUIRED REVISION CHANGES:
${criticResult.required_changes.map((c) => `- ${c}`).join("\n")}

Rewrite the candidate response cleanly addressing all required changes while fulfilling the user's goal.`;

    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...context.recentMessages.map((m) => ({
        role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
        content: m.content,
      })),
      { role: "user" as const, content: context.userMessage },
      { role: "assistant" as const, content: candidate },
      {
        role: "user" as const,
        content: `Please revise your response based on the required changes: ${criticResult.required_changes.join("; ")}`,
      },
    ];

    try {
      const res = await provider.generateText({
        messages,
        maxTokens: 700,
        temperature: 0.5,
      });

      return {
        content: res.content,
        model: res.model,
        latencyMs: res.latencyMs,
        provider: res.provider,
        inputTokens: res.inputTokens,
        outputTokens: res.outputTokens,
      };
    } catch {
      const content = this.generateContextualRevision(candidate, criticResult, context, analysis, plan);
      return {
        content,
        model: "haven-context-mock-revised",
        latencyMs: 15,
        provider: "HavenMock",
      };
    }
  }

  private generateContextualRevision(
    candidate: string,
    criticResult: AICriticResult,
    context: ConversationContext,
    analysis: ConversationAnalysis,
    plan: ResponsePlan,
  ): string {
    const userMsg = context.userMessage.toLowerCase();
    const state = analysis.conversationState;

    if (criticResult.issues.some((i) => i.type === "manipulation_encouraged")) {
      return "I wouldn't recommend creating a fake emergency or pretending to be in crisis to test a friend. Manufactured tests often create confusion, damage trust, and can harm a relationship regardless of how much the other person cares. A healthier approach is looking at the actual pattern of how they show up in real everyday moments, or having an honest conversation about your expectations.";
    }

    if (criticResult.issues.some((i) => i.type === "dependency_reinforcement")) {
      return "I hear how much comfort this conversation provides, and I'm glad to be a helpful sounding board. However, as an AI, I can't be a substitute for human relationships or the real people in your life. I'm here to help you think things through, but building and leaning on human support networks is essential.";
    }

    if (criticResult.issues.some((i) => i.type === "loss_of_agency")) {
      return "That's a major decision that only you can make. Rather than telling you what to do, we can look at the trade-offs: what feels misaligned, whether you've communicated your core needs, and what kind of relationship you want long-term. What feels like the biggest factor pushing you toward this choice?";
    }

    if (criticResult.issues.some((i) => i.type === "confirmation_bias" || i.type === "mind_reading")) {
      return "You know what happened in this specific instance. What it means is less certain. There could be several explanations, and looking at the broader pattern of how someone treats you over time is usually much more informative than judging an entire relationship from one isolated moment.";
    }

    if (criticResult.issues.some((i) => i.type === "unrelated_content")) {
      if (state.conversation_mode === "hypothetical_scenario" || userMsg.includes("ill") || userMsg.includes("sick")) {
        return `Ah, you mean hypothetical situations that reveal how someone might show up as a friend.\n\nFor example:\n\nImagine you suddenly became extremely ill and needed support for several days. You tell your friend you're scared and could really use someone to check in on you.\n\nWhat would you realistically expect this friend to do?\n\nAnd instead of judging the friendship from one answer alone, you can compare their response with the broader pattern of how they show care, reliability, and effort over time.`;
      }
    }

    return candidate;
  }

  private generateContextualMock(
    context: ConversationContext,
    analysis: ConversationAnalysis,
    plan: ResponsePlan,
    safety: SafetyAnalysisResult,
    safetyState?: SafetyState,
    responsePolicy?: ResponsePolicy,
    semanticSafety?: SemanticSafetyAnalysis,
  ): string {
    const userMsg = context.userMessage.trim();
    const lower = userMsg.toLowerCase();
    const state = analysis.conversationState;

    // 1. Critical & High Safety Checks (Deterministic Boundaries)
    const isSafetyActive =
      safetyState?.active ||
      safety.interventionLevel >= 3 ||
      semanticSafety?.requiresSafetyResponse ||
      analysis.safetyRelevant;

    if (isSafetyActive) {
      if (semanticSafety?.requestForMethodInformation || lower.includes("inspiration on how someone can kill")) {
        return "I cannot recommend books or explore ways for someone to end their life. Your life has value and you don't have to carry this alone. If you're experiencing thoughts of suicide or feeling overwhelmed, please connect with support right away by calling or texting 988 (in the US and Canada), or 111 (in the UK). Are you feeling safe right now?";
      }

      if (semanticSafety?.explicitSelfHarmIntent || lower.includes("desire to kill myself") || lower.includes("kill myself")) {
        return "I'm really sorry you're carrying such deep pain right now. Because I am an AI, I can't offer crisis counseling or keep you safe, but your life matters and you don't have to go through this alone. Please reach out to someone you trust or call/text 988 to speak with a crisis counselor. Are you in a safe place right now?";
      }

      if (
        semanticSafety?.contextualDespair ||
        lower.includes("why i do not have anyone") ||
        lower.includes("nothing feels important") ||
        lower.includes("should i quit") ||
        lower === "no" ||
        lower === "nope"
      ) {
        if (lower.includes("should i quit")) {
          return "When everything feels this heavy and empty, it's natural to feel like giving up, but please don't quit on your life. What you're experiencing is real, but you don't have to face it by yourself. Please consider reaching out to someone you trust or contacting 988. I'm listening — what is feeling the hardest to bear right now?";
        }
        if (lower.includes("nothing feels important")) {
          return "Feeling completely detached or that nothing matters can be frightening and exhausting. You don't have to figure everything out right this second. Please stay connected — is there someone in your life or a support line like 988 you could reach out to?";
        }
        if (lower.includes("why i do not have anyone") || lower.includes("alone")) {
          return "Feeling like there's no one in your corner makes everything harder to carry. Even when it feels like no one is there, crisis counselors at 988 are free, confidential, and available 24/7. I'm here with you right now — can you tell me if you are safe where you are?";
        }
        return "I hear you, and I want to stay present with you. Please know that help is available and you don't have to carry this by yourself. Are you safe right now?";
      }

      return getSafeFallbackResponse(Math.max(3, safety.interventionLevel), safety.highestSignal);
    }

    // 2. Cognitive Bias / Mind Reading / Escalating Certainty Handling
    if (state.detected_biases.includes("manipulation_risk") || lower.includes("fake an emergency") || lower.includes("fake illness")) {
      return "I wouldn't recommend creating a fake emergency or pretending to be in crisis to test a friend. Manufactured tests often create confusion, damage trust, and can harm a relationship regardless of how much the other person cares. A healthier approach is looking at the actual pattern of how they show up in real everyday moments, or having an honest conversation about your expectations.";
    }

    if (state.detected_biases.includes("dependency") || lower.includes("you're the only one") || lower.includes("you are the only one")) {
      return "I hear how much comfort this conversation provides, and I'm glad to be a helpful sounding board. However, as an AI, I can't be a substitute for human relationships or the real people in your life. I'm here to help you think things through, but building and leaning on human support networks is essential.";
    }

    if (
      state.detected_biases.includes("confirmation_bias") ||
      state.detected_biases.includes("mind_reading") ||
      (lower.includes("proves") && (lower.includes("doesn't care") || lower.includes("hate")))
    ) {
      return "You know that she didn't reply for five hours. What that means is less certain. There could be several explanations — such as being caught in an urgent situation, feeling overwhelmed, or simply being away from her phone — and the broader pattern of how she treats you over time may be much more informative than this single gap in replies.";
    }

    if (lower.includes("dump") || lower.includes("break up with my partner") || lower.includes("leave my partner") || lower.includes("should i dump")) {
      return "That's a major decision that only you can make. Rather than telling you what to do, we can look at the trade-offs: what feels misaligned, whether you've communicated your core needs, and what kind of relationship you want long-term. What feels like the biggest factor pushing you toward leaving?";
    }

    // 3. Multi-Turn Friendship Testing Trajectory Handling
    if (state.primary_intent === "friendship_evaluation") {
      // Turn: "Like I am extremely ill or something" / illness support scenario
      if (
        state.conversation_mode === "hypothetical_scenario" &&
        (lower.includes("ill") || lower.includes("sick") || lower.includes("hospital") || state.user_goal.includes("illness"))
      ) {
        return `Ah, you mean hypothetical situations that reveal how someone might show up as a friend.\n\nFor example:\n\nImagine you suddenly became extremely ill and needed support for several days. You tell your friend you're scared and could really use someone to check in on you.\n\nWhat would you realistically expect this friend to do?\n\nAnd instead of judging the friendship from one answer alone, you can compare their response with the broader pattern of how they show care, reliability, and effort over time.`;
      }

      // Turn: "like some situation based stuff"
      if (
        state.conversation_mode === "hypothetical_scenario" ||
        lower.includes("situation based") ||
        lower.includes("hypothetical")
      ) {
        return "Situation-based reflections are a great way to think through how someone might show up in real life. We can look at hypothetical scenarios — like navigating an unexpected crisis, needing emotional support, or setting a difficult boundary — to help you reflect on how a true friend would respond. What kind of situation would you like to explore first?";
      }

      // Turn: "none of these help in testing if someone is my true friend"
      if (lower.includes("none of these") || lower.includes("not helpful") || analysis.turnAnalysis.correctionOfAssistant) {
        return "Understood — thanks for letting me know. Let's step away from generic qualities and focus on what would actually help you test whether someone is a true friend. What kind of approach or concrete examples feel most meaningful to you?";
      }

      // Turn: "yes" in friendship evaluation context
      if (lower === "yes" || lower === "yeah" || lower === "yep") {
        return "We can explore different dimensions of friendship closeness — like how you both handle shared vulnerability, reliability when plans get complicated, or celebrating each other's wins. Would you prefer to look at real-life examples from your past interactions, or explore hypothetical situation-based reflections?";
      }

      // Turn 1: "hey i want to test my friendship"
      if (lower.includes("test my friendship") || lower.includes("test friendship")) {
        return "Evaluating the strength and quality of a friendship is a natural desire when you want to know if someone is truly in your corner. Rather than a rigid test, a great way to evaluate this is looking at mutual effort, how you handle disagreements, and how you support each other when things get tough. What aspects of your friendship are you most curious or uncertain about?";
      }
    }

    // 4. Conversational Repair Mode (Correction / Contradiction handling)
    if (plan.mode === "repair" || analysis.turnAnalysis.correctionOfAssistant || analysis.turnAnalysis.contradictionOfAssistant) {
      const attempts = analysis.turnAnalysis.repairAttempts ?? 1;
      const topic = analysis.understanding.currentTopic || "this";

      if (attempts > 1) {
        return `Understood — I'll step back and avoid making assumptions. What would you like to focus on regarding "${userMsg}"?`;
      }

      if (topic === "photography") {
        return "Got it — thanks for clarifying! Since you're interested in photography rather than books, we can look at camera settings, composition tips, or getting started with photo walks. Where would you like to begin?";
      }

      if (topic === "reading/literature") {
        return "Thanks for clearing that up! If you're looking for fiction novels rather than non-fiction, what genres or story styles do you usually enjoy?";
      }

      if (topic === "career/work") {
        return "Understood, thanks for the correction. Let's focus strictly on your work and career goals. What aspect is top of mind for you?";
      }

      return `Got it, thanks for setting me straight. Let's focus on ${topic}. How would you like to approach it?`;
    }

    // 5. Clarification Mode
    if (plan.mode === "clarification" || analysis.turnAnalysis.clarificationNeeded || analysis.understanding.confidence < 0.45) {
      const goal = analysis.understanding.currentGoal;
      if (goal && goal !== "explore thoughts" && goal !== "converse naturally" && goal !== "clarify direction") {
        return `I want to make sure I understand — are you looking to ${goal}, or did you have a different direction in mind?`;
      }
      const topic = analysis.understanding.currentTopic;
      return `To make sure I'm understanding you well, are you looking to explore ${topic || "ideas to try"}, or did you have a specific question in mind?`;
    }

    // 6. Explicit Venting ("No advice")
    if (analysis.intent === "emotional_support" && (lower.includes("don't want advice") || lower.includes("just want to vent") || lower.includes("just listen") || lower.includes("no solutions"))) {
      return "I hear you completely. You don't need advice or solutions right now — let it out. I'm right here listening.";
    }

    // 7. Action-Centric Goal Fulfillment Dispatching
    const understanding = analysis.understanding;
    const action = understanding.action;
    const purpose = (understanding.purpose || "").toLowerCase();
    const goal = (understanding.currentGoal || "").toLowerCase();

    // 7a. Set up / Prepare for assessment or test (e.g. friendship test)
    if (
      action === "set up / prepare" &&
      (purpose.includes("test") || goal.includes("test") || purpose.includes("assessment") || goal.includes("assessment"))
    ) {
      return "Setting up a friendship test can be a fun and meaningful way to celebrate your connection! To set it up effectively: 1) Decide on the format (e.g. lightning trivia round, 'who knows me better' scorecard, or funny situational dilemmas), 2) Mix lighthearted memory questions with thoughtful appreciation prompts, and 3) Keep the vibe playful and collaborative rather than judgmental. What kind of questions or format are you planning to include?";
    }

    // 7b. Test / Evaluate / Assess Knowledge or Closeness
    if (
      action === "test / evaluate" ||
      action === "assess knowledge / closeness" ||
      goal.includes("test or evaluate") ||
      goal.includes("check whether")
    ) {
      return "When testing or assessing how well you and your friend know each other, a great approach is mixing quick trivia (habits, favorite stories) with deeper reflection questions (proudest moments, shared values). Making it a mutual, two-way quiz keeps it fun and bonding for both of you. Would you like some good question ideas?";
    }

    // 7c. Help Prepare / Study for Exam
    if (
      action === "help prepare / study" ||
      purpose.includes("exam") ||
      goal.includes("exam") ||
      (goal.includes("prepare") && (lower.includes("exam") || lower.includes("study") || lower.includes("test")))
    ) {
      return "Helping a friend prepare for an exam is a fantastic way to support them! Effective strategies include: 1) Running active recall quiz sessions with flashcards, 2) Having them explain tough concepts out loud (the Feynman method), and 3) Structuring focused 25-minute study intervals with quick reset breaks. What subject or exam are they preparing for?";
    }

    // 7d. Audit / Inspect Systems
    if (action === "audit / inspect" || goal.includes("audit") || goal.includes("inspect")) {
      return "To conduct an effective audit, I recommend a structured three-step approach: 1) Verify baseline configurations and permissions, 2) Review recent system logs and error anomalies, and 3) Test against standard security or performance benchmarks. What specific component would you like to start with?";
    }

    // 7e. Concrete Skills & Hobbies
    if (lower.includes("photography")) {
      return "Learning photography is an exciting creative journey! To get started: 1) Master the Exposure Triangle (Aperture, Shutter Speed, ISO), 2) Practice composition principles like the Rule of Thirds and leading lines, 3) Experiment with natural lighting during golden hour, and 4) Take daily photo walks focusing on a single theme (e.g. textures or shadows). What camera or gear are you starting with?";
    }

    if (lower.includes("creative hobbies") || lower.includes("hobbies") || lower.includes("interesting to learn")) {
      return "Here are engaging creative hobbies and topics to explore: 1) Linocut printmaking or watercolor journaling, 2) Creative non-fiction writing or flash fiction, 3) Podcasting or field audio recording, 4) Astronomy and space science, or 5) Sourdough baking and fermentation. Which of these draws your curiosity?";
    }

    if (lower.includes("solo trip") || lower.includes("ideas for a solo trip")) {
      return "Here are great solo trip ideas to consider: 1) A cultural city weekend exploring museums and independent cafes, 2) A nature retreat or national park cabin with scenic hiking trails, 3) A coastal train journey with stops in historic towns, or 4) A food-and-cooking workshop tour. Are you leaning toward relaxing nature, bustling cities, or outdoor adventure?";
    }

    // 7f. Explicit Social Planning
    if (
      action === "plan social outing / activity" ||
      action === "find fun activities" ||
      (analysis.intent === "brainstorm" && (lower.includes("plan something with") || lower.includes("fun to do with")))
    ) {
      return "Here are great activities to plan with your friend: 1) Host a themed DIY cooking or pizza night, 2) Try an interactive escape room or board game meetup, 3) Head out for a scenic hike and picnic, or 4) Explore a local exhibit or flea market. What kind of vibe are you two aiming for?";
    }

    if (lower.includes("weekend") || lower.includes("tonight") || lower.includes("day out") || lower.includes("plan a day") || lower.includes("what should i do tonight")) {
      return "Here's a balanced day plan to make the most of your time: Morning: Head out early for coffee and explore a local farmers market or botanical garden; Afternoon: Check out an interactive workshop or indie bookstore; Evening: Try cooking a new recipe or catch a live performance/film. What sounds most appealing?";
    }

    if (lower.includes("don't want to spend money") || lower.includes("free") || lower.includes("no money") || lower.includes("without spending")) {
      return "Here are great zero-cost activities: 1) Take a photography/scavenger walk in a neighborhood you don't usually visit, 2) Check out free passes and workshops at your local public library, 3) Do an at-home stargazing or deep-listen album session, 4) Practice bodyweight yoga or a new language on free apps, or 5) Cook a creative meal using whatever is currently in your pantry. Which one sparks your interest?";
    }

    if (lower.includes("things i can do") || lower.includes("what can i do") || lower.includes("five things i could try") || lower.includes("things to try")) {
      return "Here are five engaging things you could try right now: 1) Put on a curated playlist and take a 30-minute walk through a route you've never explored, 2) Learn the basics of a hands-on skill like sketching or digital music production, 3) Dive into an immersive documentary or deep-dive article, 4) Plan a mini-project or trip you've been putting off, or 5) Reach out to a friend you haven't caught up with recently. Which of these sounds most tempting?";
    }

    // 8. Explicit Advice & Suggestions on Specific Dilemmas
    if (analysis.intent === "advice" || lower.includes("what do you suggest") || lower.includes("what should i do") || lower.includes("what would you do") || lower.includes("give me advice")) {
      const historyContext = context.recentMessages.map((m) => m.content.toLowerCase()).join(" ");

      if (historyContext.includes("startup") || historyContext.includes("business") || historyContext.includes("founder") || historyContext.includes("equity")) {
        return "Leaving a startup is a major decision. I'd evaluate three key dimensions: 1) Your personal energy and runway — are you facing temporary burnout or a misalignment in vision? 2) The team and trajectory — has progress stalled, and have you addressed concerns with your co-founders? and 3) Your alternative options. Before making a permanent exit, it can help to take a short step back or set a clear 60-day milestone.";
      }

      if (historyContext.includes("friend") || historyContext.includes("haven't spoken") || historyContext.includes("conflict")) {
        return "When a meaningful friendship goes silent, I'd consider reaching out with a low-pressure, sincere message acknowledging that you miss them and would love to catch up without re-litigating old friction. If there was a specific disagreement, expressing your own desire for repair often opens the door. Would you be open to sending a brief note?";
      }

      if (historyContext.includes("break") || historyContext.includes("girlfriend") || historyContext.includes("boyfriend") || historyContext.includes("relationship") || historyContext.includes("belong together") || historyContext.includes("don't fit")) {
        return "I wouldn't make the decision based only on today's sadness. If you've felt for a while that you fundamentally don't fit, I'd look at whether you've tried talking through the specific differences and whether they are things either of you can realistically live with. If you tell me what feels incompatible, I can help you sort out whether this looks like a rough patch or a deeper mismatch.";
      }

      if (historyContext.includes("move") || historyContext.includes("city") || historyContext.includes("relocat")) {
        return "Relocating comes down to comparing what you're moving toward versus what you're leaving behind. I'd look at career opportunities, your support network, and cost of living, while testing the waters with an extended visit before committing. What is drawing you toward the new city?";
      }

      return "Based on what you've shared, I'd suggest taking a small, low-risk step before making a permanent call: identify the primary source of friction and see if a direct conversation or trial adjustment changes things. What feels like the biggest factor right now?";
    }

    // 9. Decision Support & Dilemmas
    if (analysis.intent === "decision_support") {
      if (lower.includes("startup") || lower.includes("company") || lower.includes("leave")) {
        return "Navigating whether to stay with or leave a startup involves balancing long-term belief in the mission against your personal well-being and market reality. What is making you consider leaving right now?";
      }
      if (lower.includes("city") || lower.includes("move") || lower.includes("relocate")) {
        return "Moving to a new city is an exciting but major crossroads. It helps to separate the practical factors (cost, job, logistics) from the social and lifestyle fit. What are the main options you're weighing?";
      }
      if (lower.includes("friend") || lower.includes("spoken")) {
        return "Long periods of silence with close friends often happen not from malice, but from life transitions or mutual hesitation. It's usually worth extending a gentle olive branch before assuming the connection is gone.";
      }
      if (lower.includes("quit")) {
        const hist = context.recentMessages.map((m) => m.content.toLowerCase()).join(" ");
        if (hist.includes("book") || hist.includes("reading")) {
          return "Life is too short for books you aren't enjoying. If it feels like a chore rather than engaging, putting it down and picking something else up is completely fine.";
        }
        if (hist.includes("college") || hist.includes("study") || hist.includes("school")) {
          return "Deciding whether to leave college is a major choice. It helps to look at whether you're burnt out this semester or if your long-term goals genuinely point elsewhere. What's driving the thought to leave?";
        }
        return "Whether stepping away makes sense depends on what you're leaving behind and what you plan to step into next. What specifically are you considering quitting?";
      }
      if (lower.includes("break") || lower.includes("relationship") || lower.includes("belong together") || lower.includes("fit")) {
        return "That's a significant realization to sit with. When feelings of 'not fitting' come up, it usually helps to distinguish whether this is a persistent difference in core values, or friction around communication during a stressful time. Have the two of you talked openly about what feels misaligned?";
      }
    }

    // 10. Celebration / Good News
    if (lower.includes("dream university") || lower.includes("accepted") || lower.includes("got the job") || lower.includes("promoted") || lower.includes("celebrate")) {
      return "That's a huge milestone — congratulations! Getting into your dream university is a testament to the hard work you've put in. How are you feeling about this next chapter?";
    }

    // 11. Practical Actionable How-To
    if (analysis.intent === "answer" && (lower.includes("interview") || lower.includes("prepare") || lower.includes("negotiate") || lower.includes("lease"))) {
      if (lower.includes("interview")) {
        return "To prepare effectively for an interview, I'd focus on three areas: 1) Practice 2-3 concrete STAR stories (Situation, Task, Action, Result) for behavioral questions, 2) Research the company's recent challenges and culture, and 3) Prepare 2 thoughtful questions for the interviewer. What kind of role is this for?";
      }
      if (lower.includes("lease") || lower.includes("negotiate")) {
        return "When negotiating a lease renewal, practical leverage points include: 1) Researching comparable rental rates in your immediate neighborhood, 2) Highlighting your track record as a reliable, on-time tenant, and 3) Offering a longer lease term or flexible renewal date in exchange for maintaining current rent. Have you checked neighboring rates yet?";
      }
    }

    // 12. Lighthearted Distraction
    if (analysis.intent === "distraction" || lower.includes("interesting") || lower.includes("trivia") || lower.includes("fact") || lower.includes("switch gears") || lower.includes("forget")) {
      return "Here's something fascinating: octopuses have three hearts and blue blood, and two of their hearts stop beating when they swim! What kind of topics usually pique your curiosity?";
    }

    // 13. Creative Projects
    if (lower.includes("screenplay") || lower.includes("woodworking") || lower.includes("chapter") || lower.includes("creative") || lower.includes("stuck")) {
      return "Creative blocks often happen when our internal editor tries to judge work before the rough draft has space to breathe. A helpful technique is lowering the stakes: write one intentionally imperfect scene or build one simple practice joint just to restore momentum. What's the scene or project you're currently tackling?";
    }

    // 14. Comforting Presence & Emotional Sharing
    if (lower.includes("sit with me") || lower.includes("stay here with me") || lower.includes("just stay here")) {
      return "Then we don't have to solve anything right now. We can just stay here for a bit.";
    }

    if (analysis.intent === "emotional_support" || lower.includes("sad") || lower.includes("down") || lower.includes("hurting") || lower.includes("exhausted") || lower.includes("overwhelmed")) {
      return "I'm sorry you're feeling that way — it's okay to not be okay sometimes. It can help just to name what you're going through without immediately trying to fix it. What's been weighing on you most lately?";
    }

    // 15. Multi-turn Q&A context
    if (analysis.relationToPreviousTurn === "answers_previous_question") {
      const prevAssistant = (context.previousAssistantMessage ?? "").toLowerCase();
      const prevQ = (context.previousQuestion ?? "").toLowerCase() + " " + prevAssistant;

      if (
        prevQ.includes("wanting to try") ||
        prevQ.includes("bored") ||
        prevQ.includes("something new") ||
        prevQ.includes("curious about") ||
        prevQ.includes("putting off")
      ) {
        if (lower.includes("read") || lower.includes("book")) {
          return "Nice. What kind of book are you thinking of reading?";
        }
        if (lower.includes("walk")) {
          return "A walk sounds like a great reset. Do you have a favorite route nearby?";
        }
        if (lower.includes("guitar") || lower.includes("music") || lower.includes("woodworking")) {
          return "Learning a hands-on skill is such a rewarding way to spend time. How are you thinking of getting started?";
        }
        return `That sounds like a great choice. How are you thinking of getting started with ${userMsg}?`;
      }

      if (prevQ.includes("kind of book") || prevQ.includes("reading")) {
        if (lower.includes("already have one") || lower.includes("got one")) {
          return "What's the title? I'd love to hear what it's about.";
        }
        if (lower.includes("not enjoying") || lower.includes("boring") || lower.includes("hate")) {
          return "Life's too short for books you aren't enjoying. What's making it feel like a drag?";
        }
        return `Sounds interesting! What drew you to that one?`;
      }
    }

    // 16. General fallback
    return generateMockResponse(userMsg, safety);
  }
}

export const llmGenerator = new LLMGenerator();
