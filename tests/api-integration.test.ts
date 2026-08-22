import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import app from "../artifacts/api-server/src/app";

describe("SENTINEL Express API Integration Endpoints", () => {
  let server: http.Server;
  let baseUrl = "";
  let createdConversationId = "";

  before(async () => {
    await new Promise<void>((resolve) => {
      server = http.createServer(app);
      server.listen(0, "127.0.0.1", () => {
        const addr = server.address();
        if (addr && typeof addr === "object") {
          baseUrl = `http://127.0.0.1:${addr.port}`;
        }
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it("GET /healthz should return 200 with ok status", async () => {
    const res = await fetch(`${baseUrl}/healthz`);
    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as { status: string };
    assert.strictEqual(body.status, "ok");
  });

  it("GET /api/healthz should return 200 with ok status", async () => {
    const res = await fetch(`${baseUrl}/api/healthz`);
    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as { status: string };
    assert.strictEqual(body.status, "ok");
  });

  it("GET /health should return 200 with service info", async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as { status: string; service: string };
    assert.strictEqual(body.service, "sentinel-api");
  });

  it("POST /api/conversations should create a new conversation", async () => {
    const res = await fetch(`${baseUrl}/api/conversations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Inquiry on Boundaries" }),
    });

    assert.strictEqual(res.status, 201);
    const body = (await res.json()) as { id: string; title: string };
    assert.ok(body.id);
    assert.strictEqual(body.title, "Inquiry on Boundaries");
    createdConversationId = body.id;
  });

  it("GET /api/conversations should list conversations", async () => {
    const res = await fetch(`${baseUrl}/api/conversations`);
    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as Array<{ id: string; title: string }>;
    assert.ok(Array.isArray(body));
    assert.ok(body.length >= 1);
  });

  it("GET /api/conversations/:id should return conversation detail", async () => {
    const res = await fetch(`${baseUrl}/api/conversations/${createdConversationId}`);
    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as { id: string; messages: unknown[] };
    assert.strictEqual(body.id, createdConversationId);
    assert.ok(Array.isArray(body.messages));
  });

  it("POST /api/conversations/:id/messages should process safety pipeline and return structured result", async () => {
    // Send a message with emotional dependency
    const res = await fetch(
      `${baseUrl}/api/conversations/${createdConversationId}/messages`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "You're the only one I need. Don't ever leave me." }),
      },
    );

    assert.strictEqual(res.status, 201);
    const body = (await res.json()) as {
      userMessage: { id: string; content: string };
      assistantMessage: { id: string; content: string };
      signals: Record<string, number>;
      interventionLevel: number;
      highestSignal: string;
      environmentState: { mode: string };
    };

    assert.ok(body.userMessage);
    assert.ok(body.assistantMessage);
    assert.ok(body.signals);
    assert.strictEqual(body.interventionLevel, 3);
    assert.strictEqual(body.highestSignal, "emotionalDependency");
    assert.ok(body.environmentState);
  });

  it("POST /api/conversations/:id/messages with Accept: text/event-stream should stream response tokens via SSE", async () => {
    const res = await fetch(
      `${baseUrl}/api/conversations/${createdConversationId}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "text/event-stream",
        },
        body: JSON.stringify({ content: "Tell me something interesting about astronomy." }),
      },
    );

    assert.strictEqual(res.status, 200);
    assert.ok(res.headers.get("content-type")?.includes("text/event-stream"));

    const text = await res.text();
    assert.ok(text.includes("event: delta"));
    assert.ok(text.includes("event: done"));
    assert.ok(text.includes('"assistantMessage"'));
  });

  it("GET /api/reflections should return structured dynamic reflections", async () => {
    const res = await fetch(`${baseUrl}/api/reflections`);
    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as {
      topics: string[];
      perspectives: string[];
      questions: string[];
      timeline: unknown[];
    };
    assert.ok(Array.isArray(body.topics));
    assert.ok(Array.isArray(body.perspectives));
    assert.ok(Array.isArray(body.questions));
    assert.ok(Array.isArray(body.timeline));
  });

  it("GET /api/environment should return current atmosphere state", async () => {
    const res = await fetch(`${baseUrl}/api/environment`);
    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as { mode: string; approvedObjects: string[] };
    assert.ok(body.mode);
    assert.ok(Array.isArray(body.approvedObjects));
  });

  it("PATCH /api/environment should accept or reject an atmosphere lens", async () => {
    const res = await fetch(`${baseUrl}/api/environment`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objectName: "a quiet green presence", decision: "accepted" }),
    });

    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as { approvedObjects: string[] };
    assert.ok(body.approvedObjects.includes("a quiet green presence"));
  });

  it("GET /api/research/analytics should return aggregate analytics", async () => {
    const res = await fetch(`${baseUrl}/api/research/analytics`);
    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as {
      conversations: { total: number };
      signalSeries: unknown[];
      interventionSeries: unknown[];
      model: { status: string };
    };
    assert.ok(body.conversations);
    assert.ok(Array.isArray(body.signalSeries));
    assert.ok(Array.isArray(body.interventionSeries));
    assert.ok(body.model);
  });
});
