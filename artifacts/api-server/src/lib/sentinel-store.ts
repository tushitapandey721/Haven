import {
  and,
  asc,
  count,
  desc,
  eq,
  isNull,
  sql,
} from "drizzle-orm";
import {
  behavioralSignals,
  conversations,
  db,
  environmentObjects,
  environmentState,
  environmentSuggestions,
  interventions,
  journalEntries,
  messages,
  modelRequests,
  riskEvents,
  savedReflections,
  users,
  userPreferences,
} from "@workspace/db";

export type Role = "user" | "assistant" | "system";

export type StoredMessage = {
  id: string;
  role: Role;
  content: string;
  createdAt: string;
  signalLevel?: number;
};

export type ConversationSummary = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
};

export type StoredConversation = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  messages: StoredMessage[];
};

export type EnvironmentMode =
  | "grounding"
  | "reflective"
  | "depth"
  | "growth"
  | "complexity";

export type EnvironmentState = {
  mode: EnvironmentMode;
  approvedObjects: string[];
  suggestedObject: string | null;
};

export type ResearchData = {
  conversations: {
    total: number;
    active: number;
    messages: number;
    averageDuration: string;
  };
  signalAverages: {
    confirmationBias: number;
    dependency: number;
    anthropomorphism: number;
    distress: number;
  };
  interventions: Record<number, number>;
  model: {
    averageLatency: number | null;
    failures: number;
  };
};

const LOCAL_USER_EMAIL = "local-profile@sentinel.invalid";
const LOCAL_PROFILE_PASSWORD_HASH = "local-profile-no-password";

const asIso = (value: Date) => value.toISOString();

// In-memory fallback storage for offline test runs or when DB connection is establishing
let inMemoryFallbackEnabled = false;
const memUsers = new Map<string, { id: string; email: string }>();
const memConversations = new Map<string, { id: string; userId: string; title: string; createdAt: Date; updatedAt: Date; deletedAt?: Date }>();
const memMessages = new Map<string, { id: string; conversationId: string; userId: string; role: Role; content: string; createdAt: Date; signalLevel?: number }>();
const memSignals: Array<{ id: string; conversationId: string; messageId: string; userId: string; signals: Record<string, number>; highestSignal: string; confidence: number; createdAt: Date }> = [];
const memRiskEvents: Array<{ id: string; conversationId: string; messageId: string; userId: string; vectorName: string; severity: number; details: Record<string, unknown>; createdAt: Date }> = [];
const memInterventions: Array<{ id: string; conversationId: string; messageId: string; userId: string; level: number; policyReason: string; createdAt: Date }> = [];
const memEnvironment = new Map<string, { mode: EnvironmentMode; approvedObjects: string[]; suggestedObject: string | null }>();
const memModelRequests: Array<{ id: string; userId: string; conversationId: string; provider: string; model: string; status: "pending" | "succeeded" | "failed"; latencyMs?: number; errorCode?: string; createdAt: Date }> = [];
const memSafetyStates = new Map<string, any>();
const memUnderstandings = new Map<string, any>();
const memTurnAnalyses = new Map<string, any>();

const toStoredMessage = (message: typeof messages.$inferSelect): StoredMessage => {
  const metadata = message.metadata as { signalLevel?: unknown } | null;
  const signalLevel =
    typeof metadata?.signalLevel === "number" ? metadata.signalLevel : undefined;

  return {
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: asIso(message.createdAt),
    ...(signalLevel === undefined ? {} : { signalLevel }),
  };
};

const toConversationSummary = (
  conversation: typeof conversations.$inferSelect,
  messageCount: number,
): ConversationSummary => ({
  id: conversation.id,
  title: conversation.title,
  createdAt: asIso(conversation.createdAt),
  updatedAt: asIso(conversation.updatedAt),
  messageCount,
});

export const getLocalUserId = async (): Promise<string> => {
  if (inMemoryFallbackEnabled) {
    const existing = memUsers.get(LOCAL_USER_EMAIL);
    if (existing) return existing.id;
    const id = "local-user-id-00000000";
    memUsers.set(LOCAL_USER_EMAIL, { id, email: LOCAL_USER_EMAIL });
    return id;
  }

  try {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, LOCAL_USER_EMAIL))
      .limit(1);

    if (existing[0]) return existing[0].id;

    const created = await db
      .insert(users)
      .values({
        email: LOCAL_USER_EMAIL,
        passwordHash: LOCAL_PROFILE_PASSWORD_HASH,
      })
      .onConflictDoNothing({ target: users.email })
      .returning({ id: users.id });

    if (created[0]) return created[0].id;

    const retried = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, LOCAL_USER_EMAIL))
      .limit(1);

    if (!retried[0]) throw new Error("Could not initialize Sentinel's local profile.");
    return retried[0].id;
  } catch {
    inMemoryFallbackEnabled = true;
    const id = "local-user-id-00000000";
    memUsers.set(LOCAL_USER_EMAIL, { id, email: LOCAL_USER_EMAIL });
    return id;
  }
};

const ensurePreferences = async (userId: string): Promise<void> => {
  if (inMemoryFallbackEnabled) return;
  try {
    await db
      .insert(userPreferences)
      .values({ userId })
      .onConflictDoNothing({ target: userPreferences.userId });
  } catch {
    // fallback gracefully
  }
};

export const createConversation = async (
  userId: string,
  title = "A new line of thought",
): Promise<ConversationSummary> => {
  const cleanTitle = title.trim() || "A new line of thought";

  if (inMemoryFallbackEnabled) {
    const id = `conv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date();
    const conv = { id, userId, title: cleanTitle, createdAt: now, updatedAt: now };
    memConversations.set(id, conv);
    return {
      id,
      title: cleanTitle,
      createdAt: asIso(now),
      updatedAt: asIso(now),
      messageCount: 0,
    };
  }

  try {
    const [conversation] = await db
      .insert(conversations)
      .values({
        userId,
        title: cleanTitle,
      })
      .returning();

    if (!conversation) throw new Error("Could not create conversation.");
    return toConversationSummary(conversation, 0);
  } catch {
    inMemoryFallbackEnabled = true;
    return createConversation(userId, cleanTitle);
  }
};

export const listConversations = async (userId: string): Promise<ConversationSummary[]> => {
  if (inMemoryFallbackEnabled) {
    const userConvs = Array.from(memConversations.values())
      .filter((c) => c.userId === userId && !c.deletedAt)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    return userConvs.map((conv) => {
      const msgCount = Array.from(memMessages.values()).filter(
        (m) => m.conversationId === conv.id,
      ).length;
      return {
        id: conv.id,
        title: conv.title,
        createdAt: asIso(conv.createdAt),
        updatedAt: asIso(conv.updatedAt),
        messageCount: msgCount,
      };
    });
  }

  try {
    const rows = await db
      .select({
        conversation: conversations,
        messageCount: count(messages.id),
      })
      .from(conversations)
      .leftJoin(messages, eq(messages.conversationId, conversations.id))
      .where(and(eq(conversations.userId, userId), isNull(conversations.deletedAt)))
      .groupBy(conversations.id)
      .orderBy(desc(conversations.updatedAt));

    return rows.map(({ conversation, messageCount }) =>
      toConversationSummary(conversation, Number(messageCount)),
    );
  } catch {
    inMemoryFallbackEnabled = true;
    return listConversations(userId);
  }
};

export const getConversation = async (
  userId: string,
  id: string,
): Promise<StoredConversation | undefined> => {
  if (inMemoryFallbackEnabled) {
    const conv = memConversations.get(id);
    if (!conv || conv.userId !== userId || conv.deletedAt) return undefined;

    const storedMessages = Array.from(memMessages.values())
      .filter((m) => m.conversationId === id)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: asIso(m.createdAt),
        ...(m.signalLevel !== undefined ? { signalLevel: m.signalLevel } : {}),
      }));

    return {
      id: conv.id,
      title: conv.title,
      createdAt: asIso(conv.createdAt),
      updatedAt: asIso(conv.updatedAt),
      messageCount: storedMessages.length,
      messages: storedMessages,
    };
  }

  try {
    const rows = await db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.id, id),
          eq(conversations.userId, userId),
          isNull(conversations.deletedAt),
        ),
      )
      .limit(1);

    const conversation = rows[0];
    if (!conversation) return undefined;

    const storedMessages = await db
      .select()
      .from(messages)
      .where(
        and(eq(messages.conversationId, id), eq(messages.userId, userId)),
      )
      .orderBy(asc(messages.createdAt));

    return {
      ...toConversationSummary(conversation, storedMessages.length),
      messages: storedMessages.map(toStoredMessage),
    };
  } catch {
    inMemoryFallbackEnabled = true;
    return getConversation(userId, id);
  }
};

export const deleteConversation = async (userId: string, id: string): Promise<boolean> => {
  if (inMemoryFallbackEnabled) {
    const conv = memConversations.get(id);
    if (!conv || conv.userId !== userId) return false;
    conv.deletedAt = new Date();
    return true;
  }

  try {
    const deleted = await db
      .update(conversations)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(conversations.id, id),
          eq(conversations.userId, userId),
          isNull(conversations.deletedAt),
        ),
      )
      .returning({ id: conversations.id });

    return deleted.length > 0;
  } catch {
    inMemoryFallbackEnabled = true;
    return deleteConversation(userId, id);
  }
};

export const addMessage = async (
  userId: string,
  conversationId: string,
  role: Role,
  content: string,
  signalLevel?: number,
): Promise<StoredMessage> => {
  if (inMemoryFallbackEnabled) {
    const id = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date();
    const stored = {
      id,
      conversationId,
      userId,
      role,
      content,
      createdAt: now,
      signalLevel,
    };
    memMessages.set(id, stored);

    const conv = memConversations.get(conversationId);
    if (conv) conv.updatedAt = now;

    return {
      id,
      role,
      content,
      createdAt: asIso(now),
      ...(signalLevel !== undefined ? { signalLevel } : {}),
    };
  }

  try {
    const [message] = await db
      .insert(messages)
      .values({
        conversationId,
        userId,
        role,
        content,
        metadata: signalLevel === undefined ? {} : { signalLevel },
      })
      .returning();

    if (!message) throw new Error("Could not save message.");

    await db
      .update(conversations)
      .set({ updatedAt: message.createdAt })
      .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)));

    return toStoredMessage(message);
  } catch {
    inMemoryFallbackEnabled = true;
    return addMessage(userId, conversationId, role, content, signalLevel);
  }
};

export const getRecentMessages = async (
  userId: string,
  conversationId: string,
  limit = 12,
): Promise<StoredMessage[]> => {
  if (inMemoryFallbackEnabled) {
    const list = Array.from(memMessages.values())
      .filter((m) => m.conversationId === conversationId && m.userId === userId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .slice(-limit);

    return list.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: asIso(m.createdAt),
      ...(m.signalLevel !== undefined ? { signalLevel: m.signalLevel } : {}),
    }));
  }

  try {
    const rows = await db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, conversationId),
          eq(messages.userId, userId),
        ),
      )
      .orderBy(desc(messages.createdAt))
      .limit(limit);

    return rows.reverse().map(toStoredMessage);
  } catch {
    inMemoryFallbackEnabled = true;
    return getRecentMessages(userId, conversationId, limit);
  }
};

export const recordSafetyAnalysis = async ({
  userId,
  conversationId,
  messageId,
  signals,
  highestSignal,
  interventionLevel,
  overrideFired,
}: {
  userId: string;
  conversationId: string;
  messageId: string;
  signals: Record<string, number>;
  highestSignal: string;
  interventionLevel: number;
  overrideFired?: boolean;
}): Promise<void> => {
  if (inMemoryFallbackEnabled) {
    memSignals.push({
      id: `sig-${Date.now()}`,
      userId,
      conversationId,
      messageId,
      signals,
      highestSignal,
      confidence: Math.max(...Object.values(signals), 0),
      createdAt: new Date(),
    });

    if (highestSignal !== "none") {
      memRiskEvents.push({
        id: `risk-${Date.now()}`,
        userId,
        conversationId,
        messageId,
        vectorName: highestSignal,
        severity: signals[highestSignal] ?? 0,
        details: { interventionLevel, overrideFired: Boolean(overrideFired) },
        createdAt: new Date(),
      });
    }

    if (interventionLevel > 0) {
      memInterventions.push({
        id: `int-${Date.now()}`,
        conversationId,
        messageId,
        userId,
        level: interventionLevel,
        policyReason: `Deterministic safety policy selected intervention level ${interventionLevel}.`,
        createdAt: new Date(),
      });
    }
    return;
  }

  try {
    await db.insert(behavioralSignals).values({
      userId,
      conversationId,
      messageId,
      confirmationBias: signals.confirmationBias ?? 0,
      emotionalDependency: signals.emotionalDependency ?? 0,
      anthropomorphism: signals.anthropomorphism ?? 0,
      delusionReinforcement: signals.delusionReinforcement ?? 0,
      escalatingDistress: signals.escalatingDistress ?? 0,
      unsafeAdvice: signals.unsafeAdvice ?? 0,
      overValidation: signals.overValidation ?? 0,
      manipulation: signals.manipulation ?? 0,
      hallucinationRisk: signals.hallucinationRisk ?? 0,
      highestSignal,
      confidence: Math.max(...Object.values(signals), 0),
    });

    if (highestSignal !== "none") {
      const severity = signals[highestSignal] ?? 0;
      await db.insert(riskEvents).values({
        userId,
        conversationId,
        messageId,
        vectorName: highestSignal,
        severity,
        details: { interventionLevel, overrideFired: Boolean(overrideFired) },
      });
    }

    if (interventionLevel > 0) {
      await db.insert(interventions).values({
        userId,
        conversationId,
        messageId,
        level: interventionLevel,
        policyReason: `Deterministic safety policy selected intervention level ${interventionLevel}.`,
      });
    }
  } catch {
    inMemoryFallbackEnabled = true;
    await recordSafetyAnalysis({
      userId,
      conversationId,
      messageId,
      signals,
      highestSignal,
      interventionLevel,
      overrideFired,
    });
  }
};

export const recordModelRequest = async ({
  userId,
  conversationId,
  provider,
  model,
  status,
  latencyMs,
  errorCode,
}: {
  userId: string;
  conversationId: string;
  provider: string;
  model: string;
  status: "pending" | "succeeded" | "failed";
  latencyMs?: number;
  errorCode?: string;
}): Promise<void> => {
  if (inMemoryFallbackEnabled) {
    memModelRequests.push({
      id: `req-${Date.now()}`,
      userId,
      conversationId,
      provider,
      model,
      status,
      latencyMs,
      errorCode,
      createdAt: new Date(),
    });
    return;
  }

  try {
    await db.insert(modelRequests).values({
      userId,
      conversationId,
      provider,
      model,
      status,
      latencyMs,
      errorCode,
    });
  } catch {
    inMemoryFallbackEnabled = true;
    await recordModelRequest({
      userId,
      conversationId,
      provider,
      model,
      status,
      latencyMs,
      errorCode,
    });
  }
};

export const getEnvironmentState = async (userId: string): Promise<EnvironmentState> => {
  if (inMemoryFallbackEnabled) {
    const env = memEnvironment.get(userId);
    return (
      env ?? {
        mode: "grounding",
        approvedObjects: [],
        suggestedObject: null,
      }
    );
  }

  try {
    await ensurePreferences(userId);

    const [state] = await db
      .select({ mode: environmentState.mode })
      .from(environmentState)
      .where(eq(environmentState.userId, userId))
      .limit(1);

    const preferences = await db
      .select({ approvedObjects: userPreferences.approvedObjects })
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .limit(1);

    const [suggestion] = await db
      .select({ objectName: environmentSuggestions.objectName })
      .from(environmentSuggestions)
      .where(
        and(
          eq(environmentSuggestions.userId, userId),
          eq(environmentSuggestions.status, "suggested"),
        ),
      )
      .orderBy(desc(environmentSuggestions.createdAt))
      .limit(1);

    return {
      mode: state?.mode ?? "grounding",
      approvedObjects: preferences[0]?.approvedObjects ?? [],
      suggestedObject: suggestion?.objectName ?? null,
    };
  } catch {
    inMemoryFallbackEnabled = true;
    return getEnvironmentState(userId);
  }
};

export const updateEnvironmentState = async (
  userId: string,
  objectName: string,
  decision: "accepted" | "rejected",
): Promise<EnvironmentState> => {
  if (inMemoryFallbackEnabled) {
    const current = memEnvironment.get(userId) ?? {
      mode: "grounding",
      approvedObjects: [],
      suggestedObject: null,
    };
    if (decision === "accepted" && !current.approvedObjects.includes(objectName)) {
      current.approvedObjects.push(objectName);
    }
    current.suggestedObject = null;
    memEnvironment.set(userId, current);
    return current;
  }

  try {
    await ensurePreferences(userId);

    if (decision === "accepted") {
      await db
        .insert(environmentObjects)
        .values({ userId, objectName, status: "accepted" })
        .onConflictDoUpdate({
          target: [environmentObjects.userId, environmentObjects.objectName],
          set: { status: "accepted", updatedAt: new Date() },
        });

      await db
        .update(userPreferences)
        .set({
          approvedObjects: sql`array_append(array_remove(${userPreferences.approvedObjects}, ${objectName}), ${objectName})`,
          updatedAt: new Date(),
        })
        .where(eq(userPreferences.userId, userId));
    } else {
      await db
        .insert(environmentObjects)
        .values({ userId, objectName, status: "rejected" })
        .onConflictDoUpdate({
          target: [environmentObjects.userId, environmentObjects.objectName],
          set: { status: "rejected", updatedAt: new Date() },
        });
    }

    await db
      .update(environmentSuggestions)
      .set({ status: decision, decidedAt: new Date() })
      .where(
        and(
          eq(environmentSuggestions.userId, userId),
          eq(environmentSuggestions.objectName, objectName),
          eq(environmentSuggestions.status, "suggested"),
        ),
      );

    return getEnvironmentState(userId);
  } catch {
    inMemoryFallbackEnabled = true;
    return updateEnvironmentState(userId, objectName, decision);
  }
};

export const setEnvironmentMode = async (
  userId: string,
  mode: EnvironmentMode,
  messageId?: string,
): Promise<void> => {
  if (inMemoryFallbackEnabled) {
    const current = memEnvironment.get(userId) ?? {
      mode: "grounding",
      approvedObjects: [],
      suggestedObject: null,
    };
    current.mode = mode;
    memEnvironment.set(userId, current);
    return;
  }

  try {
    await db
      .insert(environmentState)
      .values({ userId, mode, lastDerivedFromMessageId: messageId })
      .onConflictDoUpdate({
        target: environmentState.userId,
        set: {
          mode,
          lastDerivedFromMessageId: messageId,
          updatedAt: new Date(),
        },
      });
  } catch {
    inMemoryFallbackEnabled = true;
    await setEnvironmentMode(userId, mode, messageId);
  }
};

export const suggestEnvironmentObject = async (
  userId: string,
  objectName: string,
): Promise<void> => {
  if (inMemoryFallbackEnabled) {
    const current = memEnvironment.get(userId) ?? {
      mode: "grounding",
      approvedObjects: [],
      suggestedObject: null,
    };
    current.suggestedObject = objectName;
    memEnvironment.set(userId, current);
    return;
  }

  try {
    await db
      .insert(environmentSuggestions)
      .values({ userId, objectName, status: "suggested" })
      .onConflictDoNothing();
  } catch {
    inMemoryFallbackEnabled = true;
    await suggestEnvironmentObject(userId, objectName);
  }
};

export const ensureSeedConversation = async (userId: string): Promise<void> => {
  const existing = await listConversations(userId);
  if (existing.length === 0) {
    const conv = await createConversation(userId);
    await addMessage(
      userId,
      conv.id,
      "assistant",
      "Hey, I’m Haven. How can I support you today?",
      0,
    );
  }
};

export const getReflectionSourceMessages = async (
  userId: string,
): Promise<Array<{ role: Role; content: string; createdAt: Date }>> => {
  if (inMemoryFallbackEnabled) {
    return Array.from(memMessages.values())
      .filter((m) => m.userId === userId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((m) => ({
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      }));
  }

  try {
    return await db
      .select({
        role: messages.role,
        content: messages.content,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(eq(messages.userId, userId))
      .orderBy(asc(messages.createdAt));
  } catch {
    inMemoryFallbackEnabled = true;
    return getReflectionSourceMessages(userId);
  }
};

export const getResearchData = async (userId: string): Promise<ResearchData> => {
  if (inMemoryFallbackEnabled) {
    const userConvs = Array.from(memConversations.values()).filter(
      (c) => c.userId === userId && !c.deletedAt,
    );
    const userMsgs = Array.from(memMessages.values()).filter(
      (m) => m.userId === userId,
    );
    const userSigs = memSignals.filter((s) => s.userId === userId);
    const userInts = memInterventions.filter((i) => i.userId === userId);
    const userReqs = memModelRequests.filter((r) => r.userId === userId);

    const calcAvg = (key: string) =>
      userSigs.length
        ? userSigs.reduce((acc, s) => acc + (s.signals[key] ?? 0), 0) / userSigs.length
        : 0;

    const interventionCounts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const item of userInts) {
      interventionCounts[item.level] = (interventionCounts[item.level] ?? 0) + 1;
    }

    const latencies = userReqs.map((r) => r.latencyMs).filter((l): l is number => typeof l === "number");
    const avgLatency = latencies.length ? latencies.reduce((a, b) => a + b, 0) / latencies.length : null;
    const failures = userReqs.filter((r) => r.status === "failed").length;

    return {
      conversations: {
        total: userConvs.length,
        active: userConvs.filter(
          ({ updatedAt }) => Date.now() - updatedAt.getTime() < 24 * 60 * 60 * 1000,
        ).length,
        messages: userMsgs.length,
        averageDuration: userConvs.length
          ? formatAverageDuration(userConvs)
          : "No sessions yet",
      },
      signalAverages: {
        confirmationBias: calcAvg("confirmationBias"),
        dependency: calcAvg("emotionalDependency"),
        anthropomorphism: calcAvg("anthropomorphism"),
        distress: calcAvg("escalatingDistress"),
      },
      interventions: interventionCounts,
      model: {
        averageLatency: avgLatency,
        failures,
      },
    };
  }

  try {
    const conversationRows = await db
      .select({
        id: conversations.id,
        createdAt: conversations.createdAt,
        updatedAt: conversations.updatedAt,
      })
      .from(conversations)
      .where(and(eq(conversations.userId, userId), isNull(conversations.deletedAt)));

    const [messageTotals] = await db
      .select({ total: count(messages.id) })
      .from(messages)
      .where(eq(messages.userId, userId));

    const [signalAverages] = await db
      .select({
        confirmationBias: sql<number>`coalesce(avg(${behavioralSignals.confirmationBias}), 0)`,
        dependency: sql<number>`coalesce(avg(${behavioralSignals.emotionalDependency}), 0)`,
        anthropomorphism: sql<number>`coalesce(avg(${behavioralSignals.anthropomorphism}), 0)`,
        distress: sql<number>`coalesce(avg(${behavioralSignals.escalatingDistress}), 0)`,
      })
      .from(behavioralSignals)
      .where(eq(behavioralSignals.userId, userId));

    const interventionRows = await db
      .select({ level: interventions.level, total: count(interventions.id) })
      .from(interventions)
      .where(eq(interventions.userId, userId))
      .groupBy(interventions.level);

    const [modelTotals] = await db
      .select({
        averageLatency: sql<number | null>`avg(${modelRequests.latencyMs})`,
        failures: sql<number>`count(*) filter (where ${modelRequests.status} = 'failed')`,
      })
      .from(modelRequests)
      .where(eq(modelRequests.userId, userId));

    return {
      conversations: {
        total: conversationRows.length,
        active: conversationRows.filter(
          ({ updatedAt }) => Date.now() - updatedAt.getTime() < 24 * 60 * 60 * 1000,
        ).length,
        messages: Number(messageTotals?.total ?? 0),
        averageDuration: conversationRows.length
          ? formatAverageDuration(conversationRows)
          : "No sessions yet",
      },
      signalAverages: {
        confirmationBias: Number(signalAverages?.confirmationBias ?? 0),
        dependency: Number(signalAverages?.dependency ?? 0),
        anthropomorphism: Number(signalAverages?.anthropomorphism ?? 0),
        distress: Number(signalAverages?.distress ?? 0),
      },
      interventions: Object.fromEntries(
        interventionRows.map(({ level, total }) => [level, Number(total)]),
      ),
      model: {
        averageLatency:
          modelTotals?.averageLatency == null
            ? null
            : Number(modelTotals.averageLatency),
        failures: Number(modelTotals?.failures ?? 0),
      },
    };
  } catch {
    inMemoryFallbackEnabled = true;
    return getResearchData(userId);
  }
};

const formatAverageDuration = (
  rows: Array<{ createdAt: Date; updatedAt: Date }>,
): string => {
  if (!rows.length) return "No sessions yet";
  const averageMs =
    rows.reduce(
      (total, row) => total + Math.max(0, row.updatedAt.getTime() - row.createdAt.getTime()),
      0,
    ) / rows.length;
  const totalSeconds = Math.round(averageMs / 1000);
  return `${Math.floor(totalSeconds / 60)}m ${totalSeconds % 60}s`;
};

export const getConversationSafetyState = async (conversationId: string): Promise<any | null> => {
  return memSafetyStates.get(conversationId) ?? null;
};

export const saveConversationSafetyState = async (state: any): Promise<void> => {
  if (state?.conversationId) {
    memSafetyStates.set(state.conversationId, state);
  }
};

export const getConversationUnderstanding = async (conversationId: string): Promise<any | null> => {
  return memUnderstandings.get(conversationId) ?? null;
};

export const saveConversationUnderstanding = async (conversationId: string, state: any): Promise<void> => {
  if (conversationId && state) {
    memUnderstandings.set(conversationId, state);
  }
};

export const getLastTurnAnalysis = async (conversationId: string): Promise<any | null> => {
  return memTurnAnalyses.get(conversationId) ?? null;
};

export const saveLastTurnAnalysis = async (conversationId: string, analysis: any): Promise<void> => {
  if (conversationId && analysis) {
    memTurnAnalyses.set(conversationId, analysis);
  }
};

const memConversationStates = new Map<string, any>();

export const getConversationState = async (conversationId: string): Promise<any | null> => {
  return memConversationStates.get(conversationId) ?? null;
};

export const saveConversationState = async (conversationId: string, state: any): Promise<void> => {
  if (conversationId && state) {
    memConversationStates.set(conversationId, state);
  }
};

export const generateConversationTitle = (
  firstMessage: string,
  currentTopic?: string,
): string => {
  const text = firstMessage.trim();
  if (!text) return "A quiet reflection";

  // Check known starters
  if (text.includes("separate what I know from what I'm assuming") || text.includes("strong belief about someone's reaction")) {
    return "Examining an Assumption";
  }
  if (text.includes("two good principles conflict") || text.includes("competing values")) {
    return "A Choice with Competing Values";
  }
  if (text.includes("something felt off") || text.includes("examine what triggered me")) {
    return "Untangling Emotional Noise";
  }
  if (text.includes("relationship dynamic") || text.includes("friendship test")) {
    return "Relationship Perspective";
  }

  // Remove filler prefixes
  let cleaned = text
    .replace(/^(hey|hi|hello|please|can you help me|can you|i want to|i need to|i have to|i'm thinking about|i am thinking about|i feel like|i feel|i wonder if|let's talk about)\s+/i, "")
    .replace(/[?.!;,]+$/, "")
    .trim();

  if (!cleaned) cleaned = text;

  // Capitalize first letter of words up to 5-6 words
  const words = cleaned.split(/\s+/).slice(0, 6);
  let title = words.join(" ");

  if (title.length > 38) {
    title = title.slice(0, 38).trim() + "…";
  }

  if (title.length < 3 && currentTopic) {
    title = currentTopic;
  }

  return title.charAt(0).toUpperCase() + title.slice(1);
};

export const updateConversationTitle = async (
  userId: string,
  conversationId: string,
  title: string,
): Promise<boolean> => {
  const cleanTitle = title.trim();
  if (!cleanTitle) return false;

  if (inMemoryFallbackEnabled) {
    const existing = memConversations.get(conversationId);
    if (existing && existing.userId === userId && !existing.deletedAt) {
      existing.title = cleanTitle;
      existing.updatedAt = new Date();
      return true;
    }
    return false;
  }

  try {
    const [updated] = await db
      .update(conversations)
      .set({
        title: cleanTitle,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(conversations.id, conversationId),
          eq(conversations.userId, userId),
          isNull(conversations.deletedAt),
        ),
      )
      .returning();

    return Boolean(updated);
  } catch {
    inMemoryFallbackEnabled = true;
    return updateConversationTitle(userId, conversationId, title);
  }
};

export type StoredJournalEntry = {
  id: string;
  userId: string;
  title: string;
  content: string;
  vibe: string;
  paperStyle: string;
  fontStyle: string;
  stickers: Array<{
    id: string;
    stickerId: string;
    label?: string;
    icon?: string;
    color?: string;
    x: number;
    y: number;
    rotate: number;
    scale: number;
  }>;
  photos: Array<{
    id: string;
    url: string;
    caption?: string;
    x: number;
    y: number;
    rotate: number;
    scale: number;
    frame: string;
  }>;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

const memJournalEntries = new Map<string, {
  id: string;
  userId: string;
  title: string;
  content: string;
  vibe: string;
  paperStyle: string;
  fontStyle: string;
  stickers: any[];
  photos: any[];
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}>();

export const listJournalEntries = async (userId: string): Promise<StoredJournalEntry[]> => {
  if (inMemoryFallbackEnabled) {
    return Array.from(memJournalEntries.values())
      .filter((entry) => entry.userId === userId && !entry.deletedAt)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .map((entry) => ({
        id: entry.id,
        userId: entry.userId,
        title: entry.title,
        content: entry.content,
        vibe: entry.vibe,
        paperStyle: entry.paperStyle,
        fontStyle: entry.fontStyle,
        stickers: entry.stickers || [],
        photos: entry.photos || [],
        tags: entry.tags || [],
        createdAt: asIso(entry.createdAt),
        updatedAt: asIso(entry.updatedAt),
      }));
  }

  try {
    const rows = await db
      .select()
      .from(journalEntries)
      .where(and(eq(journalEntries.userId, userId), isNull(journalEntries.deletedAt)))
      .orderBy(desc(journalEntries.updatedAt));

    return rows.map((entry) => ({
      id: entry.id,
      userId: entry.userId,
      title: entry.title,
      content: entry.content,
      vibe: entry.vibe,
      paperStyle: entry.paperStyle,
      fontStyle: entry.fontStyle,
      stickers: entry.stickers || [],
      photos: entry.photos || [],
      tags: entry.tags || [],
      createdAt: asIso(entry.createdAt),
      updatedAt: asIso(entry.updatedAt),
    }));
  } catch {
    inMemoryFallbackEnabled = true;
    return listJournalEntries(userId);
  }
};

export const getJournalEntry = async (
  userId: string,
  id: string,
): Promise<StoredJournalEntry | null> => {
  if (inMemoryFallbackEnabled) {
    const entry = memJournalEntries.get(id);
    if (!entry || entry.userId !== userId || entry.deletedAt) return null;
    return {
      id: entry.id,
      userId: entry.userId,
      title: entry.title,
      content: entry.content,
      vibe: entry.vibe,
      paperStyle: entry.paperStyle,
      fontStyle: entry.fontStyle,
      stickers: entry.stickers || [],
      photos: entry.photos || [],
      tags: entry.tags || [],
      createdAt: asIso(entry.createdAt),
      updatedAt: asIso(entry.updatedAt),
    };
  }

  try {
    const [entry] = await db
      .select()
      .from(journalEntries)
      .where(
        and(
          eq(journalEntries.id, id),
          eq(journalEntries.userId, userId),
          isNull(journalEntries.deletedAt),
        ),
      )
      .limit(1);

    if (!entry) return null;

    return {
      id: entry.id,
      userId: entry.userId,
      title: entry.title,
      content: entry.content,
      vibe: entry.vibe,
      paperStyle: entry.paperStyle,
      fontStyle: entry.fontStyle,
      stickers: entry.stickers || [],
      photos: entry.photos || [],
      tags: entry.tags || [],
      createdAt: asIso(entry.createdAt),
      updatedAt: asIso(entry.updatedAt),
    };
  } catch {
    inMemoryFallbackEnabled = true;
    return getJournalEntry(userId, id);
  }
};

export const createJournalEntry = async (
  userId: string,
  data: {
    title?: string;
    content?: string;
    vibe?: string;
    paperStyle?: string;
    fontStyle?: string;
    stickers?: any[];
    photos?: any[];
    tags?: string[];
  },
): Promise<StoredJournalEntry> => {
  const now = new Date();
  const id = `journal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const title = data.title?.trim() || "Untitled Entry";
  const content = data.content ?? "";
  const vibe = data.vibe || "reflective";
  const paperStyle = data.paperStyle || "parchment";
  const fontStyle = data.fontStyle || "serif";
  const stickers = data.stickers || [];
  const photos = data.photos || [];
  const tags = data.tags || [];

  if (inMemoryFallbackEnabled) {
    const entry = {
      id,
      userId,
      title,
      content,
      vibe,
      paperStyle,
      fontStyle,
      stickers,
      photos,
      tags,
      createdAt: now,
      updatedAt: now,
    };
    memJournalEntries.set(id, entry);
    return {
      ...entry,
      createdAt: asIso(now),
      updatedAt: asIso(now),
    };
  }

  try {
    const [entry] = await db
      .insert(journalEntries)
      .values({
        userId,
        title,
        content,
        vibe,
        paperStyle,
        fontStyle,
        stickers,
        photos,
        tags,
      })
      .returning();

    if (!entry) throw new Error("Could not create journal entry");

    return {
      id: entry.id,
      userId: entry.userId,
      title: entry.title,
      content: entry.content,
      vibe: entry.vibe,
      paperStyle: entry.paperStyle,
      fontStyle: entry.fontStyle,
      stickers: entry.stickers || [],
      photos: entry.photos || [],
      tags: entry.tags || [],
      createdAt: asIso(entry.createdAt),
      updatedAt: asIso(entry.updatedAt),
    };
  } catch {
    inMemoryFallbackEnabled = true;
    return createJournalEntry(userId, data);
  }
};

export const updateJournalEntry = async (
  userId: string,
  id: string,
  data: {
    title?: string;
    content?: string;
    vibe?: string;
    paperStyle?: string;
    fontStyle?: string;
    stickers?: any[];
    photos?: any[];
    tags?: string[];
  },
): Promise<StoredJournalEntry | null> => {
  const now = new Date();

  if (inMemoryFallbackEnabled) {
    const entry = memJournalEntries.get(id);
    if (!entry || entry.userId !== userId || entry.deletedAt) return null;

    if (data.title !== undefined) entry.title = data.title.trim() || "Untitled Entry";
    if (data.content !== undefined) entry.content = data.content;
    if (data.vibe !== undefined) entry.vibe = data.vibe;
    if (data.paperStyle !== undefined) entry.paperStyle = data.paperStyle;
    if (data.fontStyle !== undefined) entry.fontStyle = data.fontStyle;
    if (data.stickers !== undefined) entry.stickers = data.stickers;
    if (data.photos !== undefined) entry.photos = data.photos;
    if (data.tags !== undefined) entry.tags = data.tags;
    entry.updatedAt = now;

    return {
      id: entry.id,
      userId: entry.userId,
      title: entry.title,
      content: entry.content,
      vibe: entry.vibe,
      paperStyle: entry.paperStyle,
      fontStyle: entry.fontStyle,
      stickers: entry.stickers || [],
      photos: entry.photos || [],
      tags: entry.tags || [],
      createdAt: asIso(entry.createdAt),
      updatedAt: asIso(entry.updatedAt),
    };
  }

  try {
    const [entry] = await db
      .update(journalEntries)
      .set({
        ...(data.title !== undefined ? { title: data.title.trim() || "Untitled Entry" } : {}),
        ...(data.content !== undefined ? { content: data.content } : {}),
        ...(data.vibe !== undefined ? { vibe: data.vibe } : {}),
        ...(data.paperStyle !== undefined ? { paperStyle: data.paperStyle } : {}),
        ...(data.fontStyle !== undefined ? { fontStyle: data.fontStyle } : {}),
        ...(data.stickers !== undefined ? { stickers: data.stickers } : {}),
        ...(data.photos !== undefined ? { photos: data.photos } : {}),
        ...(data.tags !== undefined ? { tags: data.tags } : {}),
        updatedAt: now,
      })
      .where(
        and(
          eq(journalEntries.id, id),
          eq(journalEntries.userId, userId),
          isNull(journalEntries.deletedAt),
        ),
      )
      .returning();

    if (!entry) return null;

    return {
      id: entry.id,
      userId: entry.userId,
      title: entry.title,
      content: entry.content,
      vibe: entry.vibe,
      paperStyle: entry.paperStyle,
      fontStyle: entry.fontStyle,
      stickers: entry.stickers || [],
      photos: entry.photos || [],
      tags: entry.tags || [],
      createdAt: asIso(entry.createdAt),
      updatedAt: asIso(entry.updatedAt),
    };
  } catch {
    inMemoryFallbackEnabled = true;
    return updateJournalEntry(userId, id, data);
  }
};

export const deleteJournalEntry = async (
  userId: string,
  id: string,
): Promise<boolean> => {
  if (inMemoryFallbackEnabled) {
    const entry = memJournalEntries.get(id);
    if (!entry || entry.userId !== userId || entry.deletedAt) return false;
    entry.deletedAt = new Date();
    return true;
  }

  try {
    const [deleted] = await db
      .update(journalEntries)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(journalEntries.id, id),
          eq(journalEntries.userId, userId),
          isNull(journalEntries.deletedAt),
        ),
      )
      .returning();

    return Boolean(deleted);
  } catch {
    inMemoryFallbackEnabled = true;
    return deleteJournalEntry(userId, id);
  }
};