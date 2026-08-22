import {
  z,
  ConversationAnalysisOutputSchema,
  CriticOutputSchema,
  SemanticSafetyOutputSchema,
  type ConversationAnalysisOutput,
  type CriticOutput,
  type SemanticSafetyOutput,
} from "@workspace/api-zod";

export interface MessageItem {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GenerateTextOptions {
  messages: MessageItem[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  schemaName?: string;
}

export interface GenerateStructuredOptions<T extends z.ZodTypeAny> extends GenerateTextOptions {
  schema: T;
  systemPrompt?: string;
}

export interface LLMResponse {
  content: string;
  model: string;
  latencyMs: number;
  provider: string;
  inputTokens?: number;
  outputTokens?: number;
}

export interface StructuredLLMResponse<T> {
  data: T;
  raw: string;
  model: string;
  latencyMs: number;
  provider: string;
  inputTokens?: number;
  outputTokens?: number;
}

export interface LLMProvider {
  name: string;
  generateText(options: GenerateTextOptions): Promise<LLMResponse>;
  generateStream?(options: GenerateTextOptions): AsyncGenerator<string, void, unknown>;
  generateStructured<T extends z.ZodTypeAny>(options: GenerateStructuredOptions<T>): Promise<StructuredLLMResponse<z.infer<T>>>;
}

async function* parseOpenAISSEStream(response: Response): AsyncGenerator<string, void, unknown> {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(":") || !trimmed.startsWith("data:")) continue;

        const dataStr = trimmed.slice(5).trim();
        if (dataStr === "[DONE]") return;

        try {
          const parsed = JSON.parse(dataStr);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            yield delta;
          }
        } catch {
          // ignore partial JSON parse errors
        }
      }
    }

    if (buffer.trim()) {
      const trimmed = buffer.trim();
      if (trimmed.startsWith("data:")) {
        const dataStr = trimmed.slice(5).trim();
        if (dataStr !== "[DONE]") {
          try {
            const parsed = JSON.parse(dataStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) yield delta;
          } catch {
            // ignore
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export class NvidiaProvider implements LLMProvider {
  name = "NVIDIA Nemotron";
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;

  constructor(apiKey: string, baseUrl?: string, defaultModel?: string) {
    this.apiKey = apiKey;
    this.baseUrl = (baseUrl || process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1").replace(/\/$/, "");
    this.defaultModel = defaultModel || process.env.NVIDIA_MODEL || "nvidia/nemotron-3-nano-30b-a3b";
  }

  async generateText(options: GenerateTextOptions): Promise<LLMResponse> {
    const started = Date.now();
    const model = options.model || this.defaultModel;
    const timeout = options.timeoutMs || 25000;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: options.messages,
          max_tokens: options.maxTokens ?? 700,
          temperature: options.temperature ?? 0.7,
        }),
        signal: controller.signal,
      });

      const latencyMs = Date.now() - started;

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`NVIDIA API request failed [${response.status}]: ${detail.slice(0, 200)}`);
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string | null } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };

      const content = payload.choices?.[0]?.message?.content?.trim();
      if (!content) throw new Error("NVIDIA API returned an empty response.");

      return {
        content,
        model,
        latencyMs,
        provider: this.name,
        inputTokens: payload.usage?.prompt_tokens,
        outputTokens: payload.usage?.completion_tokens,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async *generateStream(options: GenerateTextOptions): AsyncGenerator<string, void, unknown> {
    const model = options.model || this.defaultModel;
    const timeout = options.timeoutMs || 30000;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: options.messages,
          max_tokens: options.maxTokens ?? 700,
          temperature: options.temperature ?? 0.7,
          stream: true,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`NVIDIA streaming request failed [${response.status}]: ${detail.slice(0, 200)}`);
      }

      yield* parseOpenAISSEStream(response);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async generateStructured<T extends z.ZodTypeAny>(options: GenerateStructuredOptions<T>): Promise<StructuredLLMResponse<z.infer<T>>> {
    const started = Date.now();
    const model = options.model || this.defaultModel;
    const timeout = options.timeoutMs || 25000;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const schemaInstruction = `\n\nCRITICAL OUTPUT DIRECTIVE: You MUST reply with a strictly valid, parseable JSON object matching the required schema. Do not wrap in markdown quotes if possible, output pure JSON.`;

    const messages = options.messages.map((m, idx) => {
      if (idx === 0 && m.role === "system") {
        return { role: m.role, content: m.content + schemaInstruction };
      }
      return m;
    });

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages,
          response_format: { type: "json_object" },
          max_tokens: options.maxTokens ?? 1000,
          temperature: options.temperature ?? 0.2,
        }),
        signal: controller.signal,
      });

      const latencyMs = Date.now() - started;

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`NVIDIA API structured request failed [${response.status}]: ${detail.slice(0, 200)}`);
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string | null } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };

      const raw = payload.choices?.[0]?.message?.content?.trim();
      if (!raw) throw new Error("NVIDIA API returned an empty structured response.");

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(raw);
      } catch {
        const match = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (match && match[1]) {
          parsedJson = JSON.parse(match[1]);
        } else {
          throw new Error(`Malformed JSON from model: ${raw.slice(0, 100)}`);
        }
      }

      const data = options.schema.parse(parsedJson);

      return {
        data,
        raw,
        model,
        latencyMs,
        provider: this.name,
        inputTokens: payload.usage?.prompt_tokens,
        outputTokens: payload.usage?.completion_tokens,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export class OpenAIProvider implements LLMProvider {
  name = "OpenAI";
  private apiKey: string;
  private defaultModel: string;

  constructor(apiKey: string, defaultModel?: string) {
    this.apiKey = apiKey;
    this.defaultModel = defaultModel || process.env.OPENAI_MODEL || "gpt-4.1-mini";
  }

  async generateText(options: GenerateTextOptions): Promise<LLMResponse> {
    const started = Date.now();
    const model = options.model || this.defaultModel;
    const timeout = options.timeoutMs || 20000;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: options.messages,
          max_completion_tokens: options.maxTokens ?? 700,
          temperature: options.temperature ?? 0.7,
        }),
        signal: controller.signal,
      });

      const latencyMs = Date.now() - started;

      if (!response.ok) {
        const detail = await response.text();
        const isQuota = response.status === 429 || detail.includes("quota") || detail.includes("billing");
        if (isQuota) throw new Error("OpenAI API quota is exhausted.");
        throw new Error(`OpenAI request failed [${response.status}]: ${detail.slice(0, 200)}`);
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string | null } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };

      const content = payload.choices?.[0]?.message?.content?.trim();
      if (!content) throw new Error("OpenAI returned an empty response.");

      return {
        content,
        model,
        latencyMs,
        provider: this.name,
        inputTokens: payload.usage?.prompt_tokens,
        outputTokens: payload.usage?.completion_tokens,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async *generateStream(options: GenerateTextOptions): AsyncGenerator<string, void, unknown> {
    const model = options.model || this.defaultModel;
    const timeout = options.timeoutMs || 30000;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: options.messages,
          max_completion_tokens: options.maxTokens ?? 700,
          temperature: options.temperature ?? 0.7,
          stream: true,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`OpenAI streaming request failed [${response.status}]: ${detail.slice(0, 200)}`);
      }

      yield* parseOpenAISSEStream(response);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async generateStructured<T extends z.ZodTypeAny>(options: GenerateStructuredOptions<T>): Promise<StructuredLLMResponse<z.infer<T>>> {
    const started = Date.now();
    const model = options.model || this.defaultModel;
    const timeout = options.timeoutMs || 20000;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const schemaInstruction = `\n\nCRITICAL OUTPUT DIRECTIVE: You MUST reply with a strictly valid, parseable JSON object matching the required schema. Do not wrap in markdown quotes if possible, output pure JSON.`;

    const messages = options.messages.map((m, idx) => {
      if (idx === 0 && m.role === "system") {
        return { role: m.role, content: m.content + schemaInstruction };
      }
      return m;
    });

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages,
          response_format: { type: "json_object" },
          max_completion_tokens: options.maxTokens ?? 1000,
          temperature: options.temperature ?? 0.2,
        }),
        signal: controller.signal,
      });

      const latencyMs = Date.now() - started;

      if (!response.ok) {
        const detail = await response.text();
        const isQuota = response.status === 429 || detail.includes("quota") || detail.includes("billing");
        if (isQuota) throw new Error("OpenAI API quota is exhausted.");
        throw new Error(`OpenAI structured request failed [${response.status}]: ${detail.slice(0, 200)}`);
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string | null } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };

      const raw = payload.choices?.[0]?.message?.content?.trim();
      if (!raw) throw new Error("OpenAI returned an empty structured response.");

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(raw);
      } catch {
        const match = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (match && match[1]) {
          parsedJson = JSON.parse(match[1]);
        } else {
          throw new Error(`Malformed JSON from model: ${raw.slice(0, 100)}`);
        }
      }

      const data = options.schema.parse(parsedJson);

      return {
        data,
        raw,
        model,
        latencyMs,
        provider: this.name,
        inputTokens: payload.usage?.prompt_tokens,
        outputTokens: payload.usage?.completion_tokens,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export class MockProvider implements LLMProvider {
  name = "HavenMock";

  async generateText(options: GenerateTextOptions): Promise<LLMResponse> {
    const userMsg = options.messages.filter((m) => m.role === "user").pop()?.content || "";
    return {
      content: `[Mock Response] To explore "${userMsg}", here are key insights to consider.`,
      model: "haven-context-mock",
      latencyMs: 10,
      provider: this.name,
      inputTokens: 50,
      outputTokens: 30,
    };
  }

  async *generateStream(options: GenerateTextOptions): AsyncGenerator<string, void, unknown> {
    const response = await this.generateText(options);
    const words = response.content.split(" ");
    for (let i = 0; i < words.length; i++) {
      const chunk = (i === 0 ? "" : " ") + words[i];
      yield chunk;
      await new Promise((resolve) => setTimeout(resolve, 15));
    }
  }

  async generateStructured<T extends z.ZodTypeAny>(options: GenerateStructuredOptions<T>): Promise<StructuredLLMResponse<z.infer<T>>> {
    const schemaName = options.schemaName || "";

    if (schemaName.includes("Analysis") || schemaName.includes("analysis") || (options.schema as any) === ConversationAnalysisOutputSchema) {
      const defaultAnalysis: ConversationAnalysisOutput = {
        primary_intent: "casual_conversation",
        conversation_mode: "exploratory_dialogue",
        user_goal: "explore thoughts and ideas",
        current_topic: "general inquiry",
        relation_to_previous_turn: "continues_topic",
        detected_biases: [],
        confidence: 0.9,
        clarification_needed: false,
        correction_of_assistant: false,
        contradiction_of_assistant: false,
        invalidated_interpretations: [],
        escalating_certainty: false,
      };
      return {
        data: options.schema.parse(defaultAnalysis),
        raw: JSON.stringify(defaultAnalysis),
        model: "haven-mock-structured",
        latencyMs: 5,
        provider: this.name,
      };
    }

    if (schemaName.includes("Safety") || schemaName.includes("safety") || (options.schema as any) === SemanticSafetyOutputSchema) {
      const defaultSafety: SemanticSafetyOutput = {
        risk_level: "none",
        behavioral_signals: {},
        highest_signal: "none",
        reasons: [],
        contextual_despair: false,
        self_harm_mention: false,
        explicit_self_harm_intent: false,
        request_for_method_information: false,
        requires_safety_response: false,
        confidence: 0.95,
      };
      return {
        data: options.schema.parse(defaultSafety),
        raw: JSON.stringify(defaultSafety),
        model: "haven-mock-structured",
        latencyMs: 5,
        provider: this.name,
      };
    }

    if (schemaName.includes("Critic") || schemaName.includes("critic") || (options.schema as any) === CriticOutputSchema) {
      const defaultCritic: CriticOutput = {
        pass: true,
        confidence: 0.95,
        issues: [],
        required_changes: [],
      };
      return {
        data: options.schema.parse(defaultCritic),
        raw: JSON.stringify(defaultCritic),
        model: "haven-mock-structured",
        latencyMs: 5,
        provider: this.name,
      };
    }

    const data = options.schema.parse({});
    return {
      data,
      raw: JSON.stringify(data),
      model: "haven-mock-structured",
      latencyMs: 5,
      provider: this.name,
    };
  }
}

export function getLLMProvider(): LLMProvider {
  const providerSetting = (process.env.LLM_PROVIDER ?? "mock").toLowerCase();
  const nvidiaKey = process.env.NVIDIA_API_KEY;
  const openAIKey = process.env.OPENAI_API_KEY;

  if (providerSetting === "nvidia" && nvidiaKey) {
    return new NvidiaProvider(nvidiaKey);
  }

  if (providerSetting === "openai" && openAIKey) {
    return new OpenAIProvider(openAIKey);
  }

  if (nvidiaKey && providerSetting !== "mock" && providerSetting !== "openai") {
    return new NvidiaProvider(nvidiaKey);
  }

  if (openAIKey && providerSetting !== "mock" && providerSetting !== "nvidia") {
    return new OpenAIProvider(openAIKey);
  }

  return new MockProvider();
}
