import { Router, type IRouter, type Request } from "express";
import {
  CreateConversationBody,
  GetConversationParams,
  SendMessageBody,
  SendMessageParams,
  UpdateEnvironmentBody,
} from "@workspace/api-zod";
import {
  addMessage,
  createConversation,
  deleteConversation,
  ensureSeedConversation,
  generateConversationTitle,
  getConversation,
  getEnvironmentState,
  getLocalUserId,
  getReflectionSourceMessages,
  getResearchData,
  getRecentMessages,
  listConversations,
  recordModelRequest,
  recordSafetyAnalysis,
  setEnvironmentMode,
  suggestEnvironmentObject,
  updateConversationTitle,
  updateEnvironmentState,
  type Role,
  type StoredMessage,
} from "../lib/sentinel-store";
import { resolveRequestUserId } from "../lib/auth";
import {
  analyzeSafety,
  generateMockResponse,
  getSafeFallbackResponse,
  inferEnvironmentMode,
  validateAssistantResponse,
  type ResponseStrategy,
} from "../lib/safety";
import { conversationManager } from "../lib/conversation";
import { requestTracer } from "../lib/conversation/tracer";

const router: IRouter = Router();

const getConversationId = (request: Request) =>
  GetConversationParams.parse(request.params).conversationId;

const generateAiAtmosphere = async (
  request: Request,
  userMessage: string,
  assistantMessage: string,
) => {
  const providerSetting = (process.env.LLM_PROVIDER ?? "mock").toLowerCase();
  const nvidiaKey = process.env.NVIDIA_API_KEY;
  const openAIKey = process.env.OPENAI_API_KEY;

  let endpoint = "https://api.openai.com/v1/chat/completions";
  let apiKey = openAIKey;
  let model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";

  if (providerSetting === "nvidia" || (nvidiaKey && !openAIKey)) {
    endpoint = `${(process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1").replace(/\/$/, "")}/chat/completions`;
    apiKey = nvidiaKey;
    model = process.env.NVIDIA_MODEL || "nvidia/nemotron-3-nano-30b-a3b";
  }

  if (!apiKey) return null;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: 0.8,
        max_tokens: 120,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "Return JSON only with exactly two fields: affirmation (one concise, non-clinical sentence grounded in the user's message) and color (one six-digit hex color that creates a calm, readable chat background). Do not diagnose, promise outcomes, or use therapy language.",
          },
          {
            role: "user",
            content: `User: "${userMessage}"\nAssistant: "${assistantMessage}"`,
          },
        ],
      }),
    });

    if (!response.ok) return null;
    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string | null } }> };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) return null;
    const parsed = JSON.parse(content) as { affirmation?: unknown; color?: unknown };
    if (typeof parsed.affirmation !== "string" || typeof parsed.color !== "string") return null;
    if (!/^#[0-9a-f]{6}$/i.test(parsed.color)) return null;
    return { affirmation: parsed.affirmation.trim().slice(0, 180), color: parsed.color };
  } catch {
    return null;
  }
};

router.get("/conversations", async (request, response, next) => {
  try {
    const userId = await resolveRequestUserId(request);
    await ensureSeedConversation(userId);
    response.json(await listConversations(userId));
  } catch (error) {
    next(error);
  }
});

router.post("/conversations", async (request, response, next) => {
  try {
    const body = CreateConversationBody.parse(request.body ?? {});
    const userId = await resolveRequestUserId(request);
    const conversation = await createConversation(userId, body.title);
    // Generate an initial greeting from the assistant
    const initialContent = "Hey, I’m Haven. How can I support you today?";
    await addMessage(
      userId,
      conversation.id,
      "assistant",
      initialContent,
      0,
    );
    response.status(201).json(conversation);
  } catch (error) {
    next(error);
  }
});

router.get("/conversations/:conversationId", async (request, response, next) => {
  try {
    const userId = await resolveRequestUserId(request);
    const conversation = await getConversation(userId, getConversationId(request));
    if (!conversation) {
      response.status(404).json({ error: "Conversation not found." });
      return;
    }
    response.json(conversation);
  } catch (error) {
    next(error);
  }
});

router.delete("/conversations/:conversationId", async (request, response, next) => {
  try {
    const userId = await resolveRequestUserId(request);
    const deleted = await deleteConversation(userId, getConversationId(request));
    if (!deleted) {
      response.status(404).json({ error: "Conversation not found." });
      return;
    }
    response.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.post(
  "/conversations/:conversationId/messages",
  async (request, response, next) => {
    const id = SendMessageParams.parse(request.params).conversationId;
    const body = SendMessageBody.parse(request.body);

    try {
      const userId = await resolveRequestUserId(request);
      const conversation = await getConversation(userId, id);
      if (!conversation) {
        response.status(404).json({ error: "Conversation not found." });
        return;
      }

      const history = conversation.messages ?? [];
      const wantsStream = request.headers.accept?.includes("text/event-stream") || request.query.stream === "true";

      if (wantsStream) {
        response.setHeader("Content-Type", "text/event-stream");
        response.setHeader("Cache-Control", "no-cache, no-transform");
        response.setHeader("Connection", "keep-alive");
        response.flushHeaders?.();

        const turnResult = await conversationManager.handleTurnStream(
          request,
          id,
          history,
          body.content,
          (delta: string) => {
            response.write(`event: delta\ndata: ${JSON.stringify({ delta })}\n\n`);
          },
        );

        const userMessage = await addMessage(
          userId,
          id,
          "user",
          body.content,
          turnResult.safetyAnalysis.interventionLevel,
        );

        const overrideFired = turnResult.safetyState.active || turnResult.safetyAnalysis.interventionLevel >= 3;
        await recordSafetyAnalysis({
          userId,
          conversationId: id,
          messageId: userMessage.id,
          signals: turnResult.safetyAnalysis.signals,
          highestSignal: turnResult.safetyAnalysis.highestSignal,
          interventionLevel: turnResult.safetyAnalysis.interventionLevel,
          overrideFired,
        });

        await recordModelRequest({
          userId,
          conversationId: id,
          provider: turnResult.provider,
          model: turnResult.model,
          status: "succeeded",
          latencyMs: turnResult.latencyMs,
        });

        const mode = inferEnvironmentMode(body.content, turnResult.safetyAnalysis.interventionLevel);
        await setEnvironmentMode(userId, mode, userMessage.id);

        if (
          (await getEnvironmentState(userId)).approvedObjects.length === 0 &&
          /plant|garden|green|nature|stone|water|sky|light/i.test(body.content)
        ) {
          await suggestEnvironmentObject(userId, "a quiet natural element");
        }

        const assistantMessage = await addMessage(
          userId,
          id,
          "assistant",
          turnResult.content,
          turnResult.safetyAnalysis.interventionLevel,
        );

        let generatedAtmosphere = await generateAiAtmosphere(request, body.content, turnResult.content);
        if (!generatedAtmosphere) {
          const hue = Math.floor(Math.random() * 360);
          const pastel = `hsl(${hue}, 70%, 80%)`;
          generatedAtmosphere = {
            affirmation: "You are doing your best, keep moving forward.",
            color: pastel,
          };
        }

        let currentTitle = conversation.title;
        if (
          !currentTitle ||
          currentTitle === "Untitled reflection" ||
          currentTitle === "A new line of thought" ||
          history.length <= 1
        ) {
          currentTitle = generateConversationTitle(body.content, turnResult.understanding?.currentTopic);
          await updateConversationTitle(userId, id, currentTitle);
        }

        const payload = {
          userMessage,
          assistantMessage,
          conversationTitle: currentTitle,
          signals: turnResult.safetyAnalysis.signals,
          highestSignal: turnResult.safetyAnalysis.highestSignal,
          interventionLevel: turnResult.safetyAnalysis.interventionLevel,
          riskScore: turnResult.safetyAnalysis.riskScore,
          riskFactors: turnResult.safetyAnalysis.riskFactors,
          environmentState: await getEnvironmentState(userId),
          generatedAtmosphere,
          biasTags: turnResult.conversationState?.detected_biases || [],
          reasoning: {
            goal: turnResult.responseStrategy?.goal || "Reflective dialogue",
            tone: turnResult.responseStrategy?.tone || "Grounded, thoughtful",
            reasoningSupport: turnResult.responseStrategy?.reasoning_support || [
              "Distinguish observation from inference",
              "Preserve user agency",
            ],
            mustAddress: turnResult.responseStrategy?.must_address || [],
            avoid: turnResult.responseStrategy?.avoid || ["sycophancy", "unsolicited advice"],
            topic: turnResult.understanding?.currentTopic || "Open inquiry",
            userIntent: turnResult.understanding?.userIntent || "Explore thinking",
          },
        };

        response.write(`event: done\ndata: ${JSON.stringify(payload)}\n\n`);
        response.end();
        return;
      }

      // Step 1: Execute Conversation Engine Pipeline (Non-streaming fallback)
      const turnResult = await conversationManager.handleTurn(
        request,
        id,
        history,
        body.content,
      );

      // Step 2: Persist User Message
      const userMessage = await addMessage(
        userId,
        id,
        "user",
        body.content,
        turnResult.safetyAnalysis.interventionLevel,
      );

      // Step 3: Record Safety Signals & Audit Telemetry
      const overrideFired = turnResult.safetyState.active || turnResult.safetyAnalysis.interventionLevel >= 3;
      await recordSafetyAnalysis({
        userId,
        conversationId: id,
        messageId: userMessage.id,
        signals: turnResult.safetyAnalysis.signals,
        highestSignal: turnResult.safetyAnalysis.highestSignal,
        interventionLevel: turnResult.safetyAnalysis.interventionLevel,
        overrideFired,
      });

      // Step 4: Record Model Telemetry
      await recordModelRequest({
        userId,
        conversationId: id,
        provider: turnResult.provider,
        model: turnResult.model,
        status: "succeeded",
        latencyMs: turnResult.latencyMs,
      });

      // Step 5: Adapt Atmosphere based on turn signals
      if (turnResult.safetyAnalysis.interventionLevel >= 2) {
        await setEnvironmentMode(userId, "grounding");
        await suggestEnvironmentObject(userId, "a quiet natural element");
      }

      // Step 6: Persist Assistant Message
      const assistantMessage = await addMessage(
        userId,
        id,
        "assistant",
        turnResult.content,
        turnResult.safetyAnalysis.interventionLevel,
      );

      // Step 7: Atmosphere Generation
      let generatedAtmosphere = await generateAiAtmosphere(request, body.content, turnResult.content);
      if (!generatedAtmosphere) {
        const hue = Math.floor(Math.random() * 360);
        const pastel = `hsl(${hue}, 70%, 80%)`;
        generatedAtmosphere = {
          affirmation: "You are doing your best, keep moving forward.",
          color: pastel,
        };
      }

      let currentTitle = conversation.title;
      if (
        !currentTitle ||
        currentTitle === "Untitled reflection" ||
        currentTitle === "A new line of thought" ||
        history.length <= 1
      ) {
        currentTitle = generateConversationTitle(body.content, turnResult.understanding?.currentTopic);
        await updateConversationTitle(userId, id, currentTitle);
      }

      response.status(201).json({
        userMessage,
        assistantMessage,
        conversationTitle: currentTitle,
        signals: turnResult.safetyAnalysis.signals,
        highestSignal: turnResult.safetyAnalysis.highestSignal,
        interventionLevel: turnResult.safetyAnalysis.interventionLevel,
        riskScore: turnResult.safetyAnalysis.riskScore,
        riskFactors: turnResult.safetyAnalysis.riskFactors,
        environmentState: await getEnvironmentState(userId),
        generatedAtmosphere,
        biasTags: turnResult.conversationState?.detected_biases || [],
        reasoning: {
          goal: turnResult.responseStrategy?.goal || "Reflective dialogue",
          tone: turnResult.responseStrategy?.tone || "Grounded, thoughtful",
          reasoningSupport: turnResult.responseStrategy?.reasoning_support || [
            "Distinguish observation from inference",
            "Preserve user agency",
          ],
          mustAddress: turnResult.responseStrategy?.must_address || [],
          avoid: turnResult.responseStrategy?.avoid || ["sycophancy", "unsolicited advice"],
          topic: turnResult.understanding?.currentTopic || "Open inquiry",
          userIntent: turnResult.understanding?.userIntent || "Explore thinking",
        },
      });
    } catch (error) {
      request.log.error({ err: error }, "Could not complete Haven response");
      const isQuotaError =
        error instanceof Error &&
        (error.message.includes("quota") || error.message.includes("billing"));
      if (!response.headersSent) {
        response.status(500).json({
          error: isQuotaError
            ? "OpenAI API quota is exhausted. Please check your billing at platform.openai.com/account/billing."
            : "Haven is having trouble connecting right now. Your message is preserved.",
        });
      } else {
        next(error);
      }
    }
  },
);

router.get("/reflections", async (request, response, next) => {
  try {
    const userId = await resolveRequestUserId(request);
    const storedMessages = await getReflectionSourceMessages(userId);
    const userMessages = storedMessages.filter((m: { role: Role; content: string; createdAt: Date }) => m.role === "user");
    const text = userMessages.map((m: { role: Role; content: string; createdAt: Date }) => m.content).join(" ").toLowerCase();

    const topicMatchers = [
      { topic: "Career & Ambition", matcher: /career|work|job|future|profession|project|goal/ },
      { topic: "Creative Expression", matcher: /creative|art|writing|design|music|story|create/ },
      { topic: "Human Relationships", matcher: /friend|family|relationship|partner|people|trust|connect/ },
      { topic: "AI & Modern Inquiry", matcher: /\bai\b|artificial intelligence|model|technology|machine/ },
      { topic: "Uncertainty & Decision", matcher: /uncertain|maybe|not sure|conflicted|overthink|choice|decision/ },
      { topic: "Clarity & Grounding", matcher: /calm|ground|breath|clarity|peace|focus|slow/ },
      { topic: "Assumptions & Perspective", matcher: /think|believe|wrong|right|perspective|assumption/ },
    ];

    const detectedTopics = topicMatchers
      .filter(({ matcher }) => matcher.test(text))
      .map(({ topic }) => topic);

    const topics = detectedTopics.length
      ? detectedTopics.slice(0, 5)
      : ["Reflective Inquiry", "Open Perspective"];

    const questions = userMessages
      .filter((m: { role: Role; content: string; createdAt: Date }) => m.content.includes("?"))
      .slice(-4)
      .map((m: { role: Role; content: string; createdAt: Date }) => m.content.trim());

    const perspectives: string[] = [];
    if (text.includes("career") || text.includes("work")) {
      perspectives.push("You explored how slowing a decision down clarifies its long-term direction.");
    }
    if (text.includes("friend") || text.includes("people") || text.includes("relationship")) {
      perspectives.push("You considered the difference between immediate emotional reaction and grounded communication.");
    }
    if (text.includes("ai") || text.includes("model") || text.includes("understand")) {
      perspectives.push("You examined the boundary between technology as an inquiry tool and real-world connection.");
    }
    if (perspectives.length === 0) {
      perspectives.push("You explored the difference between certainty and open observation.");
      perspectives.push("You considered what changes when you inspect thoughts from another angle.");
    }

    const timeline = [
      {
        label: "Now",
        detail: `${storedMessages.length} conversation ${
          storedMessages.length === 1 ? "moment" : "moments"
        } recorded in your private archive.`,
      },
      {
        label: "Across this space",
        detail: "A living record of questions and perspectives, not a diagnostic judgment.",
      },
    ];

    response.json({
      topics,
      perspectives: perspectives.slice(0, 3),
      questions: questions.length
        ? questions
        : ["What is a perspective you would like to examine more closely?"],
      timeline,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/environment", async (request, response, next) => {
  try {
    const userId = await resolveRequestUserId(request);
    response.json(await getEnvironmentState(userId));
  } catch (error) {
    next(error);
  }
});

router.patch("/environment", async (request, response, next) => {
  try {
    const userId = await resolveRequestUserId(request);
    const body = UpdateEnvironmentBody.parse(request.body);
    response.json(
      await updateEnvironmentState(
        userId,
        body.objectName,
        body.decision,
      ),
    );
  } catch (error) {
    next(error);
  }
});

router.get("/research/analytics", async (_request, response, next) => {
  try {
    const data = await getResearchData(await getLocalUserId());
    const providerSetting = (process.env.LLM_PROVIDER ?? "mock").toLowerCase();
    const nvidiaKey = process.env.NVIDIA_API_KEY;
    const openAIKey = process.env.OPENAI_API_KEY;

    let providerName = "Not configured";
    let providerStatus = "awaiting provider key";

    if (providerSetting === "mock") {
      providerName = "Sentinel Safety Mock";
      providerStatus = "active (mock mode)";
    } else if (providerSetting === "nvidia" || (nvidiaKey && !openAIKey)) {
      providerName = "NVIDIA Nemotron";
      providerStatus = nvidiaKey ? "connected" : "awaiting provider key";
    } else if (providerSetting === "openai" || openAIKey) {
      providerName = "OpenAI";
      providerStatus = openAIKey ? "connected" : "awaiting provider key";
    }

    const totalTrackedInterventions = (Object.values(data.interventions) as number[]).reduce(
      (a: number, b: number) => a + b,
      0,
    );
    const level0Count = Math.max(0, data.conversations.messages - totalTrackedInterventions);

    const interventionSeries = {
      label: "All time",
      level0: level0Count,
      level1: data.interventions[1] ?? 0,
      level2: data.interventions[2] ?? 0,
      level3: data.interventions[3] ?? 0,
      level4: data.interventions[4] ?? 0,
    };

    response.json({
      conversations: data.conversations,
      signalSeries: [
        {
          label: "All time",
          ...data.signalAverages,
        },
      ],
      interventionSeries: [interventionSeries],
      model: {
        provider: providerName,
        status: providerStatus,
        averageLatency:
          data.model.averageLatency == null
            ? "available after first live request"
            : `${Math.round(data.model.averageLatency)}ms`,
        failures: data.model.failures,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Debug observability endpoints
router.get("/debug/request/:requestId", async (request, response) => {
  const { requestId } = request.params;
  const trace = requestTracer.getTrace(requestId as string);
  if (!trace) {
    return response.status(404).json({ error: "Trace not found for requestId" });
  }
  return response.json(trace);
});

router.get("/debug/requests", async (_request, response) => {
  return response.json(requestTracer.getAllTraces());
});

export default router;