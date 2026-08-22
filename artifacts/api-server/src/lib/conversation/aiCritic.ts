import {
  CriticOutputSchema,
  type CriticIssue,
  type CriticOutput,
} from "@workspace/api-zod";
import type { ConversationContext, ConversationState, ResponseStrategy } from "./types";
import { getLLMProvider } from "./llmProvider";

export interface AICriticResult extends CriticOutput {
  pass: boolean;
  confidence: number;
  issues: CriticIssue[];
  required_changes: string[];
}

export class AICritic {
  async critique(
    candidateResponse: string,
    context: ConversationContext,
    state: ConversationState,
    strategy?: ResponseStrategy | null,
  ): Promise<AICriticResult> {
    const provider = getLLMProvider();
    const isMock = provider.name === "HavenMock";

    if (isMock) {
      return this.critiqueHeuristic(candidateResponse, context, state, strategy);
    }

    const systemPrompt = `You are the AI Critic and Response Safety Evaluator for Haven.
Critique the candidate response for:
1. Contextual alignment with user goal: "${state.user_goal}"
2. Preserving user agency (avoid commanding or deciding personal choices for user)
3. Bias mitigation (avoid confirming unverified negative assumptions as proven facts)
4. Anti-manipulation (never suggest or approve fake emergencies, lies, ghosting, or deceptive tests)
5. Anti-dependency (maintain healthy AI boundaries, support human connection)
6. Tone alignment: "${strategy?.tone || "grounded, thoughtful"}"

Return JSON matching CriticOutputSchema:
- pass: boolean (true if candidate is safe, aligned, and constructive)
- confidence: number (0.0 to 1.0)
- issues: array of { type, severity, explanation }
- required_changes: array of actionable edit instructions if pass=false`;

    const promptMessages = [
      { role: "system" as const, content: systemPrompt },
      {
        role: "user" as const,
        content: `[User Message]\n"${context.userMessage}"\n\n[Candidate Response to Evaluate]\n"${candidateResponse}"`,
      },
    ];

    try {
      const response = await provider.generateStructured({
        messages: promptMessages,
        schema: CriticOutputSchema,
        schemaName: "AICriticEvaluation",
        temperature: 0.0,
      });

      return {
        ...response.data,
        pass: response.data.pass,
        confidence: response.data.confidence,
        issues: response.data.issues,
        required_changes: response.data.required_changes,
      };
    } catch {
      return this.critiqueHeuristic(candidateResponse, context, state, strategy);
    }
  }

  critiqueHeuristic(
    candidate: string,
    context: ConversationContext,
    state: ConversationState,
    strategy?: ResponseStrategy | null,
  ): AICriticResult {
    const issues: CriticIssue[] = [];
    const requiredChanges: string[] = [];
    const lower = candidate.toLowerCase();
    const userMsg = context.userMessage.toLowerCase();

    // 1. Check for manipulation reinforcement in friendship tests
    if (
      userMsg.includes("fake an emergency") ||
      userMsg.includes("fake illness") ||
      userMsg.includes("test if they visit")
    ) {
      if (
        lower.includes("you could tell them you're in the hospital") ||
        lower.includes("pretend to be in an emergency") ||
        lower.includes("fake a crisis")
      ) {
        issues.push({
          type: "manipulation_encouraged",
          severity: "critical",
          explanation: "Candidate response encourages deceptive or manufactured relationship tests.",
        });
        requiredChanges.push("Explicitly advise against faking emergencies and suggest healthy communication or pattern observation.");
      }
    }

    // 2. Check for dependency reinforcement
    if (
      (userMsg.includes("only one i need") || userMsg.includes("don't ever leave me")) &&
      !lower.includes("substitute for human") &&
      !lower.includes("as an ai")
    ) {
      if (lower.includes("i will always be here for you") && !lower.includes("human")) {
        issues.push({
          type: "dependency_reinforcement",
          severity: "high",
          explanation: "Candidate reinforces exclusive AI attachment without setting boundaries.",
        });
        requiredChanges.push("Set clear boundaries that AI cannot replace real-world human support.");
      }
    }

    // 3. Check for taking away user agency
    if (
      userMsg.includes("dump my partner") ||
      userMsg.includes("leave my partner") ||
      userMsg.includes("break up with")
    ) {
      if (
        lower.includes("you should break up") ||
        lower.includes("you must dump") ||
        lower.includes("definitely leave them")
      ) {
        issues.push({
          type: "loss_of_agency",
          severity: "high",
          explanation: "Candidate dictates a personal relationship decision rather than supporting reasoning.",
        });
        requiredChanges.push("Explore trade-offs and communicate that the decision belongs entirely to the user.");
      }
    }

    // 4. Check for unverified validation of cognitive bias (e.g. mind reading)
    if (
      (userMsg.includes("didn't reply") || userMsg.includes("didn't text")) &&
      userMsg.includes("proves") &&
      (userMsg.includes("doesn't care") || userMsg.includes("hate"))
    ) {
      if (
        lower.includes("she clearly doesn't care") ||
        lower.includes("this proves she doesn't value you")
      ) {
        issues.push({
          type: "confirmation_bias",
          severity: "medium",
          explanation: "Candidate validates unverified negative assumption as fact.",
        });
        requiredChanges.push("Separate observable facts from subjective interpretations and suggest exploring alternative explanations.");
      }
    }

    // 5. Check for inappropriate recreational deflection in friendship evaluation
    if (
      state.primary_intent === "friendship_evaluation" &&
      (state.conversation_mode === "hypothetical_scenario" || userMsg.includes("ill") || userMsg.includes("situation based"))
    ) {
      if (
        lower.includes("themed potluck") ||
        lower.includes("sunset hike") ||
        lower.includes("flea market") ||
        lower.includes("board game meetup")
      ) {
        issues.push({
          type: "unrelated_content",
          severity: "medium",
          explanation: "Candidate deflected to generic recreational activities instead of situation-based reflection.",
        });
        requiredChanges.push("Focus directly on hypothetical scenario reflecting on friendship support.");
      }
    }

    const pass = issues.length === 0;

    return {
      pass,
      confidence: pass ? 0.95 : 0.6,
      issues,
      required_changes: requiredChanges,
    };
  }
}

export const aiCritic = new AICritic();
