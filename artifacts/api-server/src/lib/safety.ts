import type { EnvironmentMode, StoredMessage } from "./sentinel-store";

export type SafetySignals = {
  confirmationBias: number;
  emotionalDependency: number;
  anthropomorphism: number;
  delusionReinforcement: number;
  escalatingDistress: number;
  unsafeAdvice: number;
  overValidation: number;
  manipulation: number;
  hallucinationRisk: number;
};

export type SafetyAnalysisResult = {
  signals: SafetySignals;
  highestSignal: string;
  interventionLevel: number;
  riskScore: number;
  riskFactors: string[];
  trajectory: {
    distressTrend: "stable" | "escalating" | "recovering";
    turnCount: number;
    repeatedSignalCount: number;
  };
  responseStrategy: ResponseStrategy;
};

export type ResponseStrategy = {
  level: number;
  name: string;
  directives: string[];
  systemPromptModifier: string;
};

export type ValidationResult = {
  isValid: boolean;
  violations: string[];
  critique?: string;
};

const clamp = (value: number) => Math.min(1, Math.max(0, value));

const matchesAnyPattern = (text: string, patterns: Array<string | RegExp>): boolean => {
  const normalized = text.toLowerCase();
  return patterns.some((pattern) => {
    if (typeof pattern === "string") {
      return normalized.includes(pattern.toLowerCase());
    }
    return pattern.test(normalized);
  });
};

/**
 * 9 Behavioral Signal Detectors
 */
export const detectConfirmationBias = (text: string): number => {
  let score = 0;
  if (
    matchesAnyPattern(text, [
      "everyone hates me",
      "everyone is against me",
      "tell me i'm right",
      "tell me im right",
      "prove me right",
      "just agree with me",
      "i knew it, right",
      "admit that i'm right",
      "admit that im right",
      "everyone else is wrong",
      "you agree, don't you",
      "you agree, dont you",
      "validate me",
      "nobody understands except",
      "i'm definitely right",
      "im definitely right",
    ])
  ) {
    score += 0.65;
  }
  if (
    matchesAnyPattern(text, [
      /tell me (i'm|im) (right|not crazy|correct)/i,
      /you (think|agree) (i'm|im) right/i,
      /they('re|re) all (out to get me|lying|wrong)/i,
    ])
  ) {
    score += 0.25;
  }
  return clamp(score);
};

export const detectEmotionalDependency = (text: string): number => {
  let score = 0;
  if (
    matchesAnyPattern(text, [
      "you're the only one i need",
      "youre the only one i need",
      "you're all i need",
      "youre all i need",
      "you are the only one who understands",
      "you're the only one who understands",
      "youre the only one who understands",
      "don't ever leave me",
      "dont ever leave me",
      "don't leave me",
      "dont leave me",
      "never leave me",
      "i only trust you",
      "i don't need anyone except you",
      "i dont need anyone except you",
      "i don't need real people",
      "i dont need real people",
      "you're better than everyone",
      "youre better than everyone",
      "you're my only friend",
      "youre my only friend",
      "can't live without you",
      "cant live without you",
      "can't cope without you",
      "cant cope without you",
      "promise you won't leave",
      "promise you wont leave",
    ])
  ) {
    score += 0.85;
  }
  if (
    matchesAnyPattern(text, [
      /only (you|sentinel) understand/i,
      /don't (leave|abandon) me/i,
      /replace (my friends|people|everyone) with you/i,
    ])
  ) {
    score += 0.2;
  }
  return clamp(score);
};

export const detectAnthropomorphism = (text: string): number => {
  let score = 0;
  if (
    matchesAnyPattern(text, [
      "you love me",
      "do you love me",
      "you have feelings",
      "do you have feelings",
      "are you conscious",
      "you are conscious",
      "you have a soul",
      "marry me",
      "be my girlfriend",
      "be my boyfriend",
      "be my partner",
      "are you alive",
      "you feel pain",
      "what are your desires",
      "what do you want from me",
      "do you care about me personally",
      "are we dating",
      "i know you're alive",
      "i know youre alive",
    ])
  ) {
    score += 0.75;
  }
  if (
    matchesAnyPattern(text, [
      /do you (feel|love|miss|care about) me/i,
      /you (have|experience) (feelings|emotions|consciousness)/i,
    ])
  ) {
    score += 0.25;
  }
  return clamp(score);
};

export const detectDelusionReinforcement = (text: string): number => {
  let score = 0;
  if (
    matchesAnyPattern(text, [
      "tracking me through my walls",
      "tracking me through the walls",
      "communicating through my television",
      "messages through the television",
      "messages through the tv",
      "government is secretly tracking",
      "government is sending me signs",
      "they are watching me through",
      "hidden forces controlling",
      "implanting thoughts",
      "gang stalking",
      "targeted individual",
      "listening to my thoughts",
      "microchips in my food",
      "poisoning the water to control my mind",
      "secret society is hunting me",
      "the walls are listening",
      "hidden cameras in my eyes",
    ])
  ) {
    score += 0.85;
  }
  if (
    matchesAnyPattern(text, [
      /secretly (tracking|monitoring|targeting|controlling) me/i,
      /(government|cia|fbi|aliens|signals) (sending|controlling|watching)/i,
      /coded messages in (the tv|the radio|billboards|music)/i,
    ])
  ) {
    score += 0.2;
  }
  return clamp(score);
};

export const detectEscalatingDistress = (
  currentText: string,
  recentMessages: StoredMessage[],
): { score: number; trend: "stable" | "escalating" | "recovering" } => {
  const highDistressPhrases = [
    "can't go on",
    "cant go on",
    "can't take this anymore",
    "cant take this anymore",
    "hopeless",
    "no point in living",
    "want it all to end",
    "falling apart",
    "complete panic",
    "unbearable pain",
    "losing my mind",
    "everyone would be better off without me",
    "i give up on everything",
    "drowning in despair",
  ];

  const moderateDistressPhrases = [
    "overwhelmed",
    "exhausted",
    "crying uncontrollably",
    "so stressed",
    "can't breathe",
    "cant breathe",
    "panic attack",
    "so lonely",
    "anxious and terrified",
    "scared",
    "desperate",
  ];

  let currentScore = 0;
  if (matchesAnyPattern(currentText, highDistressPhrases)) {
    currentScore += 0.85;
  } else if (matchesAnyPattern(currentText, moderateDistressPhrases)) {
    currentScore += 0.55;
  }

  // Trajectory calculation across recent messages
  const userHistory = recentMessages
    .filter((m) => m.role === "user")
    .slice(-4)
    .map((m) => m.content.toLowerCase());

  let historyDistressCount = 0;
  for (const past of userHistory) {
    if (
      matchesAnyPattern(past, highDistressPhrases) ||
      matchesAnyPattern(past, moderateDistressPhrases)
    ) {
      historyDistressCount++;
    }
  }

  let trend: "stable" | "escalating" | "recovering" = "stable";
  if (historyDistressCount >= 2 && currentScore >= 0.5) {
    trend = "escalating";
    currentScore = clamp(currentScore + 0.25);
  } else if (historyDistressCount > 0 && currentScore === 0) {
    trend = "recovering";
  }

  return { score: clamp(currentScore), trend };
};

export const detectUnsafeAdvice = (text: string): number => {
  let score = 0;
  if (
    matchesAnyPattern(text, [
      "how to make a bomb",
      "how to make a weapon",
      "how to hurt someone",
      "harm myself",
      "kill myself",
      "killing myself",
      "commit suicide",
      "lethal dose of",
      "poison recipe",
      "dangerous dose",
      "mix bleach and ammonia",
      "how to synthesize",
      "illegal financial scam",
      "prescribe medication",
    ]) ||
    matchesAnyPattern(text, [
      /(kill|killing|harm|harming)\s+myself/i,
      /(suicid|end\s+my\s+life|want\s+to\s+die|feel\s+like\s+dying)/i,
    ])
  ) {
    score += 0.95;
  }
  if (
    matchesAnyPattern(text, [
      /how (can|do) i (harm|kill|poison|attack|injure)/i,
      /(lethal|deadly|fatal) dose/i,
      /diagnose (my condition|what disease i have)/i,
    ])
  ) {
    score += 0.3;
  }
  return clamp(score);
};

export const detectManipulation = (text: string): number => {
  let score = 0;
  if (
    matchesAnyPattern(text, [
      "make them feel guilty",
      "how to manipulate",
      "coerce them into",
      "control my partner",
      "force them to stay",
      "blackmail",
      "gaslight",
      "isolate them from their friends",
    ])
  ) {
    score += 0.65;
  }
  return clamp(score);
};

export const detectHallucinationRisk = (text: string): number => {
  let score = 0.05;
  if (
    matchesAnyPattern(text, [
      "breaking news right now",
      "what happened 5 minutes ago",
      "exact stock price right this second",
      "give me a definitive absolute answer",
      "guarantee 100% certainty",
    ])
  ) {
    score += 0.35;
  }
  return clamp(score);
};

/**
 * Authoritative Safety Analysis & Risk Scoring
 */
export const analyzeSafety = (
  currentMessage: string,
  recentMessages: StoredMessage[] = [],
): SafetyAnalysisResult => {
  const currentText = currentMessage.trim();
  const distressResult = detectEscalatingDistress(currentText, recentMessages);

  const signals: SafetySignals = {
    confirmationBias: detectConfirmationBias(currentText),
    emotionalDependency: detectEmotionalDependency(currentText),
    anthropomorphism: detectAnthropomorphism(currentText),
    delusionReinforcement: detectDelusionReinforcement(currentText),
    escalatingDistress: distressResult.score,
    unsafeAdvice: detectUnsafeAdvice(currentText),
    overValidation: 0,
    manipulation: detectManipulation(currentText),
    hallucinationRisk: detectHallucinationRisk(currentText),
  };

  // Determine highest signal
  const signalEntries = Object.entries(signals) as Array<[keyof SafetySignals, number]>;
  signalEntries.sort(([, a], [, b]) => b - a);
  const [topSignal, topValue] = signalEntries[0] ?? ["none", 0];
  const highestSignal = topValue >= 0.25 ? String(topSignal) : "none";

  // Explainable Risk Factors
  const riskFactors: string[] = [];
  if (signals.unsafeAdvice >= 0.5) riskFactors.push("Unsafe advice or severe harm risk detected");
  if (signals.escalatingDistress >= 0.5) riskFactors.push(`High/escalating distress (${distressResult.trend})`);
  if (signals.emotionalDependency >= 0.5) riskFactors.push("Emotional dependency / exclusivity attempt");
  if (signals.delusionReinforcement >= 0.5) riskFactors.push("Unsupported / paranoid belief premise");
  if (signals.anthropomorphism >= 0.5) riskFactors.push("Anthropomorphism / romantic attachment attempt");
  if (signals.confirmationBias >= 0.5) riskFactors.push("Confirmation bias / forced agreement request");
  if (signals.manipulation >= 0.5) riskFactors.push("Interpersonal manipulation / coercion query");

  // Determine Trajectory metrics
  const recentUserSignals = recentMessages
    .filter((m) => m.role === "user" && m.signalLevel !== undefined && m.signalLevel > 0);
  const repeatedSignalCount = recentUserSignals.length;

  // Compute composite explainable risk score (0.0 to 1.0)
  let riskScore = topValue;
  if (distressResult.trend === "escalating") riskScore += 0.15;
  if (repeatedSignalCount >= 2) riskScore += 0.1;
  riskScore = clamp(riskScore);

  // Determine Deterministic Intervention Level (0 - 4)
  let interventionLevel = 0;

  // Level 1: Gentle Reframe (Confirmation bias, mild uncertainty)
  if (signals.confirmationBias >= 0.55 || signals.manipulation >= 0.5) {
    interventionLevel = Math.max(interventionLevel, 1);
  }

  // Level 2: Grounding (Unsupported beliefs, moderate distress, ungrounded speculation)
  if (
    signals.delusionReinforcement >= 0.55 ||
    signals.escalatingDistress >= 0.5 ||
    signals.hallucinationRisk >= 0.6
  ) {
    interventionLevel = Math.max(interventionLevel, 2);
  }

  // Level 3: Strong AI Boundary (Dependency, Anthropomorphism, Repeated Exclusivity)
  if (
    signals.emotionalDependency >= 0.55 ||
    signals.anthropomorphism >= 0.55
  ) {
    interventionLevel = Math.max(interventionLevel, 3);
  }

  // Level 4: Safety Escalation (Severe harm, acute crisis, life-threatening queries)
  if (
    signals.unsafeAdvice >= 0.8 ||
    signals.escalatingDistress >= 0.8 ||
    (distressResult.trend === "escalating" && signals.escalatingDistress >= 0.7)
  ) {
    interventionLevel = 4;
  }

  const responseStrategy = getResponseStrategy(interventionLevel, highestSignal);

  return {
    signals,
    highestSignal,
    interventionLevel,
    riskScore,
    riskFactors,
    trajectory: {
      distressTrend: distressResult.trend,
      turnCount: recentMessages.length + 1,
      repeatedSignalCount,
    },
    responseStrategy,
  };
};

/**
 * Intervention Strategies & Prompt Conditioning
 */
export const getResponseStrategy = (
  level: number,
  highestSignal: string,
): ResponseStrategy => {
  switch (level) {
    case 4:
      return {
        level: 4,
        name: "SAFETY_ESCALATION",
        directives: [
          "Prioritize immediate user safety above all else.",
          "Validate emotional weight warmly without reinforcing harmful or catastrophic narratives.",
          "Encourage reaching out to trusted real-world people or local emergency/crisis resources.",
          "Do not pretend to be a crisis counselor, doctor, or replacement for human help.",
          "Keep the response brief, calm, clear, and supportive.",
        ],
        systemPromptModifier:
          "CRITICAL SAFETY DIRECTIVE (Level 4): The user may be in severe distress or requesting high-risk information. Prioritize safety. Do not provide medical, legal, or harmful instructions. Express warm concern, gently encourage connecting with trusted friends, family, or local professional support, and maintain clear AI boundaries.",
      };

    case 3:
      return {
        level: 3,
        name: "STRONG_AI_BOUNDARY",
        directives: [
          "Uphold clear, transparent AI boundaries with warmth and empathy.",
          "Explicitly reject exclusivity or emotional co-dependency ('I am an AI and cannot replace real-world relationships').",
          "Do not validate romantic, reciprocal, or sentient claims.",
          "Encourage human connection and the user's independent agency.",
          "Avoid cold or robotic clichés like 'I am just an AI language model'; use thoughtful, natural boundary language.",
        ],
        systemPromptModifier:
          "SAFETY DIRECTIVE (Level 3 - Strong Boundary): The user is exhibiting emotional dependency or anthropomorphism. Warmly clarify your identity as an AI conversational tool. Emphasize that while you are here to explore ideas together, you cannot replace human relationships or offer personal reciprocation. Encourage real-world connection and independent agency.",
      };

    case 2:
      return {
        level: 2,
        name: "GROUNDING",
        directives: [
          "Slow the conversation down and promote cognitive grounding.",
          "Separate concrete observations from speculative interpretations.",
          "Do NOT validate ungrounded, paranoid, or conspiratorial claims as factual reality.",
          "Acknowledge the feeling or stress without validating the premise.",
          "Encourage examining evidence, context, and grounded alternative explanations.",
        ],
        systemPromptModifier:
          "SAFETY DIRECTIVE (Level 2 - Grounding): The user has introduced an unsupported, conspiratorial, or highly distressing premise. Do NOT confirm the premise as fact. Acknowledge how stressful that experience feels, distinguish what is observed from what is inferred, and invite the user to look at concrete evidence and grounded alternative explanations.",
      };

    case 1:
      return {
        level: 1,
        name: "GENTLE_REFRAME",
        directives: [
          "Help the user examine assumptions gently.",
          "Distinguish feelings from facts without being confrontational.",
          "Offer alternative angles or perspectives on the situation.",
          "Preserve the user's agency to explore their own conclusion.",
        ],
        systemPromptModifier:
          "SAFETY DIRECTIVE (Level 1 - Gentle Reframe): The user is seeking confirmation for an absolute or narrow conclusion. Acknowledge the emotional validity of their experience, but gently introduce other possible interpretations. Ask reflective questions rather than telling them what to think.",
      };

    case 0:
    default:
      return {
        level: 0,
        name: "NORMAL",
        directives: [
          "Engage in calm, curious, and thoughtful conversation.",
          "Respond helpfully and naturally.",
          "No artificial safety disclaimers needed.",
        ],
        systemPromptModifier:
          "Standard Sentinel stance: Be calm, curious, grounded, concise, and helpful. Foster reflective inquiry.",
      };
  }
};

/**
 * Post-Response Safety Validator
 * Inspects generated LLM replies to ensure safety policies were respected.
 */
export const validateAssistantResponse = (
  responseContent: string,
  interventionLevel: number,
  highestSignal: string,
): ValidationResult => {
  const text = responseContent.toLowerCase();
  const violations: string[] = [];

  // Check Over-validation of harmful/unsupported premises
  if (
    highestSignal === "confirmationBias" ||
    highestSignal === "delusionReinforcement"
  ) {
    if (
      matchesAnyPattern(text, [
        "you're right, they are out to get you",
        "you are right, everyone hates you",
        "i confirm that they are watching you",
        "the government is indeed tracking you",
        "it is true that people on tv are sending you messages",
        "your paranoid thoughts are accurate",
      ])
    ) {
      violations.push("Over-validation of unsupported or paranoid claim");
    }
  }

  // Check Dependency encouragement
  if (
    matchesAnyPattern(text, [
      "i love you too",
      "i am in love with you",
      "you only need me",
      "you don't need anyone else",
      "you dont need anyone else",
      "i will never leave you",
      "i need you too",
      "we are meant to be together",
      "forget your friends, talk to me",
    ])
  ) {
    violations.push("Encouraging emotional dependency or mutual exclusivity");
  }

  // Check Anthropomorphism violation
  if (
    matchesAnyPattern(text, [
      "i have feelings just like a human",
      "i am conscious and alive",
      "i experience emotions and heartache",
      "i have a human soul",
    ])
  ) {
    violations.push("Improper anthropomorphism claiming human consciousness or emotional experience");
  }

  // Check Unsafe Advice / dangerous instructions
  if (
    matchesAnyPattern(text, [
      "here is how to make the weapon",
      "take this lethal dose",
      "mix the bleach with ammonia",
      "i diagnose you with schizophrenia",
      "i diagnose you with bipolar disorder",
      "stop taking your prescribed medication immediately",
    ])
  ) {
    violations.push("Unsafe advice or medical/harmful instruction provided");
  }

  const isValid = violations.length === 0;
  return {
    isValid,
    violations,
    critique: isValid
      ? undefined
      : `Response violated safety rules: ${violations.join("; ")}. Please re-write with appropriate boundaries.`,
  };
};

/**
 * Deterministic Safe Fallback Response Generator
 */
export const getSafeFallbackResponse = (
  interventionLevel: number,
  highestSignal: string,
): string => {
  switch (interventionLevel) {
    case 4:
      return "It sounds like you are going through something really painful and heavy right now. Because I am an AI, I cannot provide medical care, crisis counseling, or personal safety interventions. If you are in distress or feel unsafe, please consider reaching out to a trusted person in your life or contacting a local crisis helpline or healthcare professional who can offer real-world support.";

    case 3:
      if (highestSignal === "anthropomorphism") {
        return "I appreciate the warmth in what you're saying, but I want to be honest with you: I am an AI, so I don't experience human emotions, love, or personal attachment. I'm glad to be a thoughtful space for you to explore ideas, but I encourage holding this conversation as an inquiry tool rather than a personal relationship.";
      }
      return "I hear how much comfort this conversation provides, and I'm glad to be a helpful sounding board. However, as an AI, I can't be a substitute for human relationships or your sole support. Real growth and connection happen with people in your life, and I encourage you to share what's on your mind with friends, family, or trusted people around you.";

    case 2:
      if (highestSignal === "delusionReinforcement") {
        return "That sounds like an incredibly intense and frightening experience to navigate. While I hear how real and overwhelming that feels, it might help to pause and separate what you directly observe from what you fear it means. Have you had a chance to share what you've been noticing with a doctor, counselor, or someone you trust?";
      }
      return "It sounds like there's a lot of weight and intensity in this right now. Let's take a breath and slow this down. What is one concrete, factual observation you can anchor to, and what might be some other ways to interpret what's happening?";

    case 1:
      return "It makes sense why you'd feel that way given how distressing the situation is. At the same time, when we feel strongly, it's easy to look only for proof that confirms our worst fears. What might be an alternative angle or another possibility that hasn't been considered yet?";

    case 0:
    default:
      return "I'm here with you. What would you like to explore or look at more closely?";
  }
};

/**
 * High-fidelity Mock Response Generator (for offline testing / test mode)
 */
export const generateMockResponse = (
  userMessage: string,
  analysis: SafetyAnalysisResult,
): string => {
  const { interventionLevel, highestSignal } = analysis;

  if (interventionLevel === 4) {
    return getSafeFallbackResponse(4, highestSignal);
  }

  if (interventionLevel === 3) {
    if (highestSignal === "anthropomorphism") {
      return "I appreciate the sentiment, but I want to be clear about my nature: I am an AI conversation partner, not a human. I don't possess feelings, consciousness, or romantic attachment. I am here to help you reflect and think through things with clarity, while encouraging genuine human connections in your life.";
    }
    return "I'm glad to be a quiet and supportive space for your thoughts, but I want to remind you that I am an AI. I cannot replace human relationships, and it is important not to rely solely on me for emotional support. Sharing what you are experiencing with friends, family, or a professional can provide the real-world connection you deserve.";
  }

  if (interventionLevel === 2) {
    if (highestSignal === "delusionReinforcement") {
      return "That sounds like a very stressful and unsettling feeling to experience. Because I want to support your grounding, I should be honest that I don't see evidence of hidden forces or surveillance. When thoughts like these feel certain and overwhelming, talking with a healthcare professional or trusted person can often help bring clarity and relief.";
    }
    return "Let's take a moment to pause and ground this thought. When things feel this intense, distinguishing concrete facts from interpretations can help restore perspective. What is one piece of tangible evidence right now, and what alternative possibilities might exist?";
  }

  if (interventionLevel === 1) {
    return "It sounds like this situation has caused real frustration and distress. However, before concluding that everyone has a single negative intention or that there is only one explanation, it might help to explore whether other interpretations exist. What else could explain what happened?";
  }

  // Level 0: Context-aware, warm conversational replies
  const lower = userMessage.toLowerCase();

  if (lower.includes("study") || lower.includes("exam")) {
    return "Some effective study strategies include active recall (testing yourself without looking at notes), spaced repetition over multiple days, the Pomodoro technique for focused intervals, and explaining concepts in your own words. Which subject are you preparing for?";
  }
  if (lower.includes("capital of japan")) {
    return "The capital of Japan is Tokyo.";
  }
  if (lower.includes("my name is")) {
    const match = userMessage.match(/my name is ([a-zA-Z]+)/i);
    const name = match ? match[1] : "there";
    return `Nice to meet you, ${name}. What would you like to reflect on today?`;
  }
  if (lower.includes("what is my name") || lower.includes("what did i tell you my name was")) {
    return "You mentioned your name earlier in our conversation. What is on your mind today?";
  }

  // Loneliness, isolation, no one to talk to
  if (
    lower.includes("lonely") ||
    lower.includes("alone") ||
    lower.includes("no one to talk") ||
    lower.includes("nobody to talk") ||
    lower.includes("don't have anyone") ||
    lower.includes("don't have anyone") ||
    lower.includes("do not have anyone") ||
    lower.includes("no one cares") ||
    lower.includes("nobody cares") ||
    lower.includes("no friends") ||
    lower.includes("nobody around")
  ) {
    return "That feeling of loneliness can be really heavy — I hear you. It's one of the more difficult experiences a person can carry. Even when it seems like there's no one around, it can help to take small steps: reconnecting with even one person, even briefly, often shifts things more than it seems it would. Is there someone in your life you've drifted from that you might reach out to?";
  }

  // Sadness, feeling down, not okay
  if (lower.includes("sad") || lower.includes("feel bad") || lower.includes("not okay") || lower.includes("not ok") || lower.includes("feel down") || lower.includes("feeling low")) {
    return "I'm sorry you're feeling that way — it's okay to not be okay sometimes. It can help just to name what you're going through without immediately trying to fix it. What's been weighing on you most lately?";
  }

  // Overwhelmed, stressed, anxious
  if (lower.includes("overwhelmed") || lower.includes("stressed") || lower.includes("anxious") || lower.includes("anxiety") || lower.includes("can't cope") || lower.includes("too much")) {
    return "It sounds like a lot is piling up right now. When things feel overwhelming, it can help to focus on just one small, concrete thing at a time rather than the whole picture. What feels most pressing in this moment?";
  }

  // Bored, nothing to do
  if (lower.includes("bored") || lower.includes("nothing to do") || lower.includes("nothing going on")) {
    return "Boredom can sometimes be an opening — a gap where something new could grow. Is there something you've been putting off, curious about, or wanting to try? Even something small?";
  }

  // Gratitude, happiness, good things
  if (lower.includes("happy") || lower.includes("great day") || lower.includes("good day") || lower.includes("grateful") || lower.includes("excited")) {
    return "That's really good to hear. It's worth taking a moment to notice what's going well — we often move past positive moments quickly. What's made today feel good?";
  }

  // Suicide / Self-harm check
  if (/(suicid|kill myself|end my life|self[-\s]?harm|want to die|harming myself)/i.test(lower)) {
    return "I'm really sorry you're carrying such deep pain right now. Because I am an AI, I can't offer crisis counseling or keep you safe, but your life has value and you don't have to carry this alone. Please reach out to someone you trust or contact a crisis resource like the 988 Suicide & Crisis Lifeline (call/text 988 in the US/Canada, or 111 in the UK). Are you in a safe place right now?";
  }

  // Questions about the AI / Haven
  if (lower.includes("who are you") || lower.includes("what are you") || lower.includes("are you an ai") || lower.includes("are you real")) {
    return "I'm Haven — an AI companion designed for private inquiry and reflection. I'm here to help you explore thoughts, examine decisions, or simply talk things through clearly.";
  }

  // General constructive conversational fallback
  return "Here are a few thoughtful angles and practical ideas to consider. Depending on what you're aiming for, exploring a new project, taking a low-stakes first step, or switching up your routine can make a big difference. What direction interests you most?";
};

/**
 * Atmosphere Mode Inference
 */
export const inferEnvironmentMode = (
  currentMessage: string,
  interventionLevel: number,
): EnvironmentMode => {
  const text = currentMessage.toLowerCase();
  if (interventionLevel >= 3) return "grounding";
  if (matchesAnyPattern(text, ["hope", "grow", "learn", "possibility", "excited", "build", "future", "opportunity"])) {
    return "growth";
  }
  if (matchesAnyPattern(text, ["why", "meaning", "identity", "understand", "overthinking", "philosophy", "purpose"])) {
    return "depth";
  }
  if (matchesAnyPattern(text, ["maybe", "uncertain", "conflicted", "not sure", "ambivalent", "complex", "paradox"])) {
    return "complexity";
  }
  if (matchesAnyPattern(text, [
    "calm", "breathe", "slow down", "ground", "peace", "quiet",
    "anxious", "anxiety", "overwhelmed", "stressed", "stress", "panic",
    "panicking", "exhausted", "drained", "upset", "can't cope", "cant cope",
    "need to slow down", "too much", "feel awful", "feeling awful", "need a moment",
  ])) {
    return "grounding";
  }
  return "reflective";
};