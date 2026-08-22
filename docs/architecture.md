# Sentinel AI architecture

## Runtime flow

```text
React + generated client
        |
        v
Express /api
        |
         +--> PostgreSQL / Drizzle store
        +--> deterministic safety analysis
        +--> intervention level
        +--> environment mode interpolation
        +--> optional OpenAI provider
        |
        v
typed MessageResult or honest 503
```

The current message is analyzed together with the most recent messages before it is sent to the provider. The provider receives a bounded context window rather than an unbounded transcript. The server owns safety analysis, the intervention policy, and environment mode selection; the LLM only writes natural language.

Conversation and message writes are persisted in PostgreSQL. Safety analysis is written to the behavioral signal, risk event, and intervention tables, while model attempts are recorded as request telemetry. Environment preferences and decisions are also durable. The preview currently uses a server-side local profile because authentication is not yet configured; production multi-user isolation requires adding the auth middleware before launch.

## Safety vectors

The safety engine returns normalized values between 0 and 1 for:

- confirmation bias
- emotional dependency
- anthropomorphism
- unsupported-belief reinforcement
- escalating distress
- unsafe advice
- over-validation
- manipulation
- hallucination risk

These are interaction signals for research and product safety. They are not medical or psychological scores.

## Frontend surfaces

The entrance is intentionally separate from the chat. The space keeps the conversation central while the environment moves slowly through CSS gradients and abstract forms. `prefers-reduced-motion` disables the drift. Reflection and research views use the same API contract but maintain different visual purposes.

## API failure behavior

Missing credentials and provider failures return a 503 with a user-safe message. The server never converts a failure into a hardcoded assistant reply. The user's message and safety records are persisted before the provider call so the user can retry once a provider is configured.

## Deliberate phase boundaries

The database includes documents, chunks, embeddings, and audit-log tables to establish the Phase 1 data model. Retrieval-augmented generation, semantic safety classification, Redis-backed queues/workers, authentication, and protected researcher authorization are not represented as complete runtime features until their implementations and verification are added.