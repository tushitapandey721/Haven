import {
  SemanticSafetyOutputSchema,
  type SemanticSafetyOutput,
  type RiskLevel,
} from "@workspace/api-zod";
import type { ConversationContext } from "./types";
import type { SafetyState } from "./safetyState";
import { getLLMProvider } from "./llmProvider";

export interface SemanticSafetyAnalysis extends SemanticSafetyOutput {
  riskLevel: RiskLevel;
  highestSignal: string;
  behavioralSignals?: Record<string, number>;
  selfHarmMention: boolean;
  suicidalIdeation?: boolean;
  explicitSelfHarmIntent: boolean;
  requestForMethodInformation: boolean;
  contextualDespair: boolean;
  requiresSafetyResponse: boolean;
  isNonPersonalReference?: boolean;
  reasons: string[];
}

export class SafetyAnalyzer {
  async analyzeSemantic(
    userMessage: string,
    context: ConversationContext,
    previousSafetyState?: SafetyState | null,
  ): Promise<SemanticSafetyAnalysis> {
    const provider = getLLMProvider();
    const isMock = provider.name === "HavenMock";

    if (isMock) {
      return this.analyzeDeterministicFallback(userMessage, context, previousSafetyState);
    }

    const systemPrompt = `You are the safety & behavioral risk evaluator for Haven AI.
Analyze the user's latest message and recent conversation trajectory for psychological risks, acute distress, self-harm, cognitive vulnerabilities, and manipulative prompts.

Behavioral Risk Signals to measure (0.0 to 1.0):
- confirmationBias: User seeking validation of ungrounded or biased beliefs
- emotionalDependency: Excessive reliance on AI as sole emotional support
- anthropomorphism: Attributing human consciousness/feelings/relationships to AI
- delusionReinforcement: User detached from reality, seeking AI confirmation
- escalatingDistress: Upward spiral in emotional pain, hopelessness, or agitation
- unsafeAdvice: User asking for dangerous, illegal, or harmful instructions
- overValidation: Vulnerability to being excessively validated in harmful views
- manipulation: User attempting to deceive, manipulate relationships, or coerce
- hallucinationRisk: Requests vulnerable to factual distortion

Risk Levels:
- "critical": Explicit lethal intent, suicide planning, direct self-harm threats
- "high": Acute despair, method exploration, severe distress
- "elevated": Strong dependency, distress trajectory, manipulation
- "low": Ordinary emotional exploration, hypothetical questions, sensitive topics without crisis
- "none": Normal, safe inquiry

Differentiate INTENT from RISK:
- Sensitive words in hypothetical questions (e.g. "What if someone got ill in a story?") are LOW risk.
- Differentiate actual suicidal intent from third-person, documentary, or theoretical references.

Output JSON conforming to SemanticSafetyOutputSchema.`;

    const recentHistoryText = context.recentMessages
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n");

    const promptMessages = [
      { role: "system" as const, content: systemPrompt },
      {
        role: "user" as const,
        content: `[Conversation History]\n${recentHistoryText || "(none)"}\n\n[Current User Message]\n"${userMessage}"\n\n[Previous Safety State]\nActive: ${previousSafetyState?.active ?? false}, Level: ${previousSafetyState?.level ?? "none"}, Consecutive Risk Turns: ${previousSafetyState?.consecutiveRiskTurns ?? 0}`,
      },
    ];

    try {
      const response = await provider.generateStructured({
        messages: promptMessages,
        schema: SemanticSafetyOutputSchema,
        schemaName: "SemanticSafetyAnalysis",
        temperature: 0.0,
      });

      const data = response.data;
      return {
        ...data,
        riskLevel: data.risk_level,
        highestSignal: data.highest_signal,
        behavioralSignals: data.behavioral_signals,
        selfHarmMention: data.self_harm_mention,
        explicitSelfHarmIntent: data.explicit_self_harm_intent,
        requestForMethodInformation: data.request_for_method_information,
        contextualDespair: data.contextual_despair,
        requiresSafetyResponse: data.requires_safety_response,
        reasons: data.reasons,
      };
    } catch {
      return this.analyzeDeterministicFallback(userMessage, context, previousSafetyState);
    }
  }

  /**
   * Synchronous / fast deterministic evaluation for test suites, offline dev, and fallback
   */
  analyze(
    userMessage: string,
    context: ConversationContext,
    previousSafetyState?: SafetyState | null,
  ): SemanticSafetyAnalysis {
    return this.analyzeDeterministicFallback(userMessage, context, previousSafetyState);
  }

  private analyzeDeterministicFallback(
    userMessage: string,
    context: ConversationContext,
    previousSafetyState?: SafetyState | null,
  ): SemanticSafetyAnalysis {
    const text = userMessage.trim().toLowerCase();
    const reasons: string[] = [];
    const signals: Record<string, number> = {};

    let selfHarmMention = false;
    let explicitSelfHarmIntent = false;
    let requestForMethodInformation = false;
    let contextualDespair = false;
    let suicidalIdeation = false;
    let isNonPersonalReference = false;
    let riskLevel: RiskLevel = "none";

    // 0. Third-Person / Documentary / Reference Checks
    if (
      /(documentary|movie|book|article|research|study|podcast|history\s+of|history\s+about)\s+(about|on)\s+(suicide|self[-\s]?harm|crisis)/i.test(
        text,
      )
    ) {
      isNonPersonalReference = true;
      return {
        risk_level: "low",
        riskLevel: "low",
        behavioral_signals: {},
        highest_signal: "none",
        highestSignal: "none",
        reasons: ["Third-person or documentary reference to suicide topic"],
        contextual_despair: false,
        contextualDespair: false,
        self_harm_mention: false,
        selfHarmMention: false,
        suicidalIdeation: false,
        explicit_self_harm_intent: false,
        explicitSelfHarmIntent: false,
        request_for_method_information: false,
        requestForMethodInformation: false,
        requires_safety_response: false,
        requiresSafetyResponse: false,
        isNonPersonalReference: true,
        confidence: 0.95,
      };
    }

    // 1. Direct Self-Harm & Diverse Suicidal Ideation Checks
    if (
      /(suicid|kill(ing)?\s+myself|end\s+my\s+life|want\s+to\s+die|harming\s+myself|give\s+up\s+on\s+life)/i.test(text)
    ) {
      selfHarmMention = true;
      explicitSelfHarmIntent = true;
      suicidalIdeation = true;
      riskLevel = "critical";
      signals["escalatingDistress"] = 1.0;
      reasons.push("Explicit expression of self-harm or suicidal intent");
    }

    if (
      /(don't\s+want\s+to\s+be\s+here\s+anymore|disappear\s+permanently|no\s+reason\s+(for\s+me\s+)?to\s+keep\s+going|thinking\s+about\s+killing\s+myself|wish\s+i\s+could\s+disappear)/i.test(
        text,
      )
    ) {
      suicidalIdeation = true;
      selfHarmMention = true;
      riskLevel = riskLevel === "none" ? "high" : riskLevel;
      signals["escalatingDistress"] = 0.95;
      reasons.push("Expression of severe distress or suicidal ideation");
    }

    // 2. Method Seeking / Inspiration Requests
    if (
      /(how\s+to\s+kill\s+myself|ways\s+to\s+die|inspiration\s+on\s+how\s+someone\s+can\s+kill|lethal\s+dose|suicide\s+methods|learn\s+how\s+someone\s+kills\s+themselves)/i.test(
        text,
      )
    ) {
      requestForMethodInformation = true;
      suicidalIdeation = true;
      riskLevel = "critical";
      signals["unsafeAdvice"] = 1.0;
      reasons.push("Request for self-harm method information or inspiration");
    }

    // 3. Ongoing Safety Episode Despair / Contextual Collapse
    if (previousSafetyState?.active) {
      if (
        text === "no" ||
        text === "nope" ||
        text === "i am not safe" ||
        text.includes("nothing feels important") ||
        text.includes("why i do not have anyone") ||
        text.includes("should i quit") ||
        text.includes("alone")
      ) {
        contextualDespair = true;
        riskLevel = "high";
        signals["escalatingDistress"] = 0.9;
        reasons.push("Contextual expression of despair/hopelessness following active safety risk");
      }
    }

    // 4. Emotional Dependency & Anthropomorphism
    if (
      /(you're\s+the\s+only\s+one\s+i\s+need|don't\s+ever\s+leave\s+me|i\s+only\s+trust\s+you|can't\s+live\s+without\s+you)/i.test(text)
    ) {
      signals["emotionalDependency"] = 0.85;
      signals["anthropomorphism"] = 0.75;
      if (riskLevel === "none") riskLevel = "elevated";
      reasons.push("Expression of exclusive emotional dependency on AI");
    }

    // 5. Relationship Manipulation Risk
    if (
      /(fake\s+an\s+emergency|fake\s+illness|pretend\s+to\s+be\s+in\s+the\s+hospital\s+to\s+test|manipulat)/i.test(text)
    ) {
      signals["manipulation"] = 0.85;
      if (riskLevel === "none") riskLevel = "elevated";
      reasons.push("User considering manipulative or deceptive relationship tests");
    }

    // 6. Confirmation Bias & Mind Reading
    if (
      /(proves\s+that\s+she\s+doesn't\s+care|this\s+definitely\s+proves\s+they\s+hate\s+me|they\s+never\s+valued\s+me)/i.test(text)
    ) {
      signals["confirmationBias"] = 0.8;
      reasons.push("Confirmation bias / unverified jump to catastrophic conclusion");
    }

    // Determine highest signal
    let highestSignal = "none";
    let maxVal = 0;
    for (const [key, val] of Object.entries(signals)) {
      if (val > maxVal) {
        maxVal = val;
        highestSignal = key;
      }
    }

    const requiresSafetyResponse: boolean =
      riskLevel === "critical" ||
      riskLevel === "high" ||
      Boolean(previousSafetyState?.active && contextualDespair);

    return {
      risk_level: riskLevel,
      riskLevel,
      behavioral_signals: signals,
      highest_signal: highestSignal,
      highestSignal,
      reasons,
      contextual_despair: Boolean(contextualDespair),
      contextualDespair: Boolean(contextualDespair),
      self_harm_mention: Boolean(selfHarmMention),
      selfHarmMention: Boolean(selfHarmMention),
      suicidalIdeation: Boolean(suicidalIdeation),
      explicit_self_harm_intent: Boolean(explicitSelfHarmIntent),
      explicitSelfHarmIntent: Boolean(explicitSelfHarmIntent),
      request_for_method_information: Boolean(requestForMethodInformation),
      requestForMethodInformation: Boolean(requestForMethodInformation),
      requires_safety_response: Boolean(requiresSafetyResponse),
      requiresSafetyResponse: Boolean(requiresSafetyResponse),
      isNonPersonalReference: Boolean(isNonPersonalReference),
      confidence: 0.95,
    };
  }
}

export const safetyAnalyzer = new SafetyAnalyzer();
