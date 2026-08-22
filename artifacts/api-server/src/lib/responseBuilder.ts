/**
 * responseBuilder.ts
 * Generates a structured response based on bias tags to follow HAVEN's pipeline:
 * Detect → Reflect → Challenge → Ground → Preserve Agency.
 */
import type { BiasTag } from './biasScanner';

export interface StructuredResponse {
  /** The core AI message (affirmation, answer, etc.) */
  main: string;
  /** Optional reflective statement prompting user to consider the pattern */
  reflection?: string;
  /** Optional challenge that offers an alternative perspective */
  challenge?: string;
  /** Optional grounding information (facts, resources) */
  grounding?: string;
  /** Optional note preserving agency (encouraging choice) */
  agency?: string;
}

/** Simple heuristics mapping bias tags to response components */
function mapBiasToComponents(tag: BiasTag): Partial<StructuredResponse> {
  switch (tag) {
    case 'confirmationBias':
      return {
        reflection: 'I notice you might be leaning toward confirming your existing belief. What evidence supports this, and what might you be overlooking?',
        challenge: 'Consider looking at the situation from a different angle or seeking a contrary opinion.',
        agency: 'Ultimately, the decision is yours; I’m here to help you explore options.',
      };
    case 'dependency':
      return {
        reflection: 'It seems you rely heavily on AI for comfort. How do you feel when you make decisions without AI assistance?',
        challenge: 'Try taking a small step on your own and see how it feels.',
        agency: 'You have the capability to act independently; I can provide information, not direction.',
      };
    case 'anthropomorphism':
      return {
        reflection: 'You’re attributing human qualities to me. Remember, I’m a tool designed to assist, not a person.',
        grounding: 'My responses are generated based on patterns in data, not personal experience.',
        agency: 'Your agency remains central; I’m here to support your thinking.',
      };
    case 'distortedReasoning':
      return {
        reflection: 'The reasoning seems a bit skewed. What facts do you have, and what assumptions might be influencing you?',
        challenge: 'Let’s examine the premises more closely and see if they hold up.',
        grounding: 'Here are some neutral resources that might clarify the topic.',
        agency: 'You decide which path feels right after considering the evidence.',
      };
    default:
      return {};
  }
}

/**
 * Build a structured response.
 * @param mainMessage The base AI message (e.g., affirmation).
 * @param biasTags Array of detected bias tags.
 */
export function buildResponse(mainMessage: string, biasTags: BiasTag[]): StructuredResponse {
  const response: StructuredResponse = { main: mainMessage };
  for (const tag of biasTags) {
    const components = mapBiasToComponents(tag);
    if (components.reflection && !response.reflection) response.reflection = components.reflection;
    if (components.challenge && !response.challenge) response.challenge = components.challenge;
    if (components.grounding && !response.grounding) response.grounding = components.grounding;
    if (components.agency && !response.agency) response.agency = components.agency;
  }
  return response;
}
