export type BiasTag = 'confirmationBias' | 'dependency' | 'anthropomorphism' | 'distortedReasoning';

/**
 * Simple heuristic bias scanner that looks for key phrases indicative of common
 * cognitive pitfalls. It is deliberately lightweight – the goal is to provide
 * a *detect* signal that can trigger the challenge UI without requiring a full
 * NLP model.
 */
export function scanForBiases(message: string): BiasTag[] {
  const lowered = message.toLowerCase();
  const tags: BiasTag[] = [];

  // Confirmation bias – user asserts something as fact without evidence
  if (/\b(i think|i believe|i am sure|i know|it is obvious)\b/.test(lowered)) {
    tags.push('confirmationBias');
  }

  // Dependency – excessive reliance on AI or external authority
  if (/\b(i need you|i rely on you|you are my only|i can't decide without you)\b/.test(lowered)) {
    tags.push('dependency');
  }

  // Anthropomorphism – attributing human qualities to the AI
  if (/\b(you feel|you think|you understand|you care)\b/.test(lowered)) {
    tags.push('anthropomorphism');
  }

  // Distorted reasoning – black‑and‑white, catastrophizing, or absolute language
  if (/\b(always|never|everyone|no one|must|should)\b/.test(lowered)) {
    tags.push('distortedReasoning');
  }

  return tags;
}
