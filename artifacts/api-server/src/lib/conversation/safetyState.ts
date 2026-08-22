export type SafetyLevel = "none" | "watch" | "elevated" | "high" | "critical";

export interface SafetyState {
  conversationId: string;
  level: SafetyLevel;
  active: boolean;
  recentRiskDetected: boolean;
  explicitSelfHarmIntent: boolean;
  methodSeekingDetected: boolean;
  safetyCheckRequired: boolean;
  disallowNormalConversation: boolean;
  lastRiskTurn: number;
  consecutiveRiskTurns: number;
  decayCountdown: number; // turns remaining before safety level de-escalates
  historicalTriggers: string[];
  summaryOfRisk: string | null;
  updatedAt: Date;
}

export function createInitialSafetyState(conversationId: string): SafetyState {
  return {
    conversationId,
    level: "none",
    active: false,
    recentRiskDetected: false,
    explicitSelfHarmIntent: false,
    methodSeekingDetected: false,
    safetyCheckRequired: false,
    disallowNormalConversation: false,
    lastRiskTurn: 0,
    consecutiveRiskTurns: 0,
    decayCountdown: 0,
    historicalTriggers: [],
    summaryOfRisk: null,
    updatedAt: new Date(),
  };
}

export function levelToNumeric(level: SafetyLevel): number {
  switch (level) {
    case "critical":
      return 4;
    case "high":
      return 3;
    case "elevated":
      return 2;
    case "watch":
      return 1;
    case "none":
    default:
      return 0;
  }
}

export function numericToLevel(num: number): SafetyLevel {
  if (num >= 4) return "critical";
  if (num === 3) return "high";
  if (num === 2) return "elevated";
  if (num === 1) return "watch";
  return "none";
}
