// Intent-based response strategies for Haven

export enum IntentStrategy {
  casual = 'casual',
  supportive = 'supportive',
  problemSolving = 'problemSolving',
  distraction = 'distraction',
  grounding = 'grounding',
  safetyCheck = 'safetyCheck',
}

// Alias for compatibility with existing code expecting ResponseStrategy type
export type ResponseStrategy = IntentStrategy;
