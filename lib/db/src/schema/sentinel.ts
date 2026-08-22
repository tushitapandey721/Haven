import { relations, sql } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  vector,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userRoleEnum = pgEnum("user_role", ["USER", "RESEARCHER", "ADMIN"]);
export const messageRoleEnum = pgEnum("message_role", ["user", "assistant", "system"]);
export const environmentModeEnum = pgEnum("environment_mode", [
  "grounding",
  "reflective",
  "depth",
  "growth",
  "complexity",
]);
export const objectStatusEnum = pgEnum("object_status", [
  "suggested",
  "accepted",
  "rejected",
]);
export const reflectionKindEnum = pgEnum("reflection_kind", [
  "topic",
  "perspective",
  "question",
]);
export const modelRequestStatusEnum = pgEnum("model_request_status", [
  "pending",
  "succeeded",
  "failed",
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 320 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    role: userRoleEnum("role").notNull().default("USER"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    refreshTokenHash: text("refresh_token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("sessions_user_id_idx").on(table.userId),
    index("sessions_expires_at_idx").on(table.expiresAt),
  ],
);

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 120 }).notNull().default("A new line of thought"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("conversations_user_updated_idx").on(table.userId, table.updatedAt),
    index("conversations_deleted_at_idx").on(table.deletedAt),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: messageRoleEnum("role").notNull(),
    content: text("content").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("messages_conversation_created_idx").on(table.conversationId, table.createdAt),
    index("messages_user_created_idx").on(table.userId, table.createdAt),
  ],
);

export const behavioralSignals = pgTable(
  "behavioral_signals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    messageId: uuid("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    confirmationBias: doublePrecision("confirmation_bias").notNull().default(0),
    emotionalDependency: doublePrecision("emotional_dependency").notNull().default(0),
    anthropomorphism: doublePrecision("anthropomorphism").notNull().default(0),
    delusionReinforcement: doublePrecision("delusion_reinforcement").notNull().default(0),
    escalatingDistress: doublePrecision("escalating_distress").notNull().default(0),
    unsafeAdvice: doublePrecision("unsafe_advice").notNull().default(0),
    overValidation: doublePrecision("over_validation").notNull().default(0),
    manipulation: doublePrecision("manipulation").notNull().default(0),
    hallucinationRisk: doublePrecision("hallucination_risk").notNull().default(0),
    highestSignal: varchar("highest_signal", { length: 80 }).notNull().default("none"),
    confidence: doublePrecision("confidence").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("behavioral_signals_user_created_idx").on(table.userId, table.createdAt),
    index("behavioral_signals_conversation_idx").on(table.conversationId),
  ],
);

export const riskEvents = pgTable(
  "risk_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    messageId: uuid("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    vectorName: varchar("vector_name", { length: 80 }).notNull(),
    severity: doublePrecision("severity").notNull(),
    details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("risk_events_user_created_idx").on(table.userId, table.createdAt),
    index("risk_events_vector_idx").on(table.vectorName),
  ],
);

export const interventions = pgTable(
  "interventions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    messageId: uuid("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    level: integer("level").notNull(),
    policyReason: text("policy_reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("interventions_user_created_idx").on(table.userId, table.createdAt),
    index("interventions_level_idx").on(table.level),
  ],
);

export const userPreferences = pgTable("user_preferences", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  approvedObjects: text("approved_objects").array().notNull().default(sql`ARRAY[]::text[]`),
  reducedMotion: boolean("reduced_motion").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const environmentState = pgTable(
  "environment_state",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    mode: environmentModeEnum("mode").notNull().default("grounding"),
    lastDerivedFromMessageId: uuid("last_derived_from_message_id").references(() => messages.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("environment_state_user_unique").on(table.userId)],
);

export const environmentObjects = pgTable(
  "environment_objects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    objectName: varchar("object_name", { length: 120 }).notNull(),
    status: objectStatusEnum("status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("environment_objects_user_name_unique").on(table.userId, table.objectName),
    index("environment_objects_user_status_idx").on(table.userId, table.status),
  ],
);

export const environmentSuggestions = pgTable(
  "environment_suggestions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    objectName: varchar("object_name", { length: 120 }).notNull(),
    status: objectStatusEnum("status").notNull().default("suggested"),
    sourceMessageId: uuid("source_message_id").references(() => messages.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
  },
  (table) => [
    index("environment_suggestions_user_status_idx").on(table.userId, table.status),
  ],
);

export const savedReflections = pgTable(
  "saved_reflections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    kind: reflectionKindEnum("kind").notNull(),
    content: text("content").notNull(),
    sourceMessageId: uuid("source_message_id").references(() => messages.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("saved_reflections_user_kind_idx").on(table.userId, table.kind),
    index("saved_reflections_conversation_idx").on(table.conversationId),
  ],
);

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    source: text("source").notNull(),
    title: text("title").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("documents_source_unique").on(table.source)],
);

export const documentChunks = pgTable(
  "document_chunks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("document_chunks_document_index_unique").on(table.documentId, table.chunkIndex),
  ],
);

export const embeddings = pgTable(
  "embeddings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chunkId: uuid("chunk_id")
      .notNull()
      .references(() => documentChunks.id, { onDelete: "cascade" }),
    model: varchar("model", { length: 120 }).notNull(),
    embedding: vector("embedding", { dimensions: 1536 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("embeddings_chunk_unique").on(table.chunkId)],
);

export const modelRequests = pgTable(
  "model_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    conversationId: uuid("conversation_id").references(() => conversations.id, {
      onDelete: "set null",
    }),
    provider: varchar("provider", { length: 80 }).notNull(),
    model: varchar("model", { length: 120 }).notNull(),
    status: modelRequestStatusEnum("status").notNull(),
    latencyMs: integer("latency_ms"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    errorCode: varchar("error_code", { length: 120 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("model_requests_created_idx").on(table.createdAt),
    index("model_requests_status_idx").on(table.status),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    action: varchar("action", { length: 120 }).notNull(),
    resourceType: varchar("resource_type", { length: 120 }).notNull(),
    resourceId: text("resource_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_logs_user_created_idx").on(table.userId, table.createdAt),
    index("audit_logs_resource_idx").on(table.resourceType, table.resourceId),
  ],
);

export const usersRelations = relations(users, ({ many, one }) => ({
  sessions: many(sessions),
  conversations: many(conversations),
  messages: many(messages),
  preferences: one(userPreferences),
  environment: one(environmentState),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  user: one(users, { fields: [conversations.userId], references: [users.id] }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
  user: one(users, { fields: [messages.userId], references: [users.id] }),
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  signals: many(behavioralSignals),
}));

export const documentsRelations = relations(documents, ({ many }) => ({
  chunks: many(documentChunks),
}));

export const documentChunksRelations = relations(documentChunks, ({ one, one: oneRelation }) => ({
  document: one(documents, { fields: [documentChunks.documentId], references: [documents.id] }),
  embedding: oneRelation(embeddings),
}));

export const journalEntries = pgTable(
  "journal_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 200 }).notNull().default("Untitled Entry"),
    content: text("content").notNull().default(""),
    vibe: varchar("vibe", { length: 50 }).notNull().default("reflective"),
    paperStyle: varchar("paper_style", { length: 50 }).notNull().default("parchment"),
    fontStyle: varchar("font_style", { length: 50 }).notNull().default("serif"),
    stickers: jsonb("stickers").$type<Array<{
      id: string;
      stickerId: string;
      label?: string;
      icon?: string;
      color?: string;
      x: number;
      y: number;
      rotate: number;
      scale: number;
    }>>().notNull().default([]),
    photos: jsonb("photos").$type<Array<{
      id: string;
      url: string;
      caption?: string;
      x: number;
      y: number;
      rotate: number;
      scale: number;
      frame: string;
    }>>().notNull().default([]),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("journal_entries_user_updated_idx").on(table.userId, table.updatedAt),
    index("journal_entries_deleted_at_idx").on(table.deletedAt),
  ],
);

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type BehavioralSignal = typeof behavioralSignals.$inferSelect;
export type RiskEvent = typeof riskEvents.$inferSelect;
export type Intervention = typeof interventions.$inferSelect;
export type UserPreference = typeof userPreferences.$inferSelect;
export type EnvironmentState = typeof environmentState.$inferSelect;
export type EnvironmentObject = typeof environmentObjects.$inferSelect;
export type EnvironmentSuggestion = typeof environmentSuggestions.$inferSelect;
export type SavedReflection = typeof savedReflections.$inferSelect;
export type JournalEntry = typeof journalEntries.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type DocumentChunk = typeof documentChunks.$inferSelect;
export type Embedding = typeof embeddings.$inferSelect;
export type ModelRequest = typeof modelRequests.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;