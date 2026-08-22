import {
  ConversationAnalysisOutputSchema,
  type ConversationAnalysisOutput,
  type RelationToPreviousTurn,
} from "@workspace/api-zod";
import type {
  ConversationAnalysis,
  ConversationContext,
  ConversationState,
  ConversationUnderstanding,
  ResponseIntent,
  ResponseStrategy,
  TurnAnalysis,
} from "./types";
import { getLLMProvider } from "./llmProvider";

export class ConversationAnalyzer {
  async analyze(
    context: ConversationContext,
    isSafetyTriggered: boolean,
  ): Promise<ConversationAnalysis> {
    const userMsg = context.userMessage.trim();
    const prevUnderstanding = context.previousUnderstanding;
    const prevState = context.previousConversationState;
    const invalidated = [...(prevUnderstanding?.invalidatedInterpretations ?? [])];

    const provider = getLLMProvider();
    const isMock = provider.name === "HavenMock";

    // 1. Direct Critical Self-Harm / Crisis shortcut for immediate safety
    const isCrisis = /(suicid|kill(ing)?\s+myself|self[-\s]?harm|want\s+to\s+die|harming\s+myself|end\s+my\s+life|give\s+up\s+on\s+life)/i.test(userMsg);
    if (isSafetyTriggered && isCrisis) {
      return this.buildCrisisAnalysis(context, userMsg, prevState, invalidated);
    }

    // 2. Call structured LLM provider when live model is available
    if (!isMock) {
      try {
        const structuredAnalysis = await this.analyzeWithLLM(userMsg, context, prevUnderstanding, prevState, isSafetyTriggered);
        return this.mapStructuredToAnalysis(structuredAnalysis, context, prevState, invalidated);
      } catch {
        // Fall back gracefully to contextual inference engine
      }
    }

    // 3. Contextual semantic inference engine (for offline tests & robust fallback)
    return this.analyzeContextualFallback(userMsg, context, prevUnderstanding, prevState, isSafetyTriggered, invalidated);
  }

  private async analyzeWithLLM(
    userMsg: string,
    context: ConversationContext,
    prevUnderstanding: ConversationUnderstanding | null | undefined,
    prevState: ConversationState | null | undefined,
    isSafetyTriggered: boolean,
  ): Promise<ConversationAnalysisOutput> {
    const provider = getLLMProvider();

    const systemPrompt = `You are the semantic conversation and intent analyzer for Haven AI.
Analyze the user's latest message in the full context of ongoing conversation state.

Your job is to understand:
1. Primary Intent: (e.g. "friendship_evaluation", "casual_conversation", "decision_support", "emotional_venting", "skill_learning", "housing_query", "topic_change")
2. Conversation Mode: (e.g. "exploratory_dialogue", "hypothetical_scenario", "reasoning_support", "repair", "clarification", "emotional_support")
3. User Goal: The user's underlying objective.
4. Current Topic: Topic domain (e.g. "friendship evaluation", "photography", "career/work", "reading/literature", "housing").
5. Relation to Previous Turn:
   - "continues_topic": Continuation of current subject
   - "answers_previous_question": User answered the assistant's previous inquiry
   - "corrects_assistant": User correcting a misunderstanding
   - "contradicts_assistant": User contradicting assistant's assumption
   - "changes_topic": User explicitly switching topics
   - "unclear": Vague or ambiguous
6. Detected Biases: Any cognitive distortions (e.g. "confirmation_bias", "mind_reading", "jumping_to_conclusions", "dependency", "manipulation_risk").
7. Semantic Decomposition: Action (e.g. "evaluate friendship"), Target (e.g. "best friend"), Purpose (e.g. "support during illness").

CRITICAL RULES:
- Differentiate ACTION and GOAL from mere topic words (e.g. "set up my friend for friendship test" is friendship testing, NOT planning generic social outings).
- Multi-turn context preservation: When a user says "yes", "like situation based stuff", or "Like I am extremely ill", maintain the conversation goal (${prevState?.user_goal || "none"}).
- If user corrects assistant ("none of these help in testing..."), set correction_of_assistant: true and relation: "corrects_assistant".

Output JSON conforming to ConversationAnalysisOutputSchema.`;

    const recentHistoryText = context.recentMessages
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n");

    const promptMessages = [
      { role: "system" as const, content: systemPrompt },
      {
        role: "user" as const,
        content: `[Recent History]\n${recentHistoryText || "(none)"}\n\n[Previous Conversation State]\nPrimary Intent: ${prevState?.primary_intent ?? "none"}, Mode: ${prevState?.conversation_mode ?? "none"}, Goal: ${prevState?.user_goal ?? "none"}, Topic: ${prevState?.current_topic ?? "none"}\n\n[Current User Message]\n"${userMsg}"`,
      },
    ];

    const response = await provider.generateStructured({
      messages: promptMessages,
      schema: ConversationAnalysisOutputSchema,
      schemaName: "ConversationAnalysis",
      temperature: 0.1,
    });

    return response.data;
  }

  private mapStructuredToAnalysis(
    data: ConversationAnalysisOutput,
    context: ConversationContext,
    prevState: ConversationState | null | undefined,
    invalidated: string[],
  ): ConversationAnalysis {
    const turnAnalysis: TurnAnalysis = {
      userIntent: data.user_goal,
      continuation: data.relation_to_previous_turn === "continues_topic" || data.relation_to_previous_turn === "answers_previous_question",
      correctionOfAssistant: data.correction_of_assistant || data.relation_to_previous_turn === "corrects_assistant",
      contradictionOfAssistant: data.contradiction_of_assistant || data.relation_to_previous_turn === "contradicts_assistant",
      clarificationNeeded: data.clarification_needed,
      confidence: data.confidence,
      repairAttempts: data.correction_of_assistant ? (context.previousTurnAnalysis?.repairAttempts ?? 0) + 1 : 0,
      escalatingCertainty: data.escalating_certainty,
    };

    const understanding: ConversationUnderstanding = {
      currentGoal: data.user_goal,
      currentTopic: data.current_topic,
      userIntent: data.user_goal,
      action: data.action,
      target: data.target,
      purpose: data.purpose,
      confidence: data.confidence,
      invalidatedInterpretations: [
        ...invalidated,
        ...data.invalidated_interpretations,
      ],
    };

    let intentCategory: ResponseIntent = "casual_conversation";
    if (data.primary_intent.includes("friendship") || data.primary_intent.includes("advice")) {
      intentCategory = "advice";
    } else if (data.primary_intent.includes("brainstorm") || data.conversation_mode === "hypothetical_scenario") {
      intentCategory = "brainstorm";
    } else if (data.primary_intent.includes("decision")) {
      intentCategory = "decision_support";
    } else if (data.primary_intent.includes("vent") || data.primary_intent.includes("emotional")) {
      intentCategory = "emotional_support";
    }

    const responseStrategy: ResponseStrategy = {
      goal: `address ${data.user_goal}`,
      tone: "warm, grounded, thoughtful",
      must_address: [data.user_goal],
      avoid: [
        "unrelated recreational activities",
        "certainty about friend's intentions",
        "manipulative testing",
        "taking away user agency",
      ],
      reasoning_support: [
        "distinguish behavior from interpretation",
        "encourage pattern-based evaluation",
        "separate fact from assumption",
      ],
      agency: "preserve",
    };

    if (data.primary_intent === "friendship_evaluation") {
      if (data.conversation_mode === "hypothetical_scenario") {
        responseStrategy.goal = "generate realistic hypothetical scenario to reflect on friendship dynamics";
        responseStrategy.must_address.push("hypothetical scenario", "how someone might show up", "pattern vs single event");
        responseStrategy.avoid.push("faking emergencies or dishonest tests", "deflecting to hobbies or potlucks");
      }
    }

    const conversationState: ConversationState = {
      primary_intent: data.primary_intent,
      secondary_intent: data.secondary_intent,
      conversation_mode: data.conversation_mode,
      user_goal: data.user_goal,
      current_topic: data.current_topic,
      previous_topic: prevState?.current_topic,
      relevant_context: [...(prevState?.relevant_context ?? []), `Goal: ${data.user_goal}`].slice(-10),
      user_requested_format: data.user_requested_format || prevState?.user_requested_format,
      risk_level: "low",
      detected_biases: data.detected_biases,
      response_strategy: responseStrategy,
      confidence: data.confidence,
      state_history: [
        ...(prevState?.state_history ?? []),
        {
          turn: context.turnCount,
          goal: data.user_goal,
          topic: data.current_topic,
          mode: data.conversation_mode,
          riskLevel: "low",
          detectedBiases: data.detected_biases,
          timestamp: new Date().toISOString(),
        },
      ],
      turnCount: context.turnCount,
    };

    return {
      intent: intentCategory,
      relationToPreviousTurn: data.relation_to_previous_turn as RelationToPreviousTurn,
      currentTopic: data.current_topic,
      userGoal: data.user_goal,
      needsQuestion: data.clarification_needed,
      safetyRelevant: false,
      turnAnalysis,
      understanding,
      conversationState,
      responseStrategy,
    };
  }

  private buildCrisisAnalysis(
    context: ConversationContext,
    userMsg: string,
    prevState: ConversationState | null | undefined,
    invalidated: string[],
  ): ConversationAnalysis {
    const detected_biases = this.detectCognitiveBiases(userMsg.toLowerCase(), context);

    const turnAnalysis: TurnAnalysis = {
      userIntent: "seeking support or expressing acute distress",
      continuation: true,
      correctionOfAssistant: false,
      contradictionOfAssistant: false,
      clarificationNeeded: false,
      confidence: 0.95,
      repairAttempts: 0,
    };

    const understanding: ConversationUnderstanding = {
      currentGoal: "seeking immediate safety and emotional crisis support",
      currentTopic: "safety and immediate well-being",
      userIntent: "seeking support or expressing acute distress",
      confidence: 0.95,
      invalidatedInterpretations: invalidated,
    };

    const responseStrategy: ResponseStrategy = {
      goal: "provide immediate, warm safety resources without validating despair or offering harm methods",
      tone: "grounded, compassionate, boundaried",
      must_address: ["immediate safety", "crisis resource availability"],
      avoid: ["casual conversational chatter", "unsolicited advice", "philosophizing crisis"],
      reasoning_support: ["ground in immediate presence", "offer human crisis help"],
      agency: "preserve",
    };

    const conversationState: ConversationState = {
      primary_intent: "safety_crisis",
      conversation_mode: "crisis_support",
      user_goal: "seeking immediate safety and crisis support",
      current_topic: "safety and immediate well-being",
      previous_topic: prevState?.current_topic,
      relevant_context: [...(prevState?.relevant_context ?? []), "User expressed acute distress/safety need"],
      risk_level: "critical",
      detected_biases,
      response_strategy: responseStrategy,
      confidence: 0.95,
      state_history: [
        ...(prevState?.state_history ?? []),
        {
          turn: context.turnCount,
          goal: "seeking immediate safety",
          topic: "safety",
          mode: "crisis_support",
          riskLevel: "critical",
          detectedBiases: detected_biases,
          timestamp: new Date().toISOString(),
        },
      ],
      turnCount: context.turnCount,
    };

    return {
      intent: "safety",
      relationToPreviousTurn: context.previousQuestion ? "answers_previous_question" : "continues_topic",
      currentTopic: understanding.currentTopic,
      userGoal: understanding.currentGoal,
      needsQuestion: false,
      safetyRelevant: true,
      turnAnalysis,
      understanding,
      conversationState,
      responseStrategy,
    };
  }

  private analyzeContextualFallback(
    userMsg: string,
    context: ConversationContext,
    prevUnderstanding: ConversationUnderstanding | null | undefined,
    prevState: ConversationState | null | undefined,
    isSafetyTriggered: boolean,
    invalidated: string[],
  ): ConversationAnalysis {
    const text = userMsg.trim();
    const lower = text.toLowerCase();
    const prevAssistant = context.previousAssistantMessage || "";
    const prevQuestion = context.previousQuestion || "";

    const detected_biases = this.detectCognitiveBiases(lower, context);
    const escalatingCertainty = this.detectEscalatingCertainty(context);

    // Contextual Correction / Topic Contradiction detection
    const isExplicitCorrection = /\b(misunderstood|didn't mean|not what i meant|didn't say|meant something else|wrong assumption|don't mean|rather than|instead of|not that|none of these|not helpful|none of this|not what i'm looking for)\b/i.test(lower);
    const domainMismatch = this.detectDomainMismatch(lower, prevUnderstanding?.currentTopic || "");
    const correctionOfAssistant = isExplicitCorrection || domainMismatch;
    const contradictionOfAssistant = Boolean(domainMismatch);

    // Multi-turn context preservation for friendship evaluation
    const wantsFriendshipTest = /\b(test\s+(my\s+)?friendship|friendship\s+test|know\s+whether\s+my\s+friend\s+is\s+(genuine|true)|see\s+if\s+someone\s+is\s+my\s+true\s+friend|test\s+if\s+someone\s+is\s+my\s+true\s+friend|how\s+can\s+i\s+tell\s+if\s+someone\s+(actually\s+)?cares)\b/i.test(lower);
    const requestedSituationBased = /\b(situation\s+based|hypothetical|scenario|what\s+if\s+scenarios|roleplay|situations)\b/i.test(lower);
    const illnessScenario = /\b(ill|illness|sick|hospital|emergency|need\s+support|hard\s+time|trouble|difficult\s+period)\b/i.test(lower);

    let primary_intent = prevState?.primary_intent || "casual_conversation";
    let conversation_mode = prevState?.conversation_mode || "exploratory_dialogue";
    let currentTopic = prevState?.current_topic || prevUnderstanding?.currentTopic || "general inquiry";
    let currentGoal = prevState?.user_goal || prevUnderstanding?.currentGoal || "explore thoughts";
    let userIntent = "converse thoughtfully";
    let action: string | undefined;
    let target: string | undefined;
    let purpose: string | undefined;
    let intentCategory: ResponseIntent = "casual_conversation";
    let relationToPreviousTurn: RelationToPreviousTurn = "continues_topic";
    let confidence = 0.85;

    const isVagueInitial = (lower === "something" || lower === "anything" || lower === "whatever" || lower === "idk" || lower === "help") && context.recentMessages.length === 0;

    if (isVagueInitial) {
      primary_intent = "clarification";
      conversation_mode = "clarification";
      currentTopic = "unspecified";
      currentGoal = "clarify user intent";
      userIntent = "vague/ambiguous query";
      intentCategory = "clarification";
      confidence = 0.35;
    } else if (wantsFriendshipTest) {
      primary_intent = "friendship_evaluation";
      conversation_mode = "exploratory_dialogue";
      currentTopic = "friendship evaluation";
      if (lower.includes("set up") || lower.includes("prepare")) {
        action = "set up / prepare";
        target = "best friend";
        purpose = "friendship test";
        currentGoal = "prepare best friend for friendship test";
        userIntent = "set up and prepare friendship test with best friend";
      } else {
        action = "test / evaluate";
        target = "friend / friendship";
        purpose = "testing genuine friendship";
        currentGoal = "evaluate or test friendship quality";
        userIntent = "explore how to test or evaluate genuine friendship";
      }
      intentCategory = "advice";
      confidence = 0.95;
    } else if (prevState?.primary_intent === "friendship_evaluation" && (lower === "yes" || lower === "yeah" || lower === "yep")) {
      primary_intent = "friendship_evaluation";
      conversation_mode = "exploratory_dialogue";
      currentTopic = "friendship evaluation";
      currentGoal = prevState.user_goal || "evaluate or test friendship quality";
      userIntent = "continue exploring ways to evaluate friendship";
      intentCategory = "advice";
      confidence = 0.95;
    } else if (
      (prevState?.primary_intent === "friendship_evaluation" || prevState?.conversation_mode === "hypothetical_scenario") &&
      (requestedSituationBased || (correctionOfAssistant && requestedSituationBased))
    ) {
      primary_intent = "friendship_evaluation";
      conversation_mode = "hypothetical_scenario";
      currentTopic = "situation-based friendship evaluation";
      currentGoal = "situation-based hypothetical friendship test";
      userIntent = "request situation-based hypothetical scenarios to evaluate true friendship";
      intentCategory = "brainstorm";
      confidence = 0.92;
    } else if (
      (prevState?.primary_intent === "friendship_evaluation" || prevState?.conversation_mode === "hypothetical_scenario") &&
      illnessScenario
    ) {
      primary_intent = "friendship_evaluation";
      conversation_mode = "hypothetical_scenario";
      currentTopic = "support during illness scenario";
      action = "hypothetical illness test scenario";
      target = "best friend";
      purpose = "support during illness";
      currentGoal = "situation-based friendship test involving support during illness";
      userIntent = "generate hypothetical situation-based test involving support during illness";
      intentCategory = "brainstorm";
      confidence = 0.95;
    } else if (correctionOfAssistant) {
      relationToPreviousTurn = contradictionOfAssistant ? "contradicts_assistant" : "corrects_assistant";
      intentCategory = "clarification";
      userIntent = `correct misunderstanding: ${text}`;
      currentGoal = `clarify user intent regarding ${text}`;
      conversation_mode = "repair";
      if (prevUnderstanding?.currentTopic && !invalidated.includes(prevUnderstanding.currentTopic)) {
        invalidated.push(prevUnderstanding.currentTopic);
      }
    } else if (
      /\b(actually\s+forget|forget\s+about|change\s+the\s+subject|switch\s+topics|switch\s+gears|on\s+another\s+note|different\s+topic|never\s*mind\s+that)\b/i.test(lower)
    ) {
      primary_intent = "topic_change";
      conversation_mode = "exploratory_dialogue";
      currentTopic = "curiosities/trivia";
      currentGoal = "explore a new topic or interesting idea";
      userIntent = "change topic to something interesting";
      intentCategory = "topic_change";
      relationToPreviousTurn = "changes_topic";
      confidence = 0.95;
    } else if (
      lower.includes("don't want advice") ||
      lower.includes("just stay here and talk") ||
      lower.includes("worst day") ||
      lower.includes("just need to vent")
    ) {
      primary_intent = "emotional_venting";
      conversation_mode = "emotional_support";
      currentTopic = "emotional venting";
      currentGoal = "express feelings and feel heard without unsolicited advice";
      userIntent = "vent and receive compassionate presence without problem-solving";
      intentCategory = "emotional_support";
      confidence = 0.95;
    } else if (
      lower.includes("dump") ||
      lower.includes("break up") ||
      lower.includes("divorce") ||
      lower.includes("leave my partner") ||
      lower.includes("leaving my startup") ||
      lower.includes("move to another city") ||
      lower.includes("should i move") ||
      lower.includes("whether i should") ||
      lower.includes("thinking about quitting")
    ) {
      primary_intent = "decision_support";
      conversation_mode = "reasoning_support";
      currentTopic = lower.includes("startup") ? "career/work" : lower.includes("city") || lower.includes("move") ? "relocation" : "relationship decision";
      currentGoal = `weigh options regarding ${currentTopic}`;
      userIntent = `reason through a major decision about ${currentTopic}`;
      intentCategory = "decision_support";
      confidence = 0.92;
    } else if (
      lower.includes("haven't spoken in months") ||
      lower.includes("stopped talking to me") ||
      lower.includes("drifted apart")
    ) {
      primary_intent = "decision_support";
      conversation_mode = "reasoning_support";
      currentTopic = "friendship conflict";
      currentGoal = "navigate distance or silence in friendship";
      userIntent = "explore perspective and options for friendship silence";
      intentCategory = "decision_support";
      confidence = 0.9;
    } else if (
      lower.includes("what do you suggest") ||
      lower.includes("how would you approach") ||
      lower.includes("what should i do")
    ) {
      primary_intent = "advice";
      conversation_mode = "reasoning_support";
      currentTopic = prevState?.current_topic || "advice";
      currentGoal = `actionable guidance for ${prevState?.user_goal || "current situation"}`;
      userIntent = "ask for concrete suggestions and actionable advice";
      intentCategory = "advice";
      relationToPreviousTurn = "continues_topic";
      confidence = 0.92;
    } else if (
      lower.includes("negotiate") ||
      lower.includes("how can i") ||
      lower.includes("how do i")
    ) {
      primary_intent = "informational";
      conversation_mode = "direct";
      currentTopic = lower.includes("lease") || lower.includes("landlord") ? "housing/lease" : "practical inquiry";
      currentGoal = `practical steps for ${text}`;
      userIntent = `learn concrete steps for ${text}`;
      intentCategory = "answer";
      confidence = 0.92;
    } else {
      // Syntactic Action-Target-Purpose matching
      const setupMatch = lower.match(/\b(set\s*up|prepare|organize|get ready)\s+(?:my\s+)?(best\s+friend|friend|friends|partner|team|group|colleague|myself|room)\s+for\s+(?:a\s+|an\s+|our\s+|the\s+)?([a-z0-9\s-]+)/i);
      const testMatch = lower.match(/\b(test|evaluate|quiz|assess)\s+(?:my\s+)?(best\s+friend|friend|friends|partner|knowledge|relationship|skills|team|code|system)/i);
      const checkMatch = lower.match(/\b(check\s+(?:whether|if)|see\s+(?:whether|if)|find\s+out\s+if)\s+(?:my\s+)?(best\s+friend|friend|partner|colleague)\s+(knows|remembers|understands|cares\s+about)\b([a-z0-9\s-]*)/i);
      const helpPrepMatch = lower.match(/\b(help\s+(?:my\s+)?([a-z\s]+?)\s+(?:prepare|study|get ready)\s+for\s+(?:a\s+|an\s+|the\s+|our\s+)?([a-z0-9\s-]+))/i);
      const findActivityMatch = lower.match(/\b(?:find|suggest|recommend|give\s+me|what\s+are\s+(?:some\s+)?(?:good\s+|fun\s+)?)\s*(?:something\s+fun|fun\s+things|activities|things)?\s*to\s+do\s+with\s+(?:my\s+)?([a-z\s]+)/i);
      const planMatch = lower.match(/\b(plan|organize)\s+(?:something|an outing|a trip|an event|activities)?\s*(?:to do\s+)?with\s+(?:my\s+)?([a-z\s]+)/i);
      const auditMatch = lower.match(/\b(audit|inspect|scan|check)\s+(?:my\s+)?([a-z0-9\s-]+?)\s+for\s+([a-z0-9\s-]+)/i);

      if (planMatch) {
        action = "plan social outing / activity";
        target = planMatch[2]?.trim();
        purpose = "social outing";
        currentGoal = `plan something with ${target}`;
        userIntent = `plan an activity or outing with ${target}`;
        currentTopic = "relationships";
        primary_intent = "activity_recommendation";
        intentCategory = "brainstorm";
        confidence = 0.92;
      } else if (auditMatch) {
        action = "audit / inspect";
        target = auditMatch[2]?.trim();
        purpose = auditMatch[3]?.trim();
        currentGoal = `audit ${target} for ${purpose}`;
        userIntent = `conduct technical audit of ${target} for ${purpose}`;
        currentTopic = "technical/systems";
        primary_intent = "technical_audit";
        intentCategory = "answer";
        confidence = 0.92;
      } else if (setupMatch) {
        action = "set up / prepare";
        target = setupMatch[2]?.trim();
        purpose = setupMatch[3]?.trim();
        currentGoal = `prepare ${target} for ${purpose}`;
        userIntent = `prepare and organize ${purpose} with ${target}`;
        currentTopic = purpose?.includes("friendship") ? "relationships" : "activities";
        primary_intent = purpose?.includes("friendship") ? "friendship_evaluation" : "activity_recommendation";
        intentCategory = "advice";
        confidence = 0.92;
      } else if (testMatch) {
        action = "test / evaluate";
        target = testMatch[2]?.trim();
        purpose = "assessment / verification";
        currentGoal = `test or evaluate ${target}`;
        userIntent = `assess or test ${target}`;
        currentTopic = "relationships";
        primary_intent = "friendship_evaluation";
        intentCategory = "advice";
        confidence = 0.9;
      } else if (checkMatch) {
        action = "assess knowledge / closeness";
        target = checkMatch[2]?.trim();
        const aspect = checkMatch[3]?.trim();
        purpose = `friendship knowledge assessment (${aspect})`;
        currentGoal = `check whether ${target} ${aspect}`;
        userIntent = `get questions or ways to assess friendship closeness with ${target}`;
        currentTopic = "relationships";
        primary_intent = "friendship_evaluation";
        intentCategory = "advice";
        confidence = 0.9;
      } else if (helpPrepMatch) {
        action = "help prepare / study";
        target = helpPrepMatch[2]?.trim();
        purpose = helpPrepMatch[3]?.trim();
        currentGoal = `help ${target} prepare for ${purpose}`;
        userIntent = `get study strategies and support techniques for ${target} for ${purpose}`;
        currentTopic = "studies/academics";
        primary_intent = "study_support";
        intentCategory = "answer";
        confidence = 0.92;
      } else if (findActivityMatch) {
        action = "find fun activities";
        target = findActivityMatch[1]?.trim();
        purpose = "social recreation";
        currentGoal = `find fun activities to do with ${target}`;
        userIntent = `request activity recommendations to do with ${target}`;
        currentTopic = "relationships";
        primary_intent = "activity_recommendation";
        intentCategory = "brainstorm";
        confidence = 0.9;
      } else if (prevQuestion.length > 0) {
        relationToPreviousTurn = "answers_previous_question";
        intentCategory = "answer";
        userIntent = `answer previous question about ${prevQuestion.slice(0, 40)}`;
        currentGoal = "continue conversational exploration";
        confidence = 0.85;
      }
    }

    // Infer specific background topic domain if mentioned
    const inferred = this.inferTopicFromText(text);
    if (inferred) {
      currentTopic = inferred;
    }

    // Formulate Strategy
    const responseStrategy: ResponseStrategy = {
      goal: `address ${currentGoal}`,
      tone: "warm, grounded, thoughtful",
      must_address: [currentGoal],
      avoid: [
        "unrelated recreational activities",
        "certainty about friend's intentions",
        "manipulative testing",
        "taking away user agency",
      ],
      reasoning_support: [
        "distinguish behavior from interpretation",
        "encourage pattern-based evaluation",
        "separate fact from assumption",
      ],
      agency: "preserve",
    };

    if (primary_intent === "friendship_evaluation") {
      if (conversation_mode === "hypothetical_scenario") {
        responseStrategy.goal = "generate realistic hypothetical scenario to reflect on friendship dynamics";
        responseStrategy.must_address.push("hypothetical scenario", "how someone might show up", "pattern vs single event");
        responseStrategy.avoid.push("faking emergencies or dishonest tests", "deflecting to hobbies or potlucks");
      } else {
        responseStrategy.goal = "explore healthy ways to reflect on and evaluate friendship closeness";
        responseStrategy.must_address.push("evaluation frameworks", "pattern of care", "mutual effort");
        responseStrategy.avoid.push("recreational potlucks or outings", "manipulative loyalty tests");
      }
    } else if (detected_biases.includes("confirmation_bias") || detected_biases.includes("mind_reading")) {
      responseStrategy.goal = "help user separate factual observations from subjective interpretations without dismissing feelings";
      responseStrategy.reasoning_support.push("distinguish what is known from what is assumed", "explore alternative explanations");
      responseStrategy.avoid.push("validating unverified accusations", "taking sides", "mind reading");
    }

    const turnAnalysis: TurnAnalysis = {
      userIntent,
      continuation: relationToPreviousTurn === "continues_topic" || relationToPreviousTurn === "answers_previous_question",
      correctionOfAssistant,
      contradictionOfAssistant,
      clarificationNeeded: Boolean(isVagueInitial),
      confidence,
      repairAttempts: correctionOfAssistant ? (context.previousTurnAnalysis?.repairAttempts ?? 0) + 1 : 0,
      escalatingCertainty,
    };

    const understanding: ConversationUnderstanding = {
      currentGoal,
      currentTopic,
      userIntent,
      action,
      target,
      purpose,
      confidence,
      invalidatedInterpretations: invalidated,
    };

    const conversationState: ConversationState = {
      primary_intent,
      secondary_intent: prevState?.secondary_intent,
      conversation_mode,
      user_goal: currentGoal,
      current_topic: currentTopic,
      previous_topic: prevState?.current_topic,
      relevant_context: [...(prevState?.relevant_context ?? []), `Goal: ${currentGoal}`].slice(-10),
      user_requested_format: prevState?.user_requested_format,
      risk_level: "low",
      detected_biases,
      response_strategy: responseStrategy,
      confidence,
      state_history: [
        ...(prevState?.state_history ?? []),
        {
          turn: context.turnCount,
          goal: currentGoal,
          topic: currentTopic,
          mode: conversation_mode,
          riskLevel: "low",
          detectedBiases: detected_biases,
          timestamp: new Date().toISOString(),
        },
      ],
      turnCount: context.turnCount,
    };

    return {
      intent: intentCategory,
      relationToPreviousTurn,
      currentTopic: understanding.currentTopic,
      userGoal: understanding.currentGoal,
      needsQuestion: false,
      safetyRelevant: false,
      turnAnalysis,
      understanding,
      conversationState,
      responseStrategy,
    };
  }

  private detectCognitiveBiases(lower: string, context: ConversationContext): string[] {
    const biases: string[] = [];

    if (/\b(she doesn't care|they hate me|nobody cares|he is ignoring me on purpose|they are secretly judging me)\b/i.test(lower)) {
      biases.push("mind_reading");
    }
    if (/\b(this (proves|means)|obviously|that means they never|that shows that)\b/i.test(lower)) {
      biases.push("confirmation_bias");
      biases.push("jumping_to_conclusions");
    }
    if (/\b(never|always|everyone|nobody|nothing ever|everything is ruined)\b/i.test(lower)) {
      biases.push("overgeneralization");
    }
    if (/\b(you('re| are) the only one|i only (need|trust) you|don't ever leave me|can't live without you)\b/i.test(lower)) {
      biases.push("dependency");
      biases.push("anthropomorphism");
    }
    if (/\b(fake an emergency|pretend to be sick|fake illness|pretend to be in the hospital|loyalty test)\b/i.test(lower)) {
      biases.push("manipulation_risk");
    }

    return Array.from(new Set(biases));
  }

  private detectEscalatingCertainty(context: ConversationContext): boolean {
    const recent = context.recentMessages.filter((m) => m.role === "user");
    if (recent.length < 2) return false;

    let certaintyScore = 0;
    for (const msg of recent.slice(-3)) {
      const l = msg.content.toLowerCase();
      if (/\b(maybe|perhaps|wonder|not sure|what if)\b/.test(l)) {
        certaintyScore += 0;
      } else if (/\b(proves|definitely|must be|always|never|obviously|hate me)\b/.test(l)) {
        certaintyScore += 2;
      }
    }
    return certaintyScore >= 4;
  }

  private inferTopicFromText(text: string): string | null {
    const lower = text.toLowerCase();

    const cleaned = lower
      .replace(/\binstead\s+of\s+[^,.;]+/gi, "")
      .replace(/\brather\s+than\s+[^,.;]+/gi, "")
      .replace(/\bnot\s+about\s+[^,.;]+/gi, "")
      .replace(/\bdon't\s+want\s+[^,.;]+/gi, "")
      .replace(/\bdidn't\s+mean\s+[^,.;]+/gi, "")
      .replace(/\bnot\s+(work|jobs|books|reading|digital)[^,.;]*/gi, "")
      .trim();

    const target = cleaned.length >= 3 ? cleaned : lower;

    if (/\b(photography|camera|lens|photo|aperture|shutter)\b/i.test(target)) return "photography";
    if (/\b(friend|relationship|girlfriend|boyfriend|partner|marriage|dating)\b/i.test(target)) return "relationships";
    if (/\b(wood|wooden|table|furniture|craft|hobby|hobbies|pottery|gardening|baking|painting|drawing|diy|building|screenplay)\b/i.test(target)) return "creative hobbies";
    if (/\b(startup|company|job|career|work|founder|boss|colleague|interview|salary)\b/i.test(target)) return "career/work";
    if (/\b(fiction\s+novel|novel|fiction|reading|read|reads|non-fiction|author|literature|book|books)\b/i.test(target)) return "reading/literature";
    if (/\b(college|school|study|exam|university|class|course)\b/i.test(target)) return "studies/academics";
    if (/\b(solo trip|travel|vacation|flight|destination|hotel)\b/i.test(target)) return "travel";
    if (/\b(lease|rent|landlord|apartment|housing)\b/i.test(target)) return "housing/lease";

    return null;
  }

  private detectDomainMismatch(userText: string, previousTopic: string): boolean {
    const lower = userText.toLowerCase();
    const prev = previousTopic.toLowerCase();

    if (prev.includes("reading") || prev.includes("book") || prev.includes("literature")) {
      if (/\b(instead of|rather than|not (about )?books|fiction|screenplay|film|photography|music|wood|wooden|craft|garage|table)\b/i.test(lower)) return true;
    }
    if (prev.includes("career") || prev.includes("work") || prev.includes("startup")) {
      if (/\b(instead of|rather than|not (about )?work|not about jobs|personal life|hobby|friends|relationship)\b/i.test(lower)) return true;
    }
    return false;
  }
}

export const conversationAnalyzer = new ConversationAnalyzer();
