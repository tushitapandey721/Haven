export function detectIntent(message: string): string {
  const lower = message.toLowerCase();
  let intent = "grounding";
  if (/(suicid|kill myself|self[-\s]?harm|die)/i.test(lower)) intent = "safetyCheck";
  else if (/\b(bored|nothing to do|boredom)\b/i.test(lower)) intent = "casual";
  else if (/\b(lonely|hopeless|nothing left|no one to talk)\b/i.test(lower)) intent = "supportive";
  else if (/\b(how to|advice|solve|help me|need help)\b/i.test(lower)) intent = "problemSolving";
  else if (/\b(joke|funny|interesting|story)\b/i.test(lower)) intent = "distraction";
  return intent;
}
